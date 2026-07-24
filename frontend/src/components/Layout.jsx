import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import MenuIcon from '@mui/icons-material/MenuRounded'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { palette, font } from '../theme/tokens'

const DRAWER_WIDTH = 244

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const location = useLocation()

  const toggle = () => setMobileOpen(o => !o)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: palette.canvas, overflowX: 'hidden' }}>
      {!isMobile && (
        <Box className="app-chrome" sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
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

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}>
        {isMobile && (
          <AppBar position="sticky" elevation={0} className="app-chrome"
            sx={{ bgcolor: palette.navBg, borderBottom: `1px solid ${palette.navBorder}` }}>
            <Toolbar variant="dense" sx={{ gap: 1 }}>
              <IconButton color="inherit" edge="start" onClick={toggle}>
                <MenuIcon />
              </IconButton>
              <Box sx={{
                width: 22, height: 22, borderRadius: 0.75, bgcolor: palette.accent,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <Typography sx={{ fontFamily: font.display, fontWeight: 700,
                  fontSize: '0.75rem', color: palette.ink, lineHeight: 1 }}>A</Typography>
              </Box>
              <Typography noWrap sx={{
                fontFamily: font.display, fontWeight: 600, fontSize: '0.9375rem',
                letterSpacing: '-0.01em', flex: 1, minWidth: 0,
              }}>
                Project Hub
              </Typography>
              <NotificationBell />
            </Toolbar>
          </AppBar>
        )}

        {/* Notifications sit at the top of the working area rather than in the
            navigation, where they read as part of the chrome rather than as
            something addressed to you. */}
        {!isMobile && (
          <Box className="app-chrome" sx={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            px: { xs: 2, sm: 3, lg: 4 }, pt: 2, pb: 0,
            maxWidth: 1440, width: '100%', mx: 'auto',
          }}>
            <NotificationBell />
          </Box>
        )}

        <Box component="main" key={location.pathname} className="app-main"
          sx={{
            flex: 1, px: { xs: 1.75, sm: 3, lg: 4 }, pt: { xs: 2.5, md: 1.5 }, pb: { xs: 2.5, md: 3.5 },
            maxWidth: 1440, width: '100%', mx: 'auto',
            minWidth: 0,
            // Content settles in rather than snapping, unless the user has
            // asked for reduced motion.
            animation: reducedMotion ? 'none' : 'pageIn .22s ease-out',
            '@keyframes pageIn': {
              from: { opacity: 0, transform: 'translateY(4px)' },
              to:   { opacity: 1, transform: 'none' },
            },
          }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
