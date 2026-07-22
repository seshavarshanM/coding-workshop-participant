import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // small delay to feel authentic
    await new Promise(r => setTimeout(r, 400))
    const result = login(form.email, form.password)
    setLoading(false)
    if (result.success) {
      navigate('/', { replace: true })
    } else {
      setError(result.message)
    }
  }

  const fillDemo = (email) => setForm({ email, password: 'password' })

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0F172A',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: '#F8FAFC', fontWeight: 800, letterSpacing: '-1px' }}>
            ACME<span style={{ color: '#63B3ED' }}>.</span>
          </Typography>
          <Typography sx={{ color: '#94A3B8', mt: 0.5, fontSize: '0.9rem' }}>
            Project Management Platform
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{ p: 4, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#1E293B' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: 2,
                bgcolor: '#1565C0', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#F8FAFC', fontWeight: 700, fontSize: '1rem' }}>
                Sign in
              </Typography>
              <Typography sx={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                Use your ACME credentials
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              sx={fieldSx}
              InputLabelProps={{ sx: { color: '#94A3B8' } }}
              InputProps={{ sx: { color: '#F8FAFC' } }}
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              sx={{ ...fieldSx, mt: 2 }}
              InputLabelProps={{ sx: { color: '#94A3B8' } }}
              InputProps={{ sx: { color: '#F8FAFC' } }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ mt: 3, py: 1.3, fontWeight: 700, fontSize: '0.9rem', borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign in'}
            </Button>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Typography sx={{ color: '#64748B', fontSize: '0.75rem', px: 1 }}>DEMO ACCOUNTS</Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'Admin',   email: 'admin@acme.com'   },
              { label: 'Manager', email: 'manager@acme.com' },
              { label: 'Member',  email: 'member@acme.com'  },
            ].map(({ label, email }) => (
              <Button
                key={label}
                variant="outlined"
                size="small"
                onClick={() => fillDemo(email)}
                sx={{
                  color: '#94A3B8',
                  borderColor: 'rgba(255,255,255,0.12)',
                  fontSize: '0.78rem',
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#63B3ED', color: '#63B3ED', bgcolor: 'rgba(99,179,237,0.05)' },
                }}
              >
                {label} — {email} / password
              </Button>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#1565C0' },
    bgcolor: 'rgba(255,255,255,0.04)',
  },
}
