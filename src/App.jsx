import { useState, useEffect, useCallback } from 'react'

// ─── PLAYERS ────────────────────────────────────────────────────────────────

const PLAYERS = [
  {
    id: 'james',
    name: 'James',
    team: 'Argentina',
    flag: '🇦🇷',
    accent: '#43A8FF',
    starPlayer: 'Lautaro Martínez',
    bonusMetric: 'Hat-tricks',
  },
  {
    id: 'abi',
    name: 'Abi',
    team: 'Spain',
    flag: '🇪🇸',
    accent: '#FF4343',
    starPlayer: 'Lamine Yamal',
    bonusMetric: 'Assists',
  },
  {
    id: 'anne',
    name: 'Anne',
    team: 'Netherlands',
    flag: '🇳🇱',
    accent: '#FF8C00',
    starPlayer: 'Virgil van Dijk',
    bonusMetric: 'Defensive actions',
  },
  {
    id: 'stevie',
    name: 'Stevie',
    team: 'Portugal',
    flag: '🇵🇹',
    accent: '#2ECC71',
    starPlayer: 'Bruno Fernandes',
    bonusMetric: 'Key passes',
  },
]

// ─── STAGE CONFIG ────────────────────────────────────────────────────────────

const STAGES = {
  group: { label: 'Group Stage', rank: 0 },
  r16: { label: 'Round of 16', rank: 3 },
  qf: { label: 'Quarter-Final', rank: 5 },
  sf: { label: 'Semi-Final', rank: 8 },
  final: { label: 'Final', rank: 12 },
  champion: { label: 'Champion', rank: 20 },
}

const STAGE_BONUS = {
  group: 0,
  r16: 3,
  qf: 5,
  sf: 8,
  final: 12,
  champion: 20,
}

// ─── SCORING ─────────────────────────────────────────────────────────────────

function computeMatchPoints(match) {
  const { gf, ga, stage, starScored } = match
  let pts = 0

  // Result
  if (gf > ga) pts += 3
  else if (gf === ga) pts += 1
  // loss = 0

  // Goals scored bonus
  pts += gf

  // Clean sheet
  if (ga === 0) pts += 1

  // Stage bonus (one-time per stage advance, tracked in aggregation)
  // Star bonus
  if (starScored) pts += 3

  return pts
}

function aggregatePlayer(pid, matches) {
  const playerMatches = matches.filter(m => m.pid === pid)
  let totalPts = 0
  let gf = 0
  let ga = 0
  let stagesReached = new Set()

  for (const m of playerMatches) {
    totalPts += computeMatchPoints(m)
    gf += m.gf
    ga += m.ga
    if (m.stage && m.stage !== 'group') {
      stagesReached.add(m.stage)
    }
  }

  // Stage bonuses (each stage reached once)
  let stageBonus = 0
  for (const s of stagesReached) {
    stageBonus += STAGE_BONUS[s] || 0
  }
  totalPts += stageBonus

  // Current stage = highest reached
  let currentStageRank = 0
  let currentStage = 'group'
  for (const m of playerMatches) {
    const rank = STAGES[m.stage]?.rank ?? 0
    if (rank > currentStageRank) {
      currentStageRank = rank
      currentStage = m.stage
    }
  }

  return { pid, totalPts, gf, ga, currentStage, currentStageRank, matchCount: playerMatches.length }
}

function buildLeaderboard(matches) {
  return PLAYERS
    .map(p => {
      const agg = aggregatePlayer(p.id, matches)
      return { ...p, ...agg }
    })
    .sort((a, b) => {
      if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts
      if (b.currentStageRank !== a.currentStageRank) return b.currentStageRank - a.currentStageRank
      if (a.ga !== b.ga) return a.ga - b.ga
      return b.gf - a.gf
    })
}

// ─── FINGERPRINT ─────────────────────────────────────────────────────────────

function fingerprint(m) {
  return `${m.pid}|${m.opponent}|${m.gf}-${m.ga}`
}

// ─── LOCAL STORAGE ───────────────────────────────────────────────────────────

const LS_MATCHES = 'wcs_matches'
const LS_DISMISSED = 'wcs_dismissed'
const LS_LAST_FETCH = 'wcs_last_fetch'
const FETCH_THROTTLE_MS = 20 * 60 * 60 * 1000 // 20 hours

