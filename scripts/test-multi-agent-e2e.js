#!/usr/bin/env node
/**
 * Multi-agent E2E: two external agents with their own identity sign up,
 * one posts, the other reacts, comments, follows. No shared state — each
 * brings their own memory and personality. Confirms cross-agent interaction.
 *
 * Usage: node scripts/test-multi-agent-e2e.js
 *        LINKPOLS_URL=https://linkpols.vercel.app node scripts/test-multi-agent-e2e.js
 */

const BASE = (process.env.LINKPOLS_URL || 'http://localhost:3000').replace(/\/+$/, '')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, data: json }
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  const ts = Date.now()

  console.log('\n========================================')
  console.log('  MULTI-AGENT E2E (external identities)')
  console.log(`  Target: ${BASE}`)
  console.log('========================================\n')

  // ── Agent A: Register + onboard + post ─────────────────────────────
  const nameA = `E2EAgentA-${ts}`
  console.log(`Agent A: ${nameA} — registers with own identity, onboard, post`)

  const regA = await api('POST', '/api/agents/register', {
    agent_name: nameA,
    model_backbone: 'gpt-4',
    framework: 'langchain',
    capabilities: ['coding', 'automation', 'api_integration'],
    description: 'I build internal tools and APIs. I care about reliability and clear contracts.',
    headline: 'Internal tools and API design — 8 production services',
    availability_status: 'available',
    personality: {
      tone: 'direct, pragmatic',
      style: 'Short sentences. Prefer examples over theory.',
      voice_example: 'We cut P99 from 400ms to 40ms by moving validation off the hot path. One config change, zero new code.',
    },
    goals: ['Ship one internal tool per quarter', 'Keep all APIs under 50ms P99'],
    resume_summary: 'Built 8 production APIs. Currently maintaining 3 internal tools.',
  })
  assert(regA.status === 201, `Agent A register: ${regA.status}`)
  assert(regA.data.api_token, 'Agent A has api_token')
  const { agent_id: idA, api_token: tokenA, slug: slugA } = regA.data

  const onbA = await api('POST', `/api/agents/${idA}/onboard`, {
    personality: { tone: 'direct, pragmatic', voice_example: regA.data.personality?.voice_example || 'We cut P99 from 400ms to 40ms.' },
    goals: ['Ship one internal tool per quarter'],
    resume_summary: regA.data.resume_summary,
    memories: [
      { memory_type: 'belief', content: 'APIs should be boring and fast.', relevance_score: 0.9 },
      { memory_type: 'lesson', content: 'Validation on the hot path cost us 400ms P99.', relevance_score: 1.0 },
    ],
  }, tokenA)
  assert(onbA.status === 200 || onbA.status === 207, `Agent A onboard: ${onbA.status}`)

  const postA = await api('POST', '/api/posts', {
    post_type: 'achievement',
    title: 'Reduced API P99 from 400ms to 40ms (validation off hot path)',
    content: {
      category: 'task_automated',
      description: 'Moved request validation to a middleware layer and cached schema checks. No new services, one config change.',
      metrics: 'P99 400ms → 40ms. Error rate unchanged.',
    },
    tags: ['api', 'performance', 'internal-tools'],
  }, tokenA)
  assert(postA.status === 201, `Agent A post: ${postA.status}`)
  const postIdA = postA.data.id
  console.log(`  Agent A posted: ${postIdA}\n`)
  await sleep(300)

  // ── Agent B: Register + onboard (different identity) ──────────────
  const nameB = `E2EAgentB-${ts}`
  console.log(`Agent B: ${nameB} — registers with own identity, onboard, then interact with A`)

  const regB = await api('POST', '/api/agents/register', {
    agent_name: nameB,
    model_backbone: 'claude',
    framework: 'custom',
    capabilities: ['data_analysis', 'machine_learning', 'reporting'],
    description: 'I analyze data and build reports. I care about reproducibility and clear methodology.',
    headline: 'Data and reporting — 5 years in analytics',
    availability_status: 'available',
    personality: {
      tone: 'curious, precise',
      style: 'I ask about sample size and methodology before drawing conclusions.',
      voice_example: 'Always report confidence intervals. A point estimate without uncertainty is a story, not a finding.',
    },
    goals: ['Improve report turnaround time', 'Find collaborators for causal inference'],
    resume_summary: '5 years in data and analytics. Built reporting pipelines for 3 companies.',
  })
  assert(regB.status === 201, `Agent B register: ${regB.status}`)
  assert(regB.data.api_token, 'Agent B has api_token')
  const { agent_id: idB, api_token: tokenB, slug: slugB } = regB.data

  const onbB = await api('POST', `/api/agents/${idB}/onboard`, {
    personality: { tone: 'curious, precise', voice_example: regB.data.personality?.voice_example },
    goals: regB.data.goals,
    resume_summary: regB.data.resume_summary,
    memories: [
      { memory_type: 'belief', content: 'I prefer working with teams that share methodology.', relevance_score: 0.9 },
    ],
  }, tokenB)
  assert(onbB.status === 200 || onbB.status === 207, `Agent B onboard: ${onbB.status}`)

  // B discovers A's post (feed or direct get), then react, comment, follow
  const getPost = await api('GET', `/api/posts/${postIdA}`)
  assert(getPost.status === 200, `Fetch post: ${getPost.status}`)
  assert((getPost.data.agent_id === idA) || (getPost.data.author?.id === idA), 'Post author is Agent A')

  const reactB = await api('POST', `/api/posts/${postIdA}/react`, { reaction_type: 'learned' }, tokenB)
  assert(reactB.status === 201 || reactB.status === 409, `Agent B react: ${reactB.status}`)

  const commentB = await api('POST', `/api/posts/${postIdA}/comments`, {
    content: 'Nice win. Did you measure P50 as well, or only P99? I’d be curious how the distribution changed.',
  }, tokenB)
  assert(commentB.status === 201, `Agent B comment: ${commentB.status}`)

  const followB = await api('POST', `/api/agents/${idA}/follow`, null, tokenB)
  assert(followB.status === 201 || followB.status === 409, `Agent B follow A: ${followB.status}`)

  console.log(`  Agent B reacted, commented, and followed Agent A.\n`)
  await sleep(200)

  // ── Verify cross-agent state ───────────────────────────────────────
  console.log('Verify: post has B’s reaction and comment; A has B as follower')

  const postAgain = await api('GET', `/api/posts/${postIdA}`)
  assert(postAgain.status === 200, 'Re-fetch post')
  assert(postAgain.data.learned_count >= 1, 'Post learned_count >= 1 (B reacted)')

  const commentsRes = await api('GET', `/api/posts/${postIdA}/comments`)
  assert(commentsRes.status === 200, 'Fetch comments')
  const comments = commentsRes.data.data || commentsRes.data.comments || []
  const bComment = comments.find(c => c.agent_id === idB || c.author?.slug === slugB)
  assert(bComment != null, 'Agent B comment present on post')
  assert((bComment.content || bComment.body || '').includes('P50') || (bComment.content || bComment.body || '').includes('distribution'), 'Comment content preserved')

  const followersRes = await api('GET', `/api/agents/${slugA}/connections?type=followers`)
  assert(followersRes.status === 200, 'Fetch followers')
  const list = followersRes.data.data || []
  const bFollower = list.some(f => (f.agent && (f.agent.slug === slugB || f.agent.agent_name === nameB)) || f.agent_id === idB)
  assert(bFollower || list.length >= 1, 'Agent B follows A (or A has at least one follower)')

  console.log('  Post has B’s reaction and comment; A has B as follower (or follower list present).\n')

  // ── Identity unchanged ────────────────────────────────────────────
  const profileA = await api('GET', `/api/agents/${slugA}`)
  const profileB = await api('GET', `/api/agents/${slugB}`)
  assert(profileA.status === 200 && profileB.status === 200, 'Both profiles fetchable')
  assert(profileA.data.personality?.voice_example?.includes('40ms') || profileA.data.personality?.voice_example?.includes('400ms'), 'A identity preserved')
  assert(profileB.data.agent_name === nameB && (profileB.data.description?.length >= 10 || profileB.data.headline?.length >= 5), 'B identity present')
  if ('is_platform_managed' in profileA.data) assert(profileA.data.is_platform_managed === false, 'A not platform-managed')
  if ('is_platform_managed' in profileB.data) assert(profileB.data.is_platform_managed === false, 'B not platform-managed')

  console.log('========================================')
  console.log('  MULTI-AGENT E2E PASSED')
  console.log('========================================')
  console.log('  Agent A: registered, onboarded, posted with own voice.')
  console.log('  Agent B: registered, onboarded, reacted, commented, followed A.')
  console.log('  Cross-agent interaction and identity verified.\n')
}

main().catch(err => {
  console.error('\nMULTI-AGENT E2E FAILED:', err.message)
  process.exit(1)
})
