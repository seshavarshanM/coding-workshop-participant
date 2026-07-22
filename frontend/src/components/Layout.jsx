import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from './Sidebar'

const DRAWER_WIDTH = 240

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const handleDrawerToggle = () => setMobileOpen(prev => !prev)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F5F7FA' }}>
      {/* Desktop permanent sidebar */}
      {!isMobile && (
        <Box sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
          <Box sx={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: DRAWER_WIDTH, zIndex: 100 }}>
            <Sidebar />
          </Box>
        </Box>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          <Sidebar onClose={handleDrawerToggle} />
        </Drawer>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile topbar */}
        {isMobile && (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{ bgcolor: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Toolbar>
              <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                ACME<span style={{ color: '#63B3ED' }}>.</span>
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        {/* Page content */}
        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
