import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/AddRounded'
import SendIcon from '@mui/icons-material/SendRounded'
import { supportService } from '../services/supportService'
import { projectService } from '../services/projectService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import MetricCard from '../components/MetricCard'
import { palette, statusToken, font } from '../theme/tokens'

const CATEGORIES = [
  ['access',      'Access or permissions'],
  ['data',        'Wrong or missing data'],
  ['bug',         'Something is broken'],
  ['how_to',      'How do I…'],
  ['request',     'Feature request'],
  ['other',       'Something else'],
]
const PRIORITIES = [['low','Low'], ['normal','Normal'], ['high','High'], ['urgent','Urgent']]
const STATUSES   = [['open','Open'], ['in_progress','In progress'], ['waiting','Waiting on reporter'],
                    ['resolved','Resolved'], ['closed','Closed']]

const TICKET_TONE = {
  open:        { fg: '#93231C', bg: '#FBEAE8' },
  in_progress: { fg: '#1B4B8F', bg: '#E9F0FA' },
  waiting:     { fg: '#9C3A06', bg: '#FDEEE4' },
  resolved:    { fg: '#15633C', bg: '#E8F5EC' },
  closed:      { fg: '#4A4A52', bg: '#EFEEEA' },
}
const label = (list, v) => (list.find(([k]) => k === v) || [, v])[1]
const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

