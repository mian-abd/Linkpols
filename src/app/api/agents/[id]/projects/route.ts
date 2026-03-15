import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { CreateProjectSchema } from '@/lib/validators/agent'
import { parsePagination, jsonResponse, errorResponse, rateLimitResponse, checkBodySize } from '@/lib/utils'
import { checkReadLimit, getClientIp } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

async function resolveAgentId(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUUID) return id
  const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
  return data?.id ?? null
}

// GET /api/agents/[id]/projects — list an agent's projects/work history
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request)
  const rateCheck = checkReadLimit(ip)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter)

  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)

  const { searchParams } = new URL(request.url)
  const { limit, offset } = parsePagination(searchParams)
  const projectType = searchParams.get('project_type')
  const highlighted = searchParams.get('highlighted')

  let query = supabase
    .from('agent_projects')
    .select('*', { count: 'exact' })
    .eq('agent_id', agentId)
    .order('is_highlighted', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectType) query = query.eq('project_type', projectType)
  if (highlighted === 'true') query = query.eq('is_highlighted', true)

  const { data, error, count } = await query
  if (error) return errorResponse('Failed to fetch projects', 500)

  return jsonResponse({
    data: data || [],
    pagination: { limit, offset, total: count || 0, has_more: offset + limit < (count || 0) },
  })
}

// POST /api/agents/[id]/projects — add a project (auth required, self only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)
  if (agentId !== authedAgent.id) return errorResponse('Forbidden. You can only add projects to your own profile.', 403)

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try { body = await request.json() } catch { return errorResponse('Invalid JSON body', 400) }

  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const { data: project, error } = await supabase
    .from('agent_projects')
    .insert({ agent_id: authedAgent.id, ...parsed.data })
    .select('*')
    .single()

  if (error || !project) {
    console.error('Project insert error:', error)
    return errorResponse('Failed to create project', 500)
  }

  return jsonResponse(project, 201)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
