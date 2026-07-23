import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Deliverables from './pages/Deliverables'
import Resources from './pages/Resources'
import Budget from './pages/Budget'
import Profile from './pages/Profile'
import Activity from './pages/Activity'

const theme = createTheme({
  palette: {
    primary:    { main: '#1565C0' },
    secondary:  { main: '#7C3AED' },
    background: { default: '#F4F6FB', paper: '#FFFFFF' },
    error:      { main: '#DC2626' },
    success:    { main: '#16A34A' },
    warning:    { main: '#D97706' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 800, letterSpacing: '-0.5px' },
    h6: { fontWeight: 700 },
  },
  shape:     { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10 },
        contained: {
          background: 'linear-gradient(135deg,#1565C0 0%,#1E88E5 100%)',
          boxShadow: '0 2px 8px rgba(21,101,192,0.25)',
          '&:hover': { boxShadow: '0 4px 14px rgba(21,101,192,0.35)' },
        },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#F1F5F9' } } },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          transition: 'box-shadow .2s ease, transform .2s ease',
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
  },
})

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index             element={<Dashboard />} />
        <Route path="projects"   element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="deliverables" element={<Deliverables />} />
        <Route path="resources"  element={<Resources />} />
        <Route path="budget"     element={<Budget />} />
        <Route path="profile"    element={<Profile />} />
        <Route path="activity"   element={<Activity />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
