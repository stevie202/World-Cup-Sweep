// Vercel serverless function — proxies Anthropic API with web search
// to fetch 2026 FIFA World Cup results for the four sweep teams.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

const TEAMS = {
  james: 'Argentina',
  abi: 'Spain',
  anne: 'Netherlands',
  stevie: 'Portugal',
}

const STAR_PLAYERS = {
  james: 'Lautaro Martínez',
  abi: 'Lamine Yamal',
  anne: 'Virgil van Dijk',
  stevie: 'Bruno Fernandes',
}

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        messages: [
          { role: 'user', content: USER_PROMPT },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(502).json({ error: `Anthropic API error: ${response.status}`, detail: errText })
    }

    const data = await response.json()

    // Extract text content from the response
    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock) {
      return res.status(502).json({ error: 'No text response from model' })
    }

    // Parse JSON from response text
    let parsed
    try {
      // Strip any markdown code fences if present
      const raw = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
      parsed = JSON.parse(raw)
    } catch (e) {
      return res.status(502).json({ error: 'Failed to parse model response as JSON', raw: textBlock.text })
    }

    // Validate structure
    if (!Array.isArray(parsed.matches)) {
      return res.status(502).json({ error: 'Invalid response shape', raw: textBlock.text })
    }

    // Sanitise and validate each match
    const validPids = new Set(['james', 'abi', 'anne', 'stevie'])
    const validStages = new Set(['group', 'r16', 'qf', 'sf', 'final', 'champion'])

    const matches = parsed.matches
      .filter(m =>
        validPids.has(m.pid) &&
        typeof m.opponent === 'string' &&
        Number.isInteger(m.gf) &&
        Number.isInteger(m.ga) &&
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
