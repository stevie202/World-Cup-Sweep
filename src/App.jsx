import { useState, useEffect, useCallback } from 'react'
import LZString from 'lz-string'

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
  const { gf, ga, starScored } = match
  let pts = 0
  if (gf > ga) pts += 3
  else if (gf === ga) pts += 1
  pts += gf
  if (ga === 0) pts += 1
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
    if (m.stage && m.stage !== 'group') stagesReached.add(m.stage)
  }

  let stageBonus = 0
  for (const s of stagesReached) stageBonus += STAGE_BONUS[s] || 0
  totalPts += stageBonus

  let currentStageRank = 0
  let currentStage = 'group'
  for (const m of playerMatches) {
    const rank = STAGES[m.stage]?.rank ?? 0
    if (rank > currentStageRank) { currentStageRank = rank; currentStage = m.stage }
  }

  return { pid, totalPts, gf, ga, currentStage, currentStageRank, matchCount: playerMatches.length }
}

function buildLeaderboard(matches) {
  return PLAYERS
    .map(p => ({ ...p, ...aggregatePlayer(p.id, matches) }))
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

// ─── COUNTRY FLAGS ────────────────────────────────────────────────────────────

const COUNTRY_FLAGS = {
  // South America
  'Argentina': '🇦🇷', 'ARG': '🇦🇷',
  'Brazil': '🇧🇷', 'BRA': '🇧🇷',
  'Uruguay': '🇺🇾', 'URU': '🇺🇾',
  'Colombia': '🇨🇴', 'COL': '🇨🇴',
  'Ecuador': '🇪🇨', 'ECU': '🇪🇨',
  'Chile': '🇨🇱', 'CHI': '🇨🇱',
  'Peru': '🇵🇪', 'PER': '🇵🇪',
  'Paraguay': '🇵🇾', 'PAR': '🇵🇾',
  'Bolivia': '🇧🇴', 'BOL': '🇧🇴',
  'Venezuela': '🇻🇪', 'VEN': '🇻🇪',
  // North & Central America
  'Mexico': '🇲🇽', 'MEX': '🇲🇽',
  'USA': '🇺🇸', 'United States': '🇺🇸', 'US': '🇺🇸',
  'Canada': '🇨🇦', 'CAN': '🇨🇦',
  'Costa Rica': '🇨🇷', 'CRC': '🇨🇷',
  'Honduras': '🇭🇳', 'HON': '🇭🇳',
  'Panama': '🇵🇦', 'PAN': '🇵🇦',
  'Jamaica': '🇯🇲', 'JAM': '🇯🇲',
  // Europe
  'Spain': '🇪🇸', 'ESP': '🇪🇸',
  'France': '🇫🇷', 'FRA': '🇫🇷',
  'Germany': '🇩🇪', 'GER': '🇩🇪',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'POR': '🇵🇹',
  'Netherlands': '🇳🇱', 'NED': '🇳🇱', 'Holland': '🇳🇱',
  'Belgium': '🇧🇪', 'BEL': '🇧🇪',
  'Italy': '🇮🇹', 'ITA': '🇮🇹',
  'Croatia': '🇭🇷', 'CRO': '🇭🇷',
  'Switzerland': '🇨🇭', 'SUI': '🇨🇭',
  'Denmark': '🇩🇰', 'DEN': '🇩🇰',
  'Austria': '🇦🇹', 'AUT': '🇦🇹',
  'Poland': '🇵🇱', 'POL': '🇵🇱',
  'Czech Republic': '🇨🇿', 'CZE': '🇨🇿',
  'Serbia': '🇷🇸', 'SRB': '🇷🇸',
  'Ukraine': '🇺🇦', 'UKR': '🇺🇦',
  'Hungary': '🇭🇺', 'HUN': '🇭🇺',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Turkey': '🇹🇷', 'TUR': '🇹🇷', 'Türkiye': '🇹🇷',
  'Romania': '🇷🇴', 'ROU': '🇷🇴',
  'Slovakia': '🇸🇰', 'SVK': '🇸🇰',
  'Slovenia': '🇸🇮', 'SVN': '🇸🇮',
  'Albania': '🇦🇱', 'ALB': '🇦🇱',
  'Georgia': '🇬🇪', 'GEO': '🇬🇪',
  'Greece': '🇬🇷', 'GRE': '🇬🇷',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Norway': '🇳🇴', 'NOR': '🇳🇴',
  'Sweden': '🇸🇪', 'SWE': '🇸🇪',
  // Africa
  'Morocco': '🇲🇦', 'MAR': '🇲🇦',
  'Senegal': '🇸🇳', 'SEN': '🇸🇳',
  'Egypt': '🇪🇬', 'EGY': '🇪🇬',
  'Nigeria': '🇳🇬', 'NGA': '🇳🇬',
  "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮', 'CIV': '🇨🇮',
  'Ghana': '🇬🇭', 'GHA': '🇬🇭',
  'Cameroon': '🇨🇲', 'CMR': '🇨🇲',
  'South Africa': '🇿🇦', 'RSA': '🇿🇦',
  'Tunisia': '🇹🇳', 'TUN': '🇹🇳',
  'Algeria': '🇩🇿', 'ALG': '🇩🇿',
  'Mali': '🇲🇱', 'MLI': '🇲🇱',
  'DR Congo': '🇨🇩', 'COD': '🇨🇩',
  // Asia / Oceania
  'Japan': '🇯🇵', 'JPN': '🇯🇵',
  'South Korea': '🇰🇷', 'KOR': '🇰🇷',
  'Iran': '🇮🇷', 'IRN': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'KSA': '🇸🇦',
  'Qatar': '🇶🇦', 'QAT': '🇶🇦',
  'Australia': '🇦🇺', 'AUS': '🇦🇺',
  'New Zealand': '🇳🇿', 'NZL': '🇳🇿',
  'China': '🇨🇳', 'CHN': '🇨🇳',
  'Indonesia': '🇮🇩', 'IDN': '🇮🇩',
  'Iraq': '🇮🇶', 'IRQ': '🇮🇶',
  'Jordan': '🇯🇴', 'JOR': '🇯🇴',
  'Uzbekistan': '🇺🇿', 'UZB': '🇺🇿',
  'Bahrain': '🇧🇭', 'BHR': '🇧🇭',
  'Oman': '🇴🇲', 'OMA': '🇴🇲',
}

function countryFlag(name) {
  if (!name) return ''
  return COUNTRY_FLAGS[name] || COUNTRY_FLAGS[name.toUpperCase()] || ''
}

// ─── LOCAL STORAGE ───────────────────────────────────────────────────────────

const LS_MATCHES = 'wcs_matches'
const LS_DISMISSED = 'wcs_dismissed'
const LS_LAST_FETCH = 'wcs_last_fetch'
const FETCH_THROTTLE_MS = 20 * 60 * 60 * 1000

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

// ─── SHARING ─────────────────────────────────────────────────────────────────

function encodeSharePayload(matches) {
  const payload = {
    ts: Date.now(),
    matches: matches.map(({ pid, opponent, gf, ga, stage, starScored, date }) => ({
      pid, opponent, gf, ga, stage, starScored, date,
    })),
  }
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

function decodeSharePayload(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    return null
  }
}

function buildShareURL(matches) {
  const encoded = encodeSharePayload(matches)
  const base = window.location.origin + window.location.pathname
  return `${base}#/view?d=${encoded}`
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// ─── HASH ROUTER ─────────────────────────────────────────────────────────────

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (hash.startsWith('#/view')) {
    const qmark = hash.indexOf('?')
    const search = qmark >= 0 ? hash.slice(qmark + 1) : ''
    const params = new URLSearchParams(search)
    return { route: 'view', d: params.get('d') }
  }

  return { route: 'main', d: null }
}

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
    if (variant === 'share') return { ...base, background: '#1a2a1a', color: '#4ade80', border: '1px solid #2a4a2a' }
    if (variant === 'share-done') return { ...base, background: '#166534', color: '#86efac', border: 'none' }
    if (variant === 'share-warn') return { ...base, background: '#3a2800', color: '#fbbf24', border: '1px solid #5a4000' }
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
  sugFlag: { fontSize: '20px' },
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
  sugActions: { display: 'flex', gap: '8px' },
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
  formGroup: { marginBottom: '14px' },
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
  readonlyBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: '#0d1a0d',
    border: '1px solid #1a3a1a',
    borderRadius: '8px',
    padding: '7px 14px',
    marginTop: '14px',
    fontFamily: 'Spline Sans Mono, monospace',
    fontSize: '11px',
    color: '#4ade80',
    letterSpacing: '0.05em',
  },
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function playerByPid(pid) { return PLAYERS.find(p => p.id === pid) }
function stageLabel(s) { return STAGES[s]?.label || s }
function fmtPoints(n) { return n === 1 ? '1 pt' : `${n} pts` }

