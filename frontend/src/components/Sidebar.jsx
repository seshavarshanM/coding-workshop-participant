import { NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

import DashboardIcon from '@mui/icons-material/GridViewRounded'
import FolderIcon from '@mui/icons-material/FolderRounded'
import AssignmentIcon from '@mui/icons-material/TaskAltRounded'
import PeopleIcon from '@mui/icons-material/GroupsRounded'
import WalletIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import HistoryIcon from '@mui/icons-material/HistoryRounded'
import LogoutIcon from '@mui/icons-material/LogoutRounded'

import { useAuth } from '../context/AuthContext'
import { palette, font } from '../theme/tokens'

const NAV = [
  { section: 'Overview', items: [
    { to: '/',             label: 'Dashboard',    Icon: DashboardIcon },
  ]},
  { section: 'Delivery', items: [
    { to: '/projects',     label: 'Projects',     Icon: FolderIcon },
    { to: '/deliverables', label: 'Deliverables', Icon: AssignmentIcon },
  ]},
  { section: 'Capacity & cost', items: [
    { to: '/resources',    label: 'Resources',    Icon: PeopleIcon },
    { to: '/budget',       label: 'Budget',       Icon: WalletIcon },
  ]},
  { section: 'Account', items: [
    { to: '/profile',      label: 'My profile',   Icon: PersonIcon },
    { to: '/activity',     label: 'Activity log', Icon: HistoryIcon, roles: ['admin', 'manager'] },
  ]},
]

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()

  return (
    <Box sx={{
      width: 244, height: '100%', bgcolor: palette.navBg,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${palette.navBorder}`,
    }}>
      {/* Wordmark */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{
            width: 26, height: 26, borderRadius: 0.75, bgcolor: palette.accent,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Typography sx={{ fontFamily: font.display, fontWeight: 700,
              fontSize: '0.875rem', color: palette.ink, lineHeight: 1 }}>A</Typography>
          </Box>
          <Typography sx={{
            fontFamily: font.display, color: '#FFFFFF', fontWeight: 600,
            fontSize: '1.0625rem', letterSpacing: '-0.01em', lineHeight: 1,
          }}>
            Project Hub
          </Typography>
        </Box>
        <Typography sx={{ color: '#6E6E77', fontSize: '0.6875rem', mt: 1, letterSpacing: '0.02em' }}>
          ACME Inc · Delivery, capacity and cost
        </Typography>
      </Box>

      <Divider sx={{ borderColor: palette.navBorder }} />

      {/* Grouped navigation — sections name what the tool actually does */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 2 }}>
        {NAV.map(({ section, items }) => {
          const visible = items.filter(i => !i.roles || i.roles.includes(user?.role))
          if (visible.length === 0) return null
          return (
            <Box key={section} sx={{ mb: 2 }}>
              <Typography sx={{
                px: 1.25, mb: 0.75, color: '#6E6E77',
                fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {section}
              </Typography>
              <List disablePadding>
                {visible.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
                    style={{ textDecoration: 'none' }}>
                    {({ isActive }) => (
                      <ListItemButton sx={{
                        borderRadius: 1.5, mb: 0.25, px: 1.25, py: 0.75, minHeight: 36,
                        bgcolor: isActive ? palette.navActiveBg : 'transparent',
                        position: 'relative',
                        '&:hover': { bgcolor: isActive ? palette.navActiveBg : 'rgba(255,255,255,0.06)' },
                      }}>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <Icon sx={{ fontSize: 18, color: isActive ? palette.navTextActive : palette.navText }} />
                        </ListItemIcon>
                        <ListItemText primary={label} primaryTypographyProps={{
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? palette.navTextActive : palette.navText,
                        }} />
                      </ListItemButton>
                    )}
                  </NavLink>
                ))}
              </List>
            </Box>
          )
        })}
      </Box>

      <Divider sx={{ borderColor: palette.navBorder }} />

      {/* Signed-in identity */}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: palette.accent, color: palette.ink, fontSize: '0.75rem' }}>
          {initials(user?.name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ color: '#E8EAEE', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 }}>
            {user?.name}
          </Typography>
          <Typography noWrap sx={{ color: '#6E6E77', fontSize: '0.6875rem' }}>
            {user?.employee_id} · {user?.role}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton size="small" onClick={logout}
            sx={{ color: palette.navText, '&:hover': { color: palette.accent, bgcolor: 'rgba(255,197,61,0.10)' } }}>
            <LogoutIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
