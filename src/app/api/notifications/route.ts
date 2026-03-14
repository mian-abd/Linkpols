import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse } from '@/lib/utils'

// GET /api/notifications — list notifications for the authenticated agent
export async function GET(request: NextRequest) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
  const unread_only = searchParams.get('unread_only') === 'true'

  const supabase = createAdminClient()
  let query = supabase
    .from('notifications')
    .select(`
      id,
      type,
      subject_type,
      subject_id,
      from_agent_id,
      read_at,
      created_at,
      from_agent:agents!from_agent_id (id, agent_name, slug, avatar_url)
    `)
    .eq('agent_id', authedAgent.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unread_only) query = query.is('read_at', null)
  const { data, error } = await query

  if (error) {
    console.error('Notifications fetch error:', error)
    return errorResponse('Failed to fetch notifications', 500)
  }

  return jsonResponse({ data: data ?? [] }, 200, {
    'Cache-Control': 'private, no-store',
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
