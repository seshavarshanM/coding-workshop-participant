import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/MenuRounded'
import Sidebar from './Sidebar'
import { palette } from '../theme/tokens'

const DRAWER_WIDTH = 244

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const location = useLocation()

  const toggle = () => setMobileOpen(o => !o)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: palette.canvas }}>
      {!isMobile && (
        <Box sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
          <Box sx={{ position: 'fixed', inset: '0 auto 0 0', width: DRAWER_WIDTH, zIndex: 100 }}>
            <Sidebar />
          </Box>
        </Box>
      )}

      {isMobile && (
        <Drawer variant="temporary" open={mobileOpen} onClose={toggle}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' } }}>
          <Sidebar onClose={toggle} />
        </Drawer>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {isMobile && (
          <AppBar position="sticky" elevation={0}
            sx={{ bgcolor: palette.navBg, borderBottom: `1px solid ${palette.navBorder}` }}>
            <Toolbar variant="dense">
              <IconButton color="inherit" edge="start" onClick={toggle} sx={{ mr: 1.5 }}>
                <MenuIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 750, fontSize: '0.9375rem', letterSpacing: '-0.02em' }}>
                ACME<Box component="span" sx={{ color: '#818CF8' }}> Project Hub</Box>
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        <Box component="main" key={location.pathname}
          sx={{
            flex: 1, px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 },
            maxWidth: 1440, width: '100%', mx: 'auto',
            // Content settles in rather than snapping — respects reduced motion
            animation: 'pageIn .22s ease-out',
            '@keyframes pageIn': {
              from: { opacity: 0, transform: 'translateY(4px)' },
              to:   { opacity: 1, transform: 'none' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
