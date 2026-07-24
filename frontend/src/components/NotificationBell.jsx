import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import NotificationsIcon from '@mui/icons-material/NotificationsRounded'
import CampaignIcon from '@mui/icons-material/CampaignRounded'
import { deliverableService } from '../services/deliverableService'
import { useAuth } from '../context/AuthContext'
import { palette, font, statusToken } from '../theme/tokens'

const SEEN_KEY = 'acme_notifications_seen_at'
const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

function when(ts) {
  if (!ts) return ''
  const t = new Date(String(ts).replace(' ', 'T'))
  const m = Math.round((Date.now() - t.getTime()) / 60000)
  if (Number.isNaN(m)) return ''
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Activity addressed to the person signed in.
 *
 * A manager sees progress reported on their projects; a member sees remarks
 * left on their work. "Unread" is held locally as a timestamp rather than
 * per-row state on the server — the value is knowing something happened since
 * you last looked, and that does not warrant write traffic on every glance.
 */
export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [anchor, setAnchor] = useState(null)
  const [seenAt, setSeenAt] = useState(() => sessionStorage.getItem(SEEN_KEY) || '')

  const load = useCallback(() => {
    deliverableService.notifications().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    load()
    // Refresh periodically so the badge reflects work happening elsewhere.
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const unread = items.filter(i => !seenAt || String(i.created_at) > seenAt)

  const open = (e) => {
    setAnchor(e.currentTarget)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 23)
    sessionStorage.setItem(SEEN_KEY, now)
    setSeenAt(now)
  }

  if (!user) return null

  return (
    <>
      <Tooltip title="Recent activity">
        <IconButton onClick={open} size="small"
          sx={{
            color: palette.inkSubtle,
            border: `1px solid ${palette.border}`,
            bgcolor: palette.surface,
            '&:hover': { color: palette.ink, borderColor: palette.borderStrong },
          }}>
          <Badge badgeContent={unread.length} max={9}
            sx={{ '& .MuiBadge-badge': {
              bgcolor: palette.accent, color: palette.ink,
              fontSize: '0.625rem', fontWeight: 700, minWidth: 16, height: 16,
            } }}>
            <NotificationsIcon sx={{ fontSize: 18 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 340, maxHeight: 420 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1">Recent activity</Typography>
          <Typography variant="caption">
            {user.role === 'member'
              ? 'Remarks on work assigned to you'
              : 'Progress reported on your projects'}
          </Typography>
        </Box>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Nothing yet.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.map(n => {
              const isRemark = n.kind === 'remark'
              const moved = n.kind === 'progress' && n.to_pct !== null
              return (
                <Box key={n.id}
                  onClick={() => { setAnchor(null); navigate('/deliverables') }}
                  sx={{
                    display: 'flex', gap: 1.25, px: 2, py: 1.5, cursor: 'pointer',
                    borderLeft: '2px solid',
                    borderLeftColor: (!seenAt || String(n.created_at) > seenAt)
                      ? palette.accent : 'transparent',
                    '&:hover': { bgcolor: palette.surfaceAlt },
                  }}>
                  <Avatar sx={{
                    width: 26, height: 26, fontSize: '0.625rem', flexShrink: 0,
                    bgcolor: isRemark ? palette.accent : palette.ink,
                    color: isRemark ? palette.ink : '#fff',
                  }}>
                    {initials(n.author_name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2">{n.author_name}</Typography>
                      {isRemark && <CampaignIcon sx={{ fontSize: 13, color: palette.accentInk }} />}
                      {moved && (
                        <Typography component="span" sx={{
                          fontFamily: font.mono, fontSize: '0.6875rem', fontWeight: 600,
                          color: statusToken('completed').fg,
                        }}>
                          {n.from_pct}% → {n.to_pct}%
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: palette.inkMuted }}>
                      {n.deliverable_name} · {n.project_name}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>{n.note}</Typography>
                    <Typography variant="caption">{when(n.created_at)}</Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button fullWidth size="small"
            onClick={() => { setAnchor(null); navigate('/deliverables') }}>
            Open deliverables
          </Button>
        </Box>
      </Popover>
    </>
  )
}
