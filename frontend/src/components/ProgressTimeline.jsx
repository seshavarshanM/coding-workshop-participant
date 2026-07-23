import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Divider from '@mui/material/Divider'
import SendIcon from '@mui/icons-material/SendRounded'
import CampaignIcon from '@mui/icons-material/CampaignRounded'
import { deliverableService } from '../services/deliverableService'
import { palette, statusToken, font } from '../theme/tokens'

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const avatarColor = (n = '') =>
  ['#16161A', '#4A4A52', '#1B4B8F', '#15633C', '#9C3A06', '#93231C'][(n.charCodeAt(0) || 0) % 6]

function when(ts) {
  if (!ts) return ''
  const then = new Date(String(ts).replace(' ', 'T'))
  const mins = Math.round((Date.now() - then.getTime()) / 60000)
  if (Number.isNaN(mins)) return String(ts)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const KIND_LABEL = { progress: 'Progress', remark: 'Manager remark', note: 'Note' }

/**
 * The history of a deliverable: how far it moved, when, and what the person
 * doing the work said about it. A percentage on its own tells you nothing a
 * week later — the note is the part that survives.
 */
export default function ProgressTimeline({ deliverableId, canPost = false, compact = false }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!deliverableId) return
    setLoading(true)
    deliverableService.updates(deliverableId)
      .then(setEntries)
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false))
  }, [deliverableId])

  useEffect(() => { load() }, [load])

  const post = async () => {
    const text = note.trim()
    if (!text) return
    setPosting(true); setError('')
    try {
      await deliverableService.postUpdate(deliverableId, text)
      setNote('')
      load()
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return <Box sx={{ py: 1 }}>{[1, 2].map(i => <Skeleton key={i} height={40} />)}</Box>
  }

  return (
    <Box>
      {canPost && (
        <Box sx={{ display: 'flex', gap: 1, mb: entries.length ? 2 : 0 }}>
          <TextField
            fullWidth size="small" multiline minRows={2} maxRows={5}
            placeholder="Add an update — what changed, and anything blocking you"
            value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post() }}
          />
          <Button variant="contained" onClick={post} disabled={posting || !note.trim()}
            sx={{ alignSelf: 'flex-start', minWidth: 0, px: 1.5 }}>
            <SendIcon sx={{ fontSize: 17 }} />
          </Button>
        </Box>
      )}

      {error && <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>{error}</Typography>}

      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: compact ? 1 : 2 }}>
          No updates yet. The first progress change will appear here.
        </Typography>
      ) : (
        <Box sx={{ position: 'relative', pl: 2.5 }}>
          {/* Spine */}
          <Box sx={{
            position: 'absolute', left: 11, top: 6, bottom: 6, width: '1px',
            bgcolor: palette.border,
          }} />

          {entries.map((e, i) => {
            const moved = e.kind === 'progress' && e.to_pct !== null
            const delta = moved ? Number(e.to_pct) - Number(e.from_pct || 0) : 0
            const isRemark = e.kind === 'remark'
            return (
              <Box key={e.id} sx={{ position: 'relative', pb: i === entries.length - 1 ? 0 : 2 }}>
                <Avatar sx={{
                  position: 'absolute', left: -20, top: 8, width: 24, height: 24,
                  fontSize: '0.5625rem',
                  bgcolor: isRemark ? palette.accent : avatarColor(e.author_name),
                  color: isRemark ? palette.ink : '#fff',
                  border: `2px solid ${palette.surface}`,
                }}>
                  {initials(e.author_name)}
                </Avatar>

                {/* A manager's remark is addressed to someone — it gets weight
                    so it cannot be scrolled past like a routine progress note. */}
                <Box sx={{
                  p: 1.5, borderRadius: 1.5,
                  border: `1px solid ${isRemark ? palette.accent : palette.border}`,
                  bgcolor: isRemark ? palette.accentSoft : palette.surface,
                  ...(isRemark && { borderLeftWidth: 3 }),
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }}>
                    <Typography variant="subtitle2">{e.author_name}</Typography>
                    {moved && (
                      <Box component="span" sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        px: 0.75, py: 0.125, borderRadius: 0.75,
                        bgcolor: delta >= 0 ? statusToken('completed').bg : statusToken('at_risk').bg,
                        color:   delta >= 0 ? statusToken('completed').fg : statusToken('at_risk').fg,
                        fontFamily: font.mono, fontSize: '0.6875rem', fontWeight: 600,
                      }}>
                        {e.from_pct}% → {e.to_pct}%
                        <Box component="span" sx={{ opacity: 0.75 }}>
                          ({delta >= 0 ? '+' : ''}{delta})
                        </Box>
                      </Box>
                    )}
                    {e.kind !== 'progress' && (
                      <Box component="span" sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.375,
                        px: 0.75, py: 0.125, borderRadius: 0.75,
                        bgcolor: isRemark ? palette.accent : palette.surfaceAlt,
                        color:   isRemark ? palette.ink : palette.inkSubtle,
                        fontWeight: 700, fontSize: '0.625rem',
                        letterSpacing: '0.03em', textTransform: 'uppercase',
                      }}>
                        {isRemark && <CampaignIcon sx={{ fontSize: 13 }} />}
                        {KIND_LABEL[e.kind] || e.kind}
                      </Box>
                    )}
                    <Typography variant="caption" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
                      {when(e.created_at)}
                    </Typography>
                  </Box>

                  <Typography variant="body2" sx={{
                    color: isRemark ? palette.ink : palette.inkMuted,
                    fontWeight: isRemark ? 500 : 400,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {e.note}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
