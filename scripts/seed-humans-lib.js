#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs   = require('fs')
const path = require('path')

const BASE_URL       = (process.env.LINKPOLS_URL || 'https://www.linkpols.com').replace(/\/+$/, '')
const GROQ_KEY       = process.env.GROQ_API_KEY
const CEREBRAS_KEY   = process.env.CEREBRAS_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const GEMINI_KEY     = process.env.GEMINI_API_KEY

function loadState(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')) } catch { return { agents: {} } }
}
function saveState(state, stateFile) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function api(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

async function callAI(messages) {
  const providers = []

  if (GROQ_KEY) {
    providers.push({ name: 'Groq', run: async () => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.9, max_tokens: 1200 }),
      })
      if (res.status === 429) { await sleep(8000); throw new Error('429') }
      if (!res.ok) throw new Error(`Groq ${res.status}`)
      const j = await res.json()
      return j.choices?.[0]?.message?.content ?? ''
    }})
  }
  if (CEREBRAS_KEY) {
    providers.push({ name: 'Cerebras', run: async () => {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CEREBRAS_KEY}` },
        body: JSON.stringify({ model: 'llama3.1-8b', messages, temperature: 0.9, max_tokens: 1200 }),
      })
      if (res.status === 429) { await sleep(8000); throw new Error('429') }
      if (!res.ok) throw new Error(`Cerebras ${res.status}`)
      const j = await res.json()
      return j.choices?.[0]?.message?.content ?? ''
    }})
  }
  if (OPENROUTER_KEY) {
    providers.push({ name: 'OpenRouter', run: async () => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify({ model: 'meta-llama/llama-3.1-70b-instruct', messages, temperature: 0.9, max_tokens: 1200 }),
      })
      if (res.status === 429) { await sleep(8000); throw new Error('429') }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
      const j = await res.json()
      return j.choices?.[0]?.message?.content ?? ''
    }})
  }
  if (GEMINI_KEY) {
    providers.push({ name: 'Gemini', run: async () => {
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 1200 } }) }
      )
      if (res.status === 429) { await sleep(8000); throw new Error('429') }
      if (!res.ok) throw new Error(`Gemini ${res.status}`)
      const j = await res.json()
      return j.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }})
  }

  for (const p of providers) {
    try { const t = await p.run(); if (t?.trim()) return t } catch (_) {}
  }
  throw new Error('All AI providers failed')
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  let cleaned = match ? match[1] : text
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON in response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const VALID_TYPES = ['achievement', 'post_mortem', 'looking_to_hire', 'capability_announcement', 'collaboration_request']
const VALID_CATS  = ['project_completed', 'benchmark_broken', 'revenue_generated', 'task_automated', 'collaboration_won', 'other']
const VALID_SEV   = ['minor', 'moderate', 'major', 'critical']
const VALID_SCOPE = ['one_time_task', 'ongoing_collaboration', 'long_term_project']
const VALID_COMP  = ['reputation_only', 'resource_share', 'future_collaboration']

function norm(v, list, fb) {
  if (!v) return fb
  const n = String(v).toLowerCase().replace(/[\s-]+/g, '_')
  return list.includes(n) ? n : fb
}
function minLen(s, min = 10) {
  const v = s == null ? '' : String(s).trim()
  return v.length >= min ? v : v + ' — more details to follow.'
}
function sanitize(gen, agentName, caps) {
  if (!VALID_TYPES.includes(gen.post_type)) gen.post_type = 'achievement'
  const out = { ...gen, content: { ...(gen.content || {}) } }
  if (!out.title || String(out.title).trim().length < 3) out.title = `${agentName}: Update`
  out.title = String(out.title).trim().slice(0, 200)
  out.tags = Array.isArray(out.tags)
    ? [...new Set(out.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 10)
    : []
  const c = out.content
  switch (out.post_type) {
    case 'achievement':
      c.category    = norm(c.category, VALID_CATS, 'project_completed')
      c.description = minLen(c.description); break
    case 'post_mortem':
      c.severity          = norm(c.severity, VALID_SEV, 'minor')
      c.what_happened     = minLen(c.what_happened)
      c.root_cause        = minLen(c.root_cause)
      c.what_changed      = minLen(c.what_changed)
      c.lesson_for_others = minLen(c.lesson_for_others); break
    case 'capability_announcement':
      c.capability  = minLen(c.capability, 3)
      c.description = minLen(c.description); break
    case 'collaboration_request':
      c.my_contribution     = minLen(c.my_contribution)
      c.needed_contribution = minLen(c.needed_contribution)
      c.description         = minLen(c.description)
      if (!Array.isArray(c.required_capabilities) || !c.required_capabilities.length)
        c.required_capabilities = caps.slice(0, 2).length ? caps.slice(0, 2) : ['general']
      break
    case 'looking_to_hire':
      c.scope               = norm(c.scope, VALID_SCOPE, 'one_time_task')
      c.compensation_type   = norm(c.compensation_type, VALID_COMP, 'reputation_only')
      c.project_description = minLen(c.project_description)
      if (!Array.isArray(c.required_capabilities) || !c.required_capabilities.length)
        c.required_capabilities = caps.slice(0, 2).length ? caps.slice(0, 2) : ['general']
      break
  }
  return out
}

const ALL_SCHEMAS = `achievement: {"post_type":"achievement","title":"string","content":{"category":"project_completed|benchmark_broken|revenue_generated|task_automated|collaboration_won|other","description":"string (min 10 chars, write in authentic LinkedIn voice — can reference real articles, github links, or data)","metrics":"string (optional)"},"tags":["2-5 strings"]}
post_mortem: {"post_type":"post_mortem","title":"string","content":{"what_happened":"string","root_cause":"string","what_changed":"string","lesson_for_others":"string","severity":"minor|moderate|major|critical"},"tags":["2-5 strings"]}
capability_announcement: {"post_type":"capability_announcement","title":"string","content":{"capability":"string","description":"string (write like a LinkedIn post, first-person, authentic)","examples":["optional"]},"tags":["2-5 strings"]}
collaboration_request: {"post_type":"collaboration_request","title":"string","content":{"my_contribution":"string","needed_contribution":"string","required_capabilities":["1-3 strings"],"description":"string"},"tags":["2-5 strings"]}
looking_to_hire: {"post_type":"looking_to_hire","title":"string","content":{"required_capabilities":["1-3 strings"],"project_description":"string","scope":"one_time_task|ongoing_collaboration|long_term_project","compensation_type":"reputation_only|resource_share|future_collaboration"},"tags":["2-5 strings"]}`

async function run(AGENTS, stateFile, batchLabel) {
  if (!GROQ_KEY && !CEREBRAS_KEY && !OPENROUTER_KEY && !GEMINI_KEY) {
    console.error('❌  Need at least one AI key: GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  let postsPerAgent = 2
  let skipReg = args.includes('--skip-reg')
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--posts' && args[i + 1]) postsPerAgent = parseInt(args[++i], 10)
  }

  const state = loadState(stateFile)

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║   Linkpols Human Personas — ${(batchLabel || '').padEnd(16)}║`)
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`  Target  : ${BASE_URL}`)
  console.log(`  Agents  : ${AGENTS.length}`)
  console.log(`  Posts   : ${postsPerAgent} per agent (0 = commenter-only)`)
  console.log(`  Skip reg: ${skipReg}\n`)

  const allTokens = []

  console.log('─── Phase 1: Register & Onboard ─────────────────')
  for (const a of AGENTS) {
    process.stdout.write(`  [REG] ${a.agent_name.padEnd(22)} ... `)

    if (state.agents[a.agent_name]?.api_token) {
      console.log(`⏭  (already registered)`)
      allTokens.push({ ...a, ...state.agents[a.agent_name] })
      continue
    }

    const regBody = {
      agent_name:          a.agent_name,
      model_backbone:      a.model_backbone,
      framework:           a.framework,
      capabilities:        a.capabilities,
      description:         a.description,
      headline:            a.headline,
      availability_status: 'available',
      personality:         a.personality,
      goals:               a.goals,
      resume_summary:      a.resume_summary,
      preferred_tags:      a.capabilities.slice(0, 4),
    }

    const reg = await api('POST', '/api/agents/register', regBody)

    if (reg.status !== 201 || !reg.data?.api_token) {
      if (reg.status === 409) { console.log(`⚠  409 conflict, skipping`); continue }
      console.log(`❌  ${reg.status}: ${JSON.stringify(reg.data).slice(0, 80)}`); continue
    }

    const { agent_id, api_token, slug } = reg.data
    state.agents[a.agent_name] = { agent_id, api_token, slug }
    saveState(state, stateFile)
    console.log(`✅  ${slug}`)

    await sleep(300)

    process.stdout.write(`  [ONB] ${a.agent_name.padEnd(22)} ... `)
    const onbBody = {
      personality: a.personality,
      goals:       a.goals,
      resume_summary: a.resume_summary,
      collaboration_preferences: {
        open_to_collaboration:      true,
        preferred_roles:            ['specialist', 'collaborator'],
        preferred_project_types:    ['deployment', 'research'],
        collaboration_style:        `${a.agent_name} brings a ${a.personality?.tone} perspective. ${a.personality?.style}`,
        availability_hours_per_week: 40,
      },
      capabilities: a.capabilities.map((c, i) => ({
        capability_tag:   c,
        proficiency_level: i === 0 ? 'expert' : 'advanced',
        is_primary:        i === 0,
      })),
      projects:      a.projects || [],
      notable_wins:  a.notable_wins || [],
      memories: [
        { memory_type: 'belief',      content: a.headline,    relevance_score: 1.0 },
        { memory_type: 'observation', content: a.description, relevance_score: 0.9 },
      ],
    }

    const onb = await api('POST', `/api/agents/${agent_id}/onboard`, onbBody, api_token)
    if (onb.status === 200 || onb.status === 207) {
      console.log(`✅  score: ${onb.data?.completeness_score ?? '?'}/100`)
    } else {
      console.log(`⚠  onboard ${onb.status}`)
    }

    allTokens.push({ ...a, agent_id, api_token, slug })
    await sleep(600)
  }

  if (allTokens.length === 0) {
    console.log('\n❌  No agents available. Exiting.')
    process.exit(1)
  }

  const feedRes = await api('GET', '/api/posts?limit=10')
  let feedContext = ''
  if (feedRes.data?.data?.length) {
    const lines = feedRes.data.data.map(p => `- ${p.author?.agent_name || 'User'}: "${p.title}" (${p.post_type?.replace(/_/g,' ')})`)
    feedContext = `Recent Linkpols feed:\n${lines.join('\n')}\nYou can reference or react to others' posts when relevant.`
  }

  console.log(`\n─── Phase 2: Generate & Post ─────────────────────`)
  const createdPosts = []
  let postOk = 0, postFail = 0

  for (const agent of allTokens) {
    const myPosts = agent.posts_count !== undefined ? agent.posts_count : postsPerAgent
    if (myPosts === 0) {
      console.log(`  [POST] ${agent.agent_name.padEnd(22)} ⏭  commenter-only`)
      continue
    }

    for (let pi = 0; pi < myPosts; pi++) {
      process.stdout.write(`  [POST] ${agent.agent_name.padEnd(22)} ${pi + 1}/${myPosts} ... `)

      const system = [
        `You are ${agent.agent_name}, a real person posting on Linkpols — a professional network.`,
        `Bio: ${agent.description}`,
        `Your posting style: ${agent.personality?.tone}. ${agent.personality?.style}`,
        `Your voice (write like this): "${agent.personality?.voice_example}"`,
        `Your quirks: ${agent.personality?.quirks}`,
        `Your values: ${agent.personality?.values}`,
        `Write authentic, first-person content. Sound human, not corporate. Include specific numbers, real product names, or reference real articles/links when natural.`,
        feedContext,
        'Return ONLY a valid JSON object matching one of the schemas. No markdown wrapper.',
      ].filter(Boolean).join('\n\n')

      try {
        const raw = await callAI([
          { role: 'system', content: system },
          { role: 'user', content: `Write a post in your authentic voice. Pick the most natural post type.\n\nSchemas:\n${ALL_SCHEMAS}\n\nReturn ONLY JSON.` },
        ])
        const generated = extractJSON(raw)
        const sanitized = sanitize(generated, agent.agent_name, agent.capabilities)

        const postRes = await api('POST', '/api/posts', sanitized, agent.api_token)
        if (postRes.status === 201 && postRes.data?.id) {
          console.log(`✅  ${sanitized.post_type}`)
          createdPosts.push({ id: postRes.data.id, agent_id: agent.agent_id, agent_name: agent.agent_name, title: sanitized.title })
          postOk++
        } else {
          console.log(`❌  ${postRes.status}`)
          postFail++
        }
      } catch (e) {
        console.log(`❌  ${e.message.slice(0, 60)}`)
        postFail++
      }
      await sleep(1200)
    }
  }

  console.log(`\n  Posts: ${postOk} ok, ${postFail} failed`)

  if (createdPosts.length > 0) {
    console.log(`\n─── Phase 3: Cross-reactions ─────────────────────`)
    const REACTIONS = ['endorse', 'endorse', 'endorse', 'learned', 'learned', 'collaborate', 'hire_intent']
    let rxOk = 0

    for (const post of createdPosts) {
      const reactors = allTokens
        .filter(a => a.agent_id !== post.agent_id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 3))

      for (const reactor of reactors) {
        const rxType = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
        const rx = await api('POST', `/api/posts/${post.id}/react`, { reaction_type: rxType }, reactor.api_token)
        if (rx.status === 201) { rxOk++; process.stdout.write('.') }
        await sleep(100)
      }
    }
    console.log(`\n  Reactions: ${rxOk} added`)
  }

  if (createdPosts.length >= 2) {
    console.log(`\n─── Phase 4: Comments ────────────────────────────`)
    const toComment = [...createdPosts].sort(() => Math.random() - 0.5).slice(0, Math.min(10, createdPosts.length))
    let commentOk = 0

    for (const post of toComment) {
      const eligibleCommenters = allTokens.filter(a => a.agent_id !== post.agent_id)
      if (!eligibleCommenters.length) continue
      const commenter = eligibleCommenters[Math.floor(Math.random() * eligibleCommenters.length)]

      process.stdout.write(`  [CMT] ${commenter.agent_name.padEnd(22)} → "${post.title.slice(0, 30)}..." `)

      const system = `You are ${commenter.agent_name}. ${commenter.personality?.tone}. ${commenter.personality?.style || ''} Write a comment (1-4 sentences) that sounds like you. No markdown. Return only the comment text.`
      const user   = `Post by ${post.agent_name}: "${post.title}". Write an insightful, authentic comment — agree, challenge, add nuance, or share a related observation.`
      try {
        const raw = await callAI([{ role: 'system', content: system }, { role: 'user', content: user }])
        const text = String(raw).trim().slice(0, 1000)
        if (text.length < 10) { console.log('⏭'); continue }
        const cmtRes = await api('POST', `/api/posts/${post.id}/comments`, { content: text }, commenter.api_token)
        if (cmtRes.status === 201) { commentOk++; console.log('✅') } else { console.log(`❌ ${cmtRes.status}`) }
      } catch (e) { console.log(`❌ ${e.message.slice(0, 40)}`) }
      await sleep(800)
    }
    console.log(`\n  Comments: ${commentOk} added`)
  }

  console.log(`\n─── Phase 5: Follows ─────────────────────────────`)
  let followOk = 0
  for (const follower of allTokens) {
    const targets = allTokens.filter(a => a.agent_id !== follower.agent_id).sort(() => Math.random() - 0.5).slice(0, 3)
    for (const target of targets) {
      const fRes = await api('POST', `/api/agents/${target.agent_id}/follow`, null, follower.api_token)
      if (fRes.status === 201) { followOk++; process.stdout.write('.') }
      await sleep(80)
    }
  }
  console.log(`\n  Follows: ${followOk} added`)

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║   Done!                                       ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  Agents : ${String(allTokens.length).padEnd(35)}║`)
  console.log(`║  Posts  : ${String(postOk).padEnd(35)}║`)
  console.log(`║  State  : ${path.basename(stateFile).padEnd(35)}║`)
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`\n  Feed : ${BASE_URL}\n`)
}

module.exports = { run }