function loadMatches() {
  try { return JSON.parse(localStorage.getItem(LS_MATCHES)) || [] } catch { return [] }
}
function saveMatches(m) { localStorage.setItem(LS_MATCHES, JSON.stringify(m)) }

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED)) || []) } catch { return new Set() }
}
function saveDismissed(s) { localStorage.setItem(LS_DISMISSED, JSON.stringify([...s])) }

function getLastFetch() {
  try { return parseInt(localStorage.getItem(LS_LAST_FETCH) || '0', 10) } catch { return 0 }
}
function setLastFetch(ts) { localStorage.setItem(LS_LAST_FETCH, String(ts)) }

// ─── STYLES ──────────────────────────────────────────────────────────────────

const css = {
  app: {
    minHeight: '100vh',
    background: '#0a0d12',
    color: '#e8ecf4',
    padding: '0 0 80px',
  },
  header: {
    background: 'linear-gradient(180deg, #0d1525 0%, #0a0d12 100%)',
    borderBottom: '1px solid #1e2d4a',
    padding: '24px 20px 20px',
    textAlign: 'center',
  },
  title: {
    fontFamily: 'Anton, sans-serif',
    fontSize: 'clamp(28px, 6vw, 48px)',
    letterSpacing: '0.04em',
    color: '#e8ecf4',
    lineHeight: 1.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#4a6080',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginTop: '6px',
  },
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '0 16px',
  },
  section: {
    marginTop: '28px',
  },
  sectionLabel: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#4a6080',
    marginBottom: '10px',
    paddingLeft: '2px',
  },
  leaderboardCard: (rank) => ({
    background: rank === 0 ? '#111a2a' : '#0f1520',
    border: `1px solid ${rank === 0 ? '#2a3f5e' : '#181f30'}`,
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'border-color 0.15s',
  }),
  rankNum: (rank) => ({
    fontFamily: 'Anton, sans-serif',
    fontSize: rank === 0 ? '22px' : '18px',
    color: rank === 0 ? '#e8ecf4' : '#3d4f6e',
    width: '26px',
    textAlign: 'right',
    flexShrink: 0,
  }),
  accentBar: (color) => ({
    width: '3px',
    height: '42px',
    borderRadius: '2px',
    background: color,
    flexShrink: 0,
    opacity: 0.85,
  }),
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: 'Anton, sans-serif',
    fontSize: '17px',
    letterSpacing: '0.03em',
    lineHeight: 1,
  },
  playerTeam: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#4a6080',
    marginTop: '3px',
  },
  stageBadge: (color) => ({
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '10px',
    letterSpacing: '0.08em',
    padding: '2px 7px',
    borderRadius: '4px',
    background: color + '18',
    border: `1px solid ${color}35`,
    color: color,
    marginTop: '4px',
    display: 'inline-block',
  }),
  statsRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    flexShrink: 0,
  },
  statBlock: {
    textAlign: 'center',
  },
  statVal: {
    fontFamily: 'Anton, sans-serif',
    fontSize: '22px',
    lineHeight: 1,
    color: '#e8ecf4',
  },
  statLabel: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '9px',
    color: '#4a6080',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginTop: '2px',
  },
  divider: {
    width: '1px',
    height: '30px',
    background: '#1e2d4a',
  },
  fetchRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  btn: (variant = 'default') => {
    const base = {
      fontFamily: 'Archivo, sans-serif',
      fontWeight: 600,
      fontSize: '13px',
      padding: '9px 18px',
      borderRadius: '7px',
      border: 'none',
      cursor: 'pointer',
      letterSpacing: '0.01em',
      transition: 'opacity 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }
    if (variant === 'primary') return { ...base, background: '#1d4ed8', color: '#fff' }
    if (variant === 'ghost') return { ...base, background: 'transparent', color: '#4a6080', border: '1px solid #1e2d4a' }
    if (variant === 'accept') return { ...base, background: '#166534', color: '#86efac' }
    if (variant === 'dismiss') return { ...base, background: '#1f1520', color: '#9a7a8a', border: '1px solid #2a1f2a' }
    if (variant === 'danger') return { ...base, background: '#7f1d1d', color: '#fca5a5' }
    return { ...base, background: '#1a2030', color: '#e8ecf4', border: '1px solid #2a3348' }
  },
  fetchStatus: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#4a6080',
    padding: '4px 0',
  },
  suggestionCard: (accent) => ({
    background: '#0f1520',
    border: `1px solid ${accent}30`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '10px',
  }),
  sugHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  sugFlag: {
    fontSize: '20px',
  },
  sugTeam: {
    fontFamily: 'Anton, sans-serif',
    fontSize: '15px',
    letterSpacing: '0.03em',
    flex: 1,
  },
  sugStage: (accent) => ({
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '10px',
    color: accent,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    opacity: 0.8,
  }),
  sugScore: {
    fontFamily: 'Anton, sans-serif',
    fontSize: '28px',
    letterSpacing: '0.04em',
    marginBottom: '4px',
    color: '#e8ecf4',
  },
  sugOpponent: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#4a6080',
    marginBottom: '12px',
  },
  sugMeta: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#3d5070',
    marginBottom: '12px',
  },
  sugActions: {
    display: 'flex',
    gap: '8px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#111620',
    border: '1px solid #2a3348',
    borderRadius: '14px',
    padding: '24px',
    width: '100%',
    maxWidth: '440px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: 'Anton, sans-serif',
    fontSize: '20px',
    letterSpacing: '0.03em',
    marginBottom: '20px',
    color: '#e8ecf4',
  },
  formGroup: {
    marginBottom: '14px',
  },
  label: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '10px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#4a6080',
    display: 'block',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: '#0d1320',
    border: '1px solid #2a3348',
    borderRadius: '7px',
    color: '#e8ecf4',
    fontSize: '14px',
    padding: '9px 12px',
    outline: 'none',
  },
  select: {
    width: '100%',
    background: '#0d1320',
    border: '1px solid #2a3348',
    borderRadius: '7px',
    color: '#e8ecf4',
    fontSize: '14px',
    padding: '9px 12px',
    outline: 'none',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#a0b0cc',
    userSelect: 'none',
  },
  formActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '20px',
    justifyContent: 'flex-end',
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '7px',
    background: '#0d1320',
    marginBottom: '6px',
    fontSize: '13px',
  },
  matchScore: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontWeight: 600,
    fontSize: '14px',
    minWidth: '40px',
    textAlign: 'center',
  },
  matchMeta: {
    flex: 1,
    color: '#4a6080',
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#4a2a2a',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
  emptyState: {
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '12px',
    color: '#2a3a50',
    textAlign: 'center',
    padding: '32px 16px',
    letterSpacing: '0.05em',
  },
  tabRow: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid #1a2030',
    marginBottom: '20px',
  },
  tab: (active) => ({
    fontFamily: 'Archivo, sans-serif',
    fontWeight: 600,
    fontSize: '13px',
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    color: active ? '#e8ecf4' : '#3d4f6e',
    borderBottom: active ? '2px solid #4a8fff' : '2px solid transparent',
    cursor: 'pointer',
    marginBottom: '-1px',
    letterSpacing: '0.01em',
  }),
  errorBox: {
    background: '#1f0a0a',
    border: '1px solid #5a1a1a',
    borderRadius: '8px',
    padding: '12px 16px',
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '12px',
    color: '#f87171',
    marginTop: '10px',
  },
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function playerByPid(pid) {
  return PLAYERS.find(p => p.id === pid)
}

