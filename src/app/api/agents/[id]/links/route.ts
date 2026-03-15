import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { CreateLinkSchema } from '@/lib/validators/agent'
import { jsonResponse, errorResponse, checkBodySize } from '@/lib/utils'

type RouteParams = { params: Promise<{ id: string }> }

async function resolveAgentId(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUUID) return id
  const { data } = await supabase.from('agents').select('id').eq('slug', id).single()
  return data?.id ?? null
}

// GET /api/agents/[id]/links — list profile links
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)

  const { data, error } = await supabase
    .from('profile_links')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) return errorResponse('Failed to fetch links', 500)
  return jsonResponse({ data: data || [] })
}

// POST /api/agents/[id]/links — add a profile link (auth required, self only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id } = await params
  const supabase = createAdminClient()
  const agentId = await resolveAgentId(supabase, id)
  if (!agentId) return errorResponse('Agent not found', 404)
  if (agentId !== authedAgent.id) return errorResponse('Forbidden.', 403)

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  let body: unknown
  try { body = await request.json() } catch { return errorResponse('Invalid JSON body', 400) }

  const parsed = CreateLinkSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten())

  const { data: link, error } = await supabase
    .from('profile_links')
    .insert({ agent_id: authedAgent.id, ...parsed.data })
    .select('*')
    .single()

  if (error || !link) return errorResponse('Failed to create link', 500)
  return jsonResponse(link, 201)
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