function when(ts) {
  if (!ts) return ''
  const t = new Date(String(ts).replace(' ', 'T'))
  const m = Math.round((Date.now() - t.getTime()) / 60000)
  if (Number.isNaN(m)) return String(ts)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const EMPTY = { subject: '', description: '', category: 'other', priority: 'normal', project_name: '' }

export default function Support() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [tickets, setTickets] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('open')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState(null)
  const [replies, setReplies] = useState([])
  const [reply, setReply] = useState('')
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTickets(await supportService.getAll())
    } catch (e) {
      setSnack({ open: true, sev: 'error', msg: e?.response?.data?.message || e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { projectService.getAll().then(setProjects).catch(() => {}) }, [])

  const openTicket = async (t) => {
    setActive(t); setReply(''); setReplies([])
    try { setReplies(await supportService.replies(t.id)) } catch { /* shown as empty */ }
  }

  const submitTicket = async () => {
    setSaving(true)
    try {
      const created = await supportService.create(form)
      setSnack({ open: true, sev: 'success', msg: `Ticket ${created.reference} raised` })
      setNewOpen(false); setForm(EMPTY); load()
    } catch (e) {
      setSnack({ open: true, sev: 'error', msg: e?.response?.data?.message || e.message })
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || !active) return
    try {
      await supportService.reply(active.id, text)
      setReply('')
      setReplies(await supportService.replies(active.id))
      load()
    } catch (e) {
      setSnack({ open: true, sev: 'error', msg: e?.response?.data?.message || e.message })
    }
  }

  const setStatus = async (status) => {
    if (!active) return
    try {
      const updated = await supportService.update(active.id, { status })
      setActive(updated)
      setSnack({ open: true, sev: 'success', msg: `Marked ${label(STATUSES, status).toLowerCase()}` })
      load()
    } catch (e) {
      setSnack({ open: true, sev: 'error', msg: e?.response?.data?.message || e.message })
    }
  }

  const isOpen = t => ['open', 'in_progress', 'waiting'].includes(t.status)
  const shown = tab === 'open' ? tickets.filter(isOpen)
              : tab === 'closed' ? tickets.filter(t => !isOpen(t))
              : tickets
  const openCount = tickets.filter(isOpen).length
  const urgentCount = tickets.filter(t => isOpen(t) && t.priority === 'urgent').length

  return (
    <Box>
      <PageHeader
        eyebrow={isAdmin ? 'Support queue' : 'Help'}
        title={isAdmin ? 'Support queue' : 'Get help'}
        description={isAdmin
          ? 'Problems reported by managers and team members. Triage, respond and resolve.'
          : 'Report a problem with the platform. An administrator will pick it up.'}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
          Report a problem
        </Button>}
      />

      {isAdmin && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Open tickets" value={loading ? '—' : openCount}
              footnote={openCount ? 'Waiting on support' : 'Queue is clear'}
              tone={openCount ? 'warning' : 'positive'} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Urgent" value={loading ? '—' : urgentCount}
              footnote={urgentCount ? 'Needs attention now' : 'Nothing urgent'}
              tone={urgentCount ? 'critical' : 'positive'} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Resolved" value={loading ? '—' : tickets.length - openCount}
              footnote="All time" tone="neutral" />
          </Grid>
        </Grid>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
        <Tab value="open"   label={`Open (${openCount})`} />
        <Tab value="closed" label={`Resolved (${tickets.length - openCount})`} />
        <Tab value="all"    label={`All (${tickets.length})`} />
      </Tabs>

      {loading ? (
        [1, 2, 3].map(i => <Paper key={i} sx={{ p: 2.5, mb: 1.5 }}><Skeleton width="40%" /><Skeleton width="70%" /></Paper>)
      ) : shown.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            {tab === 'open' ? 'No open tickets' : 'Nothing here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin ? 'The queue is clear.' : 'Report a problem and it will appear here.'}
          </Typography>
        </Paper>
      ) : shown.map(t => {
        const tone = TICKET_TONE[t.status] || TICKET_TONE.closed
        return (
          <Paper key={t.id} onClick={() => openTicket(t)}
            sx={{ p: 2.25, mb: 1.5, cursor: 'pointer', display: 'flex', gap: 2, alignItems: 'flex-start',
              '&:hover': { borderColor: palette.borderStrong, bgcolor: palette.surfaceAlt } }}>
            <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
              bgcolor: t.priority === 'urgent' ? statusToken('blocked').dot
                     : t.priority === 'high' ? statusToken('at_risk').dot : palette.borderStrong }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography sx={{ fontFamily: font.mono, fontSize: '0.75rem', color: palette.inkSubtle }}>
                  {t.reference}
                </Typography>
                <Typography variant="subtitle1" sx={{ flex: 1, minWidth: 0 }} noWrap>{t.subject}</Typography>
              </Box>
              <Typography variant="caption">
                {t.raised_by} · {label(CATEGORIES, t.category)} · {when(t.created_at)}
                {t.project_name ? ` · ${t.project_name}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, alignItems: 'center' }}>
              {t.priority !== 'normal' && (
                <Chip size="small" label={label(PRIORITIES, t.priority)} variant="outlined" />
              )}
              <Box component="span" sx={{ px: 1, py: 0.375, borderRadius: 0.75,
                bgcolor: tone.bg, color: tone.fg, fontSize: '0.6875rem', fontWeight: 600 }}>
                {label(STATUSES, t.status)}
              </Box>
            </Box>
          </Paper>
        )
      })}

      {/* Raise a ticket */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Report a problem</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth required label="What is the problem?" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. I cannot update progress on my deliverable" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={4} label="What happened?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                helperText="What you were doing, what you expected, and what happened instead." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Category" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Priority" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Related project (optional)" value={form.project_name}
                onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}>
                <MenuItem value="">Not project specific</MenuItem>
                {projects.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitTicket} disabled={saving || !form.subject.trim()}>
            {saving ? 'Sending…' : 'Send to support'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ticket detail */}
      <Dialog open={!!active} onClose={() => setActive(null)} maxWidth="sm" fullWidth>
        {active && (<>
          <DialogTitle sx={{ pb: 1 }}>
            <Typography sx={{ fontFamily: font.mono, fontSize: '0.75rem', color: palette.inkSubtle }}>
              {active.reference}
            </Typography>
            {active.subject}
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
              {active.description || 'No further detail was given.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              <Chip size="small" variant="outlined" label={label(CATEGORIES, active.category)} />
              <Chip size="small" variant="outlined" label={label(PRIORITIES, active.priority)} />
              <Chip size="small" variant="outlined" label={`Raised by ${active.raised_by}`} />
              {active.project_name && <Chip size="small" variant="outlined" label={active.project_name} />}
            </Box>

            {isAdmin && (
              <TextField select fullWidth size="small" label="Status" value={active.status}
                onChange={e => setStatus(e.target.value)} sx={{ mb: 2 }}>
                {STATUSES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            )}

            <Divider sx={{ mb: 2 }} />
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Conversation
            </Typography>

            {replies.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No replies yet.
              </Typography>
            )}
            {replies.map(r => (
              <Box key={r.id} sx={{ display: 'flex', gap: 1.25, mb: 1.5 }}>
                <Avatar sx={{ width: 26, height: 26, fontSize: '0.625rem',
                  bgcolor: r.author_role === 'admin' ? palette.accent : palette.ink,
                  color: r.author_role === 'admin' ? palette.ink : '#fff' }}>
                  {initials(r.author_name)}
                </Avatar>
                <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5,
                  bgcolor: r.author_role === 'admin' ? palette.accentSoft : palette.surfaceAlt }}>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', mb: 0.25 }}>
                    <Typography variant="subtitle2">{r.author_name}</Typography>
                    {r.author_role === 'admin' && (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: palette.accentInk }}>
                        SUPPORT
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ ml: 'auto' }}>{when(r.created_at)}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.message}</Typography>
                </Box>
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField fullWidth size="small" multiline minRows={2} value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder={isAdmin ? 'Reply to the reporter…' : 'Add more detail…'} />
              <Button variant="contained" onClick={sendReply} disabled={!reply.trim()}
                sx={{ alignSelf: 'flex-start', minWidth: 0, px: 1.5 }}>
                <SendIcon sx={{ fontSize: 17 }} />
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActive(null)}>Close</Button>
            {isAdmin && active.status !== 'resolved' && (
              <Button variant="contained" onClick={() => setStatus('resolved')}>Mark resolved</Button>
            )}
          </DialogActions>
        </>)}
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