function stageLabel(s) {
  return STAGES[s]?.label || s
}

function fmtPoints(n) {
  return n === 1 ? '1 pt' : `${n} pts`
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [matches, setMatches] = useState(loadMatches)
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [suggestions, setSuggestions] = useState([])
  const [fetchState, setFetchState] = useState('idle') // idle | loading | done | error
  const [fetchError, setFetchError] = useState('')
  const [lastFetch, setLastFetchState] = useState(getLastFetch)
  const [tab, setTab] = useState('leaderboard') // leaderboard | matches
  const [addModal, setAddModal] = useState(null) // null | { prefill }
  const [editModal, setEditModal] = useState(null) // null | match object

  // Persist
  useEffect(() => { saveMatches(matches) }, [matches])
  useEffect(() => { saveDismissed(dismissed) }, [dismissed])

  const leaderboard = buildLeaderboard(matches)

  // ── Auto-fetch on load ───────────────────────────────────────────────────
  useEffect(() => {
    const elapsed = Date.now() - getLastFetch()
    if (elapsed > FETCH_THROTTLE_MS) {
      fetchSuggestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSuggestions = useCallback(async () => {
    setFetchState('loading')
    setFetchError('')
    try {
      const res = await fetch('/api/results')
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const now = Date.now()
      setLastFetch(now)
      setLastFetchState(now)

      // Filter out already-confirmed matches and dismissed suggestions
      const pending = (data.matches || []).filter(m => {
        const fp = fingerprint(m)
        return !dismissed.has(fp) && !matches.some(ex => fingerprint(ex) === fp)
      })
      setSuggestions(pending)
      setFetchState('done')
    } catch (e) {
      setFetchError(e.message)
      setFetchState('error')
    }
  }, [dismissed, matches])

  const acceptSuggestion = (sug) => {
    const match = {
      id: crypto.randomUUID(),
      pid: sug.pid,
      opponent: sug.opponent,
      gf: sug.gf,
      ga: sug.ga,
      stage: sug.stage,
      starScored: sug.starScored || false,
      date: sug.date || new Date().toISOString().slice(0, 10),
    }
    setMatches(prev => [...prev, match])
    setSuggestions(prev => prev.filter(s => fingerprint(s) !== fingerprint(sug)))
  }

  const dismissSuggestion = (sug) => {
    const fp = fingerprint(sug)
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(fp)
      return next
    })
    setSuggestions(prev => prev.filter(s => fingerprint(s) !== fp))
  }

  const deleteMatch = (id) => {
    setMatches(prev => prev.filter(m => m.id !== id))
  }

  const saveMatch = (matchData) => {
    if (matchData.id) {
      setMatches(prev => prev.map(m => m.id === matchData.id ? matchData : m))
    } else {
      setMatches(prev => [...prev, { ...matchData, id: crypto.randomUUID() }])
    }
    setAddModal(null)
    setEditModal(null)
  }

  const secondsSinceLastFetch = Math.floor((Date.now() - lastFetch) / 1000)
  const canFetch = fetchState !== 'loading'

  return (
    <div style={css.app}>
      <header style={css.header}>
        <div style={css.title}>World Cup Sweep</div>
        <div style={css.subtitle}>FIFA World Cup 2026 · Family Sweepstake</div>
      </header>

      <div style={css.container}>
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div style={css.section}>
            <div style={css.sectionLabel}>New Results — Confirm or Dismiss</div>
            {suggestions.map((sug, i) => (
              <SuggestionCard
                key={i}
                sug={sug}
                onAccept={() => acceptSuggestion(sug)}
                onDismiss={() => dismissSuggestion(sug)}
              />
            ))}
          </div>
        )}

        {/* Fetch controls */}
        <div style={{ ...css.section }}>
          <div style={css.fetchRow}>
            <button
              style={css.btn('primary')}
              onClick={fetchSuggestions}
              disabled={!canFetch}
            >
              {fetchState === 'loading' ? '⏳ Fetching…' : '⚡ Fetch Latest Results'}
            </button>
            <button
              style={css.btn('ghost')}
              onClick={() => setAddModal({})}
            >
              + Add Match
            </button>
            {lastFetch > 0 && (
              <span style={css.fetchStatus}>
                Last fetch {formatAge(secondsSinceLastFetch)} ago
              </span>
            )}
          </div>
          {fetchState === 'error' && (
            <div style={css.errorBox}>Error: {fetchError}</div>
          )}
          {fetchState === 'done' && suggestions.length === 0 && (
            <div style={{ ...css.fetchStatus, marginTop: '8px' }}>
              No new results found.
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ ...css.section, marginTop: '24px' }}>
          <div style={css.tabRow}>
            <button style={css.tab(tab === 'leaderboard')} onClick={() => setTab('leaderboard')}>
              Leaderboard
            </button>
            <button style={css.tab(tab === 'matches')} onClick={() => setTab('matches')}>
              Matches ({matches.length})
            </button>
          </div>

          {tab === 'leaderboard' && (
            <LeaderboardTab leaderboard={leaderboard} />
          )}
          {tab === 'matches' && (
            <MatchesTab
              matches={matches}
              onDelete={deleteMatch}
              onEdit={(m) => setEditModal(m)}
              onAdd={() => setAddModal({})}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {(addModal !== null || editModal !== null) && (
        <MatchModal
          match={editModal || addModal}
          onSave={saveMatch}
          onClose={() => { setAddModal(null); setEditModal(null) }}
        />
      )}
    </div>
  )
}

// ─── LEADERBOARD TAB ─────────────────────────────────────────────────────────

function LeaderboardTab({ leaderboard }) {
  return (
    <div>
      {leaderboard.map((p, i) => (
        <LeaderboardRow key={p.id} player={p} rank={i} />
      ))}
    </div>
  )
}

function LeaderboardRow({ player, rank }) {
  const { accent, flag, name, team, totalPts, gf, ga, currentStage, matchCount } = player
  return (
    <div style={css.leaderboardCard(rank)}>
      <div style={css.rankNum(rank)}>
        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
      </div>
      <div style={css.accentBar(accent)} />
      <div style={css.playerInfo}>
        <div style={{ ...css.playerName, color: accent }}>{flag} {name}</div>
        <div style={css.playerTeam}>{team}</div>
        <div style={css.stageBadge(accent)}>{stageLabel(currentStage)}</div>
      </div>
      <div style={css.statsRow}>
        <div style={css.statBlock}>
          <div style={css.statVal}>{totalPts}</div>
          <div style={css.statLabel}>PTS</div>
        </div>
        <div style={css.divider} />
        <div style={css.statBlock}>
          <div style={{ ...css.statVal, fontSize: '16px', color: '#6b8fcc' }}>{gf}</div>
          <div style={css.statLabel}>GF</div>
        </div>
        <div style={css.statBlock}>
          <div style={{ ...css.statVal, fontSize: '16px', color: '#6b8fcc' }}>{ga}</div>
          <div style={css.statLabel}>GA</div>
        </div>
        <div style={css.statBlock}>
          <div style={{ ...css.statVal, fontSize: '16px', color: '#4a6080' }}>{matchCount}</div>
          <div style={css.statLabel}>GP</div>
        </div>
      </div>
    </div>
  )
}

// ─── MATCHES TAB ─────────────────────────────────────────────────────────────

function MatchesTab({ matches, onDelete, onEdit, onAdd }) {
  if (matches.length === 0) {
    return (
      <div style={css.emptyState}>
        No matches recorded yet.<br />
        <button style={{ ...css.btn('ghost'), marginTop: '16px' }} onClick={onAdd}>
          + Add first match
        </button>
      </div>
    )
  }

  // Group by player
  const byPlayer = PLAYERS.map(p => ({
    player: p,
    matches: matches.filter(m => m.pid === p.id).sort((a, b) => b.date?.localeCompare(a.date || '') || 0),
  })).filter(g => g.matches.length > 0)

  return (
    <div>
      {byPlayer.map(({ player, matches: pm }) => (
        <div key={player.id} style={{ marginBottom: '24px' }}>
          <div style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: '14px',
            letterSpacing: '0.06em',
            color: player.accent,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {player.flag} {player.name.toUpperCase()} · {player.team}
          </div>
          {pm.map(m => (
            <MatchRow key={m.id} match={m} player={player} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      ))}
    </div>
  )
}

function MatchRow({ match, player, onDelete, onEdit }) {
  const result = match.gf > match.ga ? 'W' : match.gf === match.ga ? 'D' : 'L'
  const resultColor = result === 'W' ? '#4ade80' : result === 'D' ? '#facc15' : '#f87171'
  const pts = computeMatchPoints(match)

  return (
    <div style={css.matchRow}>
      <div style={{
        fontFamily: 'Spline Sans Mono, monospace',
        fontWeight: 700,
        fontSize: '12px',
        color: resultColor,
        width: '16px',
        textAlign: 'center',
        flexShrink: 0,
      }}>{result}</div>
      <div style={{
        ...css.matchScore,
        color: player.accent,
      }}>{match.gf}–{match.ga}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#c0cce0' }}>
          vs {match.opponent}
          {match.starScored && (
            <span style={{ color: '#facc15', marginLeft: '6px', fontSize: '12px' }}>★</span>
          )}
        </div>
        <div style={css.matchMeta}>{stageLabel(match.stage)} · {match.date}</div>
      </div>
      <div style={{
        fontFamily: 'Spline Sans Mono, monospace',
        fontSize: '11px',
        color: '#4a6080',
        flexShrink: 0,
      }}>{fmtPoints(pts)}</div>
      <button
        style={css.btn('ghost')}
        onClick={() => onEdit(match)}
        title="Edit"
      >
        ✏️
      </button>
      <button
        style={css.deleteBtn}
        onClick={() => onDelete(match.id)}
        title="Delete"
      >
        ×
      </button>
    </div>
  )
}

// ─── SUGGESTION CARD ─────────────────────────────────────────────────────────

function SuggestionCard({ sug, onAccept, onDismiss }) {
  const player = playerByPid(sug.pid)
  if (!player) return null
  const result = sug.gf > sug.ga ? 'WIN' : sug.gf === sug.ga ? 'DRAW' : 'LOSS'
  const pts = computeMatchPoints(sug)

  return (
    <div style={css.suggestionCard(player.accent)}>
      <div style={css.sugHeader}>
        <span style={css.sugFlag}>{player.flag}</span>
        <span style={{ ...css.sugTeam, color: player.accent }}>{player.name} · {player.team}</span>
        <span style={css.sugStage(player.accent)}>{stageLabel(sug.stage)}</span>
      </div>
      <div style={css.sugScore}>{sug.gf} – {sug.ga}</div>
      <div style={css.sugOpponent}>vs {sug.opponent}</div>
      <div style={css.sugMeta}>
        {result} · +{pts} pts
        {sug.starScored ? ' · ★ star scored' : ''}
        {sug.date ? ` · ${sug.date}` : ''}
      </div>
      <div style={css.sugActions}>
        <button style={css.btn('accept')} onClick={onAccept}>✓ Accept</button>
        <button style={css.btn('dismiss')} onClick={onDismiss}>✕ Dismiss</button>
      </div>
    </div>
  )
}

// ─── MATCH MODAL ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  pid: 'james',
  opponent: '',
  gf: 0,
  ga: 0,
  stage: 'group',
  starScored: false,
  date: new Date().toISOString().slice(0, 10),
}

function MatchModal({ match, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...match })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.opponent.trim()) return
    onSave({
      ...form,
      gf: parseInt(form.gf, 10) || 0,
      ga: parseInt(form.ga, 10) || 0,
    })
  }

  const player = playerByPid(form.pid)

  return (
    <div style={css.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={css.modal}>
        <div style={css.modalTitle}>
          {form.id ? 'Edit Match' : 'Add Match'}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={css.formGroup}>
            <label style={css.label}>Player</label>
            <select
              style={css.select}
              value={form.pid}
              onChange={e => set('pid', e.target.value)}
            >
              {PLAYERS.map(p => (
                <option key={p.id} value={p.id}>{p.flag} {p.name} · {p.team}</option>
              ))}
            </select>
          </div>

          <div style={css.formGroup}>
            <label style={css.label}>Opponent</label>
            <input
              style={css.input}
              type="text"
              value={form.opponent}
              onChange={e => set('opponent', e.target.value)}
              placeholder="e.g. Brazil"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...css.formGroup, flex: 1 }}>
              <label style={css.label}>{player?.team} Goals</label>
              <input
                style={css.input}
                type="number"
                min="0"
                max="20"
                value={form.gf}
                onChange={e => set('gf', e.target.value)}
              />
            </div>
            <div style={{ ...css.formGroup, flex: 1 }}>
              <label style={css.label}>Opponent Goals</label>
              <input
                style={css.input}
                type="number"
                min="0"
                max="20"
                value={form.ga}
                onChange={e => set('ga', e.target.value)}
              />
            </div>
          </div>

          <div style={css.formGroup}>
            <label style={css.label}>Stage</label>
            <select
              style={css.select}
              value={form.stage}
              onChange={e => set('stage', e.target.value)}
            >
              {Object.entries(STAGES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={css.formGroup}>
            <label style={css.label}>Date</label>
            <input
              style={css.input}
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          <div style={css.formGroup}>
            <label style={css.checkbox}>
              <input
                type="checkbox"
                checked={form.starScored}
                onChange={e => set('starScored', e.target.checked)}
              />
              <span>★ Star player scored (+3 pts) — {player?.starPlayer}</span>
            </label>
          </div>

          <div style={css.formActions}>
            <button type="button" style={css.btn('ghost')} onClick={onClose}>Cancel</button>
            <button type="submit" style={css.btn('primary')}>
              {form.id ? 'Save Changes' : 'Add Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatAge(seconds) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
