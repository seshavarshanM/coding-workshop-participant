import { NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'

import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'

import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',             label: 'Dashboard',    Icon: DashboardIcon             },
  { to: '/projects',     label: 'Projects',     Icon: FolderOpenIcon            },
  { to: '/deliverables', label: 'Deliverables', Icon: AssignmentIcon            },
  { to: '/resources',    label: 'Resources',    Icon: PeopleAltIcon             },
  { to: '/budget',       label: 'Budget',       Icon: AccountBalanceWalletIcon  },
  { to: '/profile',      label: 'My Profile',   Icon: PersonIcon                },
]

const SIDEBAR_BG  = '#0F172A'
const ACTIVE_BG   = 'rgba(99,179,237,0.15)'
const ACTIVE_TEXT = '#63B3ED'
const MUTED_TEXT  = '#94A3B8'

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()

  return (
    <Box
      sx={{
        width: 240,
        height: '100%',
        bgcolor: SIDEBAR_BG,
        display: 'flex',
        flexDirection: 'column',
        py: 0,
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, py: 3 }}>
        <Typography
          variant="h6"
          sx={{ color: '#F8FAFC', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}
        >
          ACME<span style={{ color: ACTIVE_TEXT }}>.</span>
        </Typography>
        <Typography variant="caption" sx={{ color: MUTED_TEXT, fontSize: '0.7rem' }}>
          Project Management
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Nav links */}
      <List sx={{ flex: 1, px: 1.5, py: 1.5 }}>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={{ textDecoration: 'none' }}
            onClick={onClose}
          >
            {({ isActive }) => (
              <ListItemButton
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  px: 1.5,
                  py: 1,
                  bgcolor: isActive ? ACTIVE_BG : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Icon sx={{ fontSize: 20, color: isActive ? ACTIVE_TEXT : MUTED_TEXT }} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? ACTIVE_TEXT : MUTED_TEXT,
                  }}
                />
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* User footer */}
      <Box sx={{ px: 2, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#1565C0', fontSize: '0.8rem' }}>
            {user?.name?.charAt(0) || 'U'}
          </Avatar>
          <Box>
            <Typography sx={{ color: '#F8FAFC', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
              {user?.name}
            </Typography>
            <Typography sx={{ color: MUTED_TEXT, fontSize: '0.7rem', textTransform: 'capitalize' }}>
              {user?.role}{user?.employee_id ? ` · ${user.employee_id}` : ''}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          size="small"
          startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
          onClick={logout}
          sx={{
            color: MUTED_TEXT,
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontSize: '0.8rem',
            '&:hover': { color: '#F87171', bgcolor: 'rgba(248,113,113,0.08)' },
          }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  )
}
