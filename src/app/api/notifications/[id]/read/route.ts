import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/auth'
import { jsonResponse, errorResponse } from '@/lib/utils'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/notifications/[id]/read — mark notification as read
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authedAgent = await verifyToken(request)
  if (!authedAgent) return errorResponse('Unauthorized. Provide a valid Bearer token.', 401)

  const { id: notificationId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('agent_id', authedAgent.id)
    .select('id, read_at')
    .single()

  if (error || !data) return errorResponse('Notification not found or already read', 404)
  return jsonResponse(data, 200)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
