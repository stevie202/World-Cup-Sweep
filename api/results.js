// Vercel serverless function — proxies Anthropic API with web search
// to fetch 2026 FIFA World Cup results, next fixtures, and a daily headline.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are a FIFA World Cup 2026 tracker. Use web search to find current information. Return a single valid JSON object with this exact shape:

{
  "matches": [
    {
      "pid": "james" | "abi" | "anne" | "stevie",
      "opponent": "<opposing team full name>",
      "gf": <goals scored by tracked team in 90+ET mins, integer>,
      "ga": <goals conceded in 90+ET mins, integer>,
      "stage": "group" | "r32" | "r16" | "qf" | "sf" | "final" | "champion",
      "starScored": <true if the star player scored, false otherwise>,
      "date": "<YYYY-MM-DD>",
      "penWin": <true if team won on penalties, false if lost on penalties, omit if not decided by shootout>
    }
  ],
  "nextGames": {
    "james": { "opponent": "<next opponent full name>", "date": "<YYYY-MM-DD>", "kickoff": "<HH:MM in BST>" },
    "abi":   { "opponent": "<next opponent full name>", "date": "<YYYY-MM-DD>", "kickoff": "<HH:MM in BST>" },
    "anne":  { "opponent": "<next opponent full name>", "date": "<YYYY-MM-DD>", "kickoff": "<HH:MM in BST>" },
    "stevie":{ "opponent": "<next opponent full name>", "date": "<YYYY-MM-DD>", "kickoff": "<HH:MM in BST>" }
  },
  "headline": "<single top World Cup 2026 news story from today, 1-2 sentences>",
  "headlineSource": "<news outlet name, e.g. BBC Sport>"
}

pid mapping:
- "james"  = Argentina  (star: Lautaro Martínez)
- "abi"    = Spain      (star: Lamine Yamal)
- "anne"   = Netherlands (star: Virgil van Dijk)
- "stevie" = Portugal   (star: Bruno Fernandes)

stage mapping:
- "group" = group stage  |  "r32" = round of 32  |  "r16" = round of 16  |  "qf" = quarter-final
- "sf" = semi-final  |  "final" = final (runner-up)  |  "champion" = champion

Rules:
- matches: only completed matches with a known final score. Include ALL played so far.
- For knockout matches decided by penalty shootout: gf/ga = score after 90+ET minutes (often tied), penWin = true if the tracked team won the shootout, false if they lost. This is critical — do not omit penWin for any shootout match.
- nextGames: the next SCHEDULED (not yet played) match for each team still in the tournament. Omit a team if they are eliminated or if their next fixture is not yet confirmed. Kickoff must be converted to BST (UTC+1).
- headline: the single most interesting World Cup news story from today or the last 24 hours.
- Return ONLY the JSON — no markdown, no explanation.`

const USER_PROMPT = `Search for the latest 2026 FIFA World Cup information for:
1. Argentina (pid: james, star: Lautaro Martínez)
2. Spain (pid: abi, star: Lamine Yamal)
3. Netherlands (pid: anne, star: Virgil van Dijk)
4. Portugal (pid: stevie, star: Bruno Fernandes)

Find: (a) all completed match results including Round of 32 games — for any match decided by penalty shootout include the regular/ET score AND set penWin correctly, (b) each team's next scheduled fixture with kickoff in BST, (c) today's top World Cup headline. Return the JSON.`

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
      const textBlocks = content.filter(b => b.type === 'text')
      return textBlocks.at(-1)?.text ?? null
    }

    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content })
      const toolResults = content
        .filter(b => b.type === 'tool_use')
        .map(tu => ({ type: 'tool_result', tool_use_id: tu.id, content: '' }))
      if (toolResults.length > 0) messages.push({ role: 'user', content: toolResults })
      continue
    }

    const textBlocks = content.filter(b => b.type === 'text')
    return textBlocks.at(-1)?.text ?? null
  }

  throw new Error('Web search loop exceeded max turns without a final response')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const rawText = await runLoop(apiKey)
    if (!rawText) return res.status(502).json({ error: 'No text response from model' })

    const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : stripped

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return res.status(502).json({ error: 'Failed to parse model response as JSON', raw: rawText })
    }

    if (!Array.isArray(parsed.matches)) {
      return res.status(502).json({ error: 'Invalid response shape', raw: rawText })
    }

    const validPids = new Set(['james', 'abi', 'anne', 'stevie'])
    const validStages = new Set(['group', 'r32', 'r16', 'qf', 'sf', 'final', 'champion'])

    const matches = parsed.matches
      .filter(m =>
        validPids.has(m.pid) &&
        typeof m.opponent === 'string' &&
        Number.isInteger(m.gf) && Number.isInteger(m.ga) &&
        m.gf >= 0 && m.ga >= 0 &&
        validStages.has(m.stage)
      )
      .map(m => {
        const entry = {
          pid: m.pid,
          opponent: m.opponent.trim(),
          gf: m.gf,
          ga: m.ga,
          stage: m.stage,
          starScored: !!m.starScored,
          date: m.date || '',
        }
        if (m.penWin === true || m.penWin === false) entry.penWin = m.penWin
        return entry
      })

    // Pass through nextGames, validating each entry
    const nextGames = {}
    if (parsed.nextGames && typeof parsed.nextGames === 'object') {
      for (const pid of validPids) {
        const ng = parsed.nextGames[pid]
        if (ng && typeof ng.opponent === 'string' && ng.opponent.trim()) {
          nextGames[pid] = {
            opponent: ng.opponent.trim(),
            date: ng.date || '',
            kickoff: ng.kickoff || '',
          }
        }
      }
    }

    const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : ''
    const headlineSource = typeof parsed.headlineSource === 'string' ? parsed.headlineSource.trim() : ''

    return res.status(200).json({ matches, nextGames, headline, headlineSource })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
