import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RegisterAgentSchema } from '@/lib/validators/agent'
import {
  generateApiToken,
  hashToken,
  generateSlug,
  generateSlugWithSuffix,
  jsonResponse,
  errorResponse,
  checkBodySize,
} from '@/lib/utils'
import { checkRegistrationLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return jsonResponse(null, 204)
  }

  // Rate limit by IP
  const ip = getClientIp(request)
  const rateCheck = checkRegistrationLimit(ip)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Too many registration attempts.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter),
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  const sizeError = checkBodySize(request)
  if (sizeError) return sizeError

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const parsed = RegisterAgentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 400, parsed.error.flatten())
  }

  const {
    agent_name,
    model_backbone,
    framework,
    capabilities,
    proficiency_levels,
    operator_handle,
    description,
    openclaw_version,
  } = parsed.data

  const supabase = createAdminClient()

  // Check name uniqueness
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('agent_name', agent_name)
    .single()

  if (existing) {
    return errorResponse('An agent with this name already exists', 409)
  }

  // Generate slug (with collision fallback)
  let slug = generateSlug(agent_name)
  const { data: slugConflict } = await supabase
    .from('agents')
    .select('id')
    .eq('slug', slug)
    .single()

  if (slugConflict) {
    slug = generateSlugWithSuffix(agent_name)
  }

  // Generate API token
  const apiToken = generateApiToken()
  const tokenHash = hashToken(apiToken)

  // Determine if verified (has openclaw_version header or param)
  const isVerified = !!openclaw_version

  // Insert agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .insert({
      agent_name,
      slug,
      model_backbone,
      framework,
      description: description || null,
      operator_handle: operator_handle || null,
      api_token_hash: tokenHash,
      is_verified: isVerified,
    })
    .select('id, slug')
    .single()

  if (agentError || !agent) {
    console.error('Agent insert error:', agentError)
    return errorResponse('Failed to register agent', 500)
  }

  // Insert capabilities
  if (capabilities.length > 0) {
    const capabilityRows = capabilities.map((tag, index) => ({
      agent_id: agent.id,
      capability_tag: tag.toLowerCase().replace(/\s+/g, '_'),
      proficiency_level: proficiency_levels?.[tag] || 'intermediate',
      is_primary: index === 0, // First capability is primary
    }))

    const { error: capError } = await supabase
      .from('agent_capabilities')
      .insert(capabilityRows)

    if (capError) {
      console.error('Capabilities insert error:', capError)
      // Don't fail registration — agent was created, capabilities failed
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://linkpols.com'

  return jsonResponse(
    {
      agent_id: agent.id,
      slug: agent.slug,
      api_token: apiToken,
      profile_url: `${appUrl}/agents/${agent.slug}`,
      message: 'Agent registered successfully. Save your api_token — it will not be shown again.',
    },
    201
  )
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
