import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'
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