// ─── INFO CARD ────────────────────────────────────────────────────────────────

const INFO_CARD_THEMES = {
  error:   { bg: '#1a0a0a', border: '#7f1d1d', accent: '#f87171', icon: '⚠' },
  warning: { bg: '#1a1200', border: '#78350f', accent: '#fbbf24', icon: '⚠' },
  info:    { bg: '#0a1020', border: '#1e3a6e', accent: '#60a5fa', icon: 'ℹ' },
  success: { bg: '#071a10', border: '#166534', accent: '#4ade80', icon: '✓' },
}

function InfoCard({ type = 'error', title, message, style }) {
  const t = INFO_CARD_THEMES[type] || INFO_CARD_THEMES.error
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.accent}`,
      borderRadius: '10px',
      padding: '14px 16px',
      marginTop: '12px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      ...style,
    }}>
      <span style={{
        fontSize: '17px',
        lineHeight: 1,
        flexShrink: 0,
        marginTop: '1px',
        color: t.accent,
      }}>{t.icon}</span>
      <div style={{ minWidth: 0 }}>
        {title && (
          <div style={{
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            color: t.accent,
            marginBottom: message ? '4px' : 0,
            letterSpacing: '0.01em',
          }}>{title}</div>
        )}
        {message && (
          <div style={{
            fontFamily: 'Spline Sans Mono, monospace',
            fontSize: '11px',
            color: t.accent,
            opacity: 0.8,
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}>{message}</div>
        )}
      </div>
    </div>
  )
}

function formatAge(seconds) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// ─── ROOT — hash router ───────────────────────────────────────────────────────

export default function App() {
  const { route, d } = useHashRoute()
  if (route === 'view') return <ReadOnlyView encoded={d} />
  return <MainApp />
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function MainApp() {
  const [matches, setMatches] = useState(loadMatches)
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [suggestions, setSuggestions] = useState([])
  const [fetchState, setFetchState] = useState('idle')
  const [fetchError, setFetchError] = useState('')
  const [lastFetch, setLastFetchState] = useState(getLastFetch)
  const [tab, setTab] = useState('leaderboard')
  const [addModal, setAddModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [copyState, setCopyState] = useState('idle') // idle | copied | toolong

  useEffect(() => { saveMatches(matches) }, [matches])
  useEffect(() => { saveDismissed(dismissed) }, [dismissed])

  const leaderboard = buildLeaderboard(matches)

  useEffect(() => {
    if (Date.now() - getLastFetch() > FETCH_THROTTLE_MS) fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSuggestions = useCallback(async () => {
    setFetchState('loading')
    setFetchError('')
    try {
      const res = await fetch('/api/results')
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
      const data = await res.json()
      const now = Date.now()
      setLastFetch(now)
      setLastFetchState(now)
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
    setMatches(prev => [...prev, {
      id: crypto.randomUUID(),
      pid: sug.pid,
      opponent: sug.opponent,
      gf: sug.gf,
      ga: sug.ga,
      stage: sug.stage,
      starScored: sug.starScored || false,
      date: sug.date || new Date().toISOString().slice(0, 10),
    }])
    setSuggestions(prev => prev.filter(s => fingerprint(s) !== fingerprint(sug)))
  }

  const dismissSuggestion = (sug) => {
    const fp = fingerprint(sug)
    setDismissed(prev => { const n = new Set(prev); n.add(fp); return n })
    setSuggestions(prev => prev.filter(s => fingerprint(s) !== fp))
  }

  const deleteMatch = (id) => setMatches(prev => prev.filter(m => m.id !== id))

  const saveMatch = (matchData) => {
    if (matchData.id) {
      setMatches(prev => prev.map(m => m.id === matchData.id ? matchData : m))
    } else {
      setMatches(prev => [...prev, { ...matchData, id: crypto.randomUUID() }])
    }
    setAddModal(null)
    setEditModal(null)
  }

  const shareStandings = async () => {
    const url = buildShareURL(matches)
    if (url.length > 2000) {
      setCopyState('toolong')
      setTimeout(() => setCopyState('idle'), 3000)
      return
    }
    await copyToClipboard(url)
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 2000)
  }

  const shareLabel =
    copyState === 'copied' ? '✓ Link copied!' :
    copyState === 'toolong' ? '⚠ URL too long' :
    '↗ Share standings'
  const shareVariant =
    copyState === 'copied' ? 'share-done' :
    copyState === 'toolong' ? 'share-warn' :
    'share'

  const secondsSinceLastFetch = Math.floor((Date.now() - lastFetch) / 1000)

  return (
    <div style={css.app}>
      <header style={css.header}>
        <div style={css.title}>World Cup Sweep</div>
        <div style={css.subtitle}>FIFA World Cup 2026 · Family Sweepstake</div>
      </header>

      <div style={css.container}>
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

        <div style={css.section}>
          <div style={css.fetchRow}>
            <button
              style={css.btn('primary')}
              onClick={fetchSuggestions}
              disabled={fetchState === 'loading'}
            >
              {fetchState === 'loading' ? '⏳ Fetching…' : '⚡ Fetch Latest Results'}
            </button>
            <button style={css.btn('ghost')} onClick={() => setAddModal({})}>
              + Add Match
            </button>
            <button style={css.btn(shareVariant)} onClick={shareStandings}>
              {shareLabel}
            </button>
            {lastFetch > 0 && (
              <span style={css.fetchStatus}>
                Last fetch {formatAge(secondsSinceLastFetch)} ago
              </span>
            )}
          </div>
          {fetchState === 'error' && (
            <InfoCard type="error" title="Fetch failed" message={fetchError} />
          )}
          {fetchState === 'done' && suggestions.length === 0 && (
            <div style={{ ...css.fetchStatus, marginTop: '8px' }}>No new results found.</div>
          )}
        </div>

        <div style={{ ...css.section, marginTop: '24px' }}>
          <div style={css.tabRow}>
            <button style={css.tab(tab === 'leaderboard')} onClick={() => setTab('leaderboard')}>
              Leaderboard
            </button>
            <button style={css.tab(tab === 'matches')} onClick={() => setTab('matches')}>
              Matches ({matches.length})
            </button>
          </div>

          {tab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} />}
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

// ─── READ-ONLY VIEW ──────────────────────────────────────────────────────────

function ReadOnlyView({ encoded }) {
  if (!encoded) return <ErrorScreen message="Invalid share link — no data payload found." />

  const payload = decodeSharePayload(encoded)
  if (!payload) return <ErrorScreen message="Could not decode share link — it may be corrupted or truncated." />

  const { ts, matches } = payload
  const leaderboard = buildLeaderboard(matches)

  const makeOwnCopy = () => {
    const existing = loadMatches()
    if (existing.length > 0) {
      if (!window.confirm('You already have match data saved. Replace it with this shared snapshot?')) return
    }
    saveMatches(matches.map(m => ({ ...m, id: crypto.randomUUID() })))
    window.location.hash = ''
  }

  const sharedDate = new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <div style={css.app}>
      <header style={css.header}>
        <div style={css.title}>World Cup Sweep</div>
        <div style={css.subtitle}>FIFA World Cup 2026 · Family Sweepstake</div>
        <div style={css.readonlyBanner}>
          👁 Shared snapshot · {sharedDate}
        </div>
      </header>

      <div style={css.container}>
        <div style={css.section}>
          <div style={css.sectionLabel}>Standings</div>
          <LeaderboardTab leaderboard={leaderboard} />
        </div>

        <div style={{ marginTop: '24px' }}>
          <button style={css.btn('primary')} onClick={makeOwnCopy}>
            Make my own copy →
          </button>
          <div style={{ ...css.fetchStatus, marginTop: '8px' }}>
            Loads this snapshot into an editable session. Nothing is stored server-side — state lives in the URL.
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div style={css.app}>
      <header style={css.header}>
        <div style={css.title}>World Cup Sweep</div>
        <div style={css.subtitle}>FIFA World Cup 2026 · Family Sweepstake</div>
      </header>
      <div style={css.container}>
        <InfoCard type="error" title="Something went wrong" message={message} style={{ marginTop: '32px' }} />
        <div style={{ marginTop: '16px' }}>
          <a
            href="#"
            style={{ ...css.btn('ghost'), textDecoration: 'none' }}
            onClick={(e) => { e.preventDefault(); window.location.hash = '' }}
          >
            ← Go to app
          </a>
        </div>
      </div>
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
      <div style={{ ...css.matchScore, color: player.accent }}>{match.gf}–{match.ga}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#c0cce0' }}>
          {countryFlag(match.opponent) && (
            <span style={{ marginRight: '5px' }}>{countryFlag(match.opponent)}</span>
          )}
          {match.opponent}
          {match.starScored && <span style={{ color: '#facc15', marginLeft: '6px', fontSize: '12px' }}>★</span>}
        </div>
        <div style={css.matchMeta}>{stageLabel(match.stage)} · {match.date}</div>
      </div>
      <div style={{ fontFamily: 'Spline Sans Mono, monospace', fontSize: '11px', color: '#4a6080', flexShrink: 0 }}>
        {fmtPoints(pts)}
      </div>
      <button style={css.btn('ghost')} onClick={() => onEdit(match)} title="Edit">✏️</button>
      <button style={css.deleteBtn} onClick={() => onDelete(match.id)} title="Delete">×</button>
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
      <div style={css.sugOpponent}>
        {countryFlag(sug.opponent) && (
          <span style={{ marginRight: '5px' }}>{countryFlag(sug.opponent)}</span>
        )}
        vs {sug.opponent}
      </div>
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
  const player = playerByPid(form.pid)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.opponent.trim()) return
    onSave({ ...form, gf: parseInt(form.gf, 10) || 0, ga: parseInt(form.ga, 10) || 0 })
  }

  return (
    <div style={css.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={css.modal}>
        <div style={css.modalTitle}>{form.id ? 'Edit Match' : 'Add Match'}</div>
        <form onSubmit={handleSubmit}>
          <div style={css.formGroup}>
            <label style={css.label}>Player</label>
            <select style={css.select} value={form.pid} onChange={e => set('pid', e.target.value)}>
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
              <input style={css.input} type="number" min="0" max="20" value={form.gf} onChange={e => set('gf', e.target.value)} />
            </div>
            <div style={{ ...css.formGroup, flex: 1 }}>
              <label style={css.label}>Opponent Goals</label>
              <input style={css.input} type="number" min="0" max="20" value={form.ga} onChange={e => set('ga', e.target.value)} />
            </div>
          </div>
          <div style={css.formGroup}>
            <label style={css.label}>Stage</label>
            <select style={css.select} value={form.stage} onChange={e => set('stage', e.target.value)}>
              {Object.entries(STAGES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div style={css.formGroup}>
            <label style={css.label}>Date</label>
            <input style={css.input} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div style={css.formGroup}>
            <label style={css.checkbox}>
              <input type="checkbox" checked={form.starScored} onChange={e => set('starScored', e.target.checked)} />
              <span>★ Star player scored (+3 pts) — {player?.starPlayer}</span>
            </label>
          </div>
          <div style={css.formActions}>
            <button type="button" style={css.btn('ghost')} onClick={onClose}>Cancel</button>
            <button type="submit" style={css.btn('primary')}>{form.id ? 'Save Changes' : 'Add Match'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
