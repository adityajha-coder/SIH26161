export function formatClock(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '00:00:00'
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function formatCompact(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatDischarge(q: number | null | undefined) {
  if (q === null || q === undefined || !Number.isFinite(q)) return '—'
  return `${formatNumber(Math.round(q))} m³/s`
}

export function formatVolumeMcm(m3: number | null | undefined) {
  if (m3 === null || m3 === undefined || !Number.isFinite(m3)) return '—'
  return `${formatNumber(m3 / 1e6, 0)} MCM`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }) + ' IST'
  } catch {
    return '—'
  }
}

export function relativeAge(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso).getTime()
    if (isNaN(d)) return '—'
    const diff = (Date.now() - d) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.round(diff / 60)} min ago`
    if (diff < 86400) return `${Math.round(diff / 3600)} h ago`
    return `${Math.round(diff / 86400)} d ago`
  } catch {
    return '—'
  }
}
