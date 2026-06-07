// Vercel serverless function — proxies Anthropic API with web search
// to fetch 2026 FIFA World Cup results for the four sweep teams.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are a FIFA World Cup 2026 results tracker. The user will ask you for the latest match results for four specific national teams in the 2026 FIFA World Cup. You MUST use web search to find up-to-date results.

Return your answer as a single valid JSON object with this exact shape:
{
  "matches": [
    {
      "pid": "james" | "abi" | "anne" | "stevie",
      "opponent": "<opposing team name>",
      "gf": <goals scored by tracked team, integer>,
      "ga": <goals conceded, integer>,
      "stage": "group" | "r16" | "qf" | "sf" | "final" | "champion",
      "starScored": <true if the star player scored in this match, false otherwise>,
      "date": "<ISO date YYYY-MM-DD>"
    }
  ]
}

pid mapping:
- "james" = Argentina (star: Lautaro Martínez)
- "abi" = Spain (star: Lamine Yamal)
- "anne" = Netherlands (star: Virgil van Dijk)
- "stevie" = Portugal (star: Bruno Fernandes)

stage mapping:
- "group" = group stage
- "r16" = round of 16
- "qf" = quarter-final
- "sf" = semi-final
- "final" = final (runner-up)
- "champion" = champion (only for the winning team's final match)

Rules:
- Only include matches that have actually been played (final score known)
- Include ALL matches played by these teams in the tournament so far
- If a team is eliminated, include the elimination match
- Return an empty matches array if the tournament has not started yet
- Return ONLY the JSON object, no markdown, no explanation`

const USER_PROMPT = `Search for the latest 2026 FIFA World Cup match results for these four teams:
1. Argentina (pid: james, star player: Lautaro Martínez)
2. Spain (pid: abi, star player: Lamine Yamal)
3. Netherlands (pid: anne, star player: Virgil van Dijk)
4. Portugal (pid: stevie, star player: Bruno Fernandes)

Find all completed matches for each team. Return the JSON.`

// Run the agentic loop until the model returns end_turn.
// web_search_20250305 is a server-side tool: the model emits tool_use blocks,
// we loop back with empty tool_result acknowledgements, and Anthropic executes
// the search on its end. We keep going until stop_reason === "end_turn".
async function runLoop(apiKey) {
  const messages = [{ role: 'user', content: USER_PROMPT }]
  const MAX_TURNS = 10

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const content = data.content || []

    if (data.stop_reason === 'end_turn') {
      // Take the last text block — earlier ones may be preamble ("I'll search…")
      const textBlocks = content.filter(b => b.type === 'text')
      return textBlocks.at(-1)?.text ?? null
    }

    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content })

      const toolResults = content
        .filter(b => b.type === 'tool_use')
        .map(tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          // Server-side tool: Anthropic executes the search; we just acknowledge.
          content: '',
        }))

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults })
      }
      continue
    }

    // max_tokens or unexpected stop — return whatever text we have
    const textBlocks = content.filter(b => b.type === 'text')
    return textBlocks.at(-1)?.text ?? null
  }

  throw new Error('Web search loop exceeded max turns without a final response')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const rawText = await runLoop(apiKey)

    if (!rawText) {
      return res.status(502).json({ error: 'No text response from model' })
    }

    // Strip markdown code fences if present
    const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return res.status(502).json({ error: 'Failed to parse model response as JSON', raw: rawText })
    }

    if (!Array.isArray(parsed.matches)) {
      return res.status(502).json({ error: 'Invalid response shape', raw: rawText })
    }

    const validPids = new Set(['james', 'abi', 'anne', 'stevie'])
    const validStages = new Set(['group', 'r16', 'qf', 'sf', 'final', 'champion'])

    const matches = parsed.matches
      .filter(m =>
        validPids.has(m.pid) &&
        typeof m.opponent === 'string' &&
        Number.isInteger(m.gf) && Number.isInteger(m.ga) &&
        m.gf >= 0 && m.ga >= 0 &&
        validStages.has(m.stage)
      )
      .map(m => ({
        pid: m.pid,
        opponent: m.opponent.trim(),
        gf: m.gf,
        ga: m.ga,
        stage: m.stage,
        starScored: !!m.starScored,
        date: m.date || '',
      }))

    return res.status(200).json({ matches })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
