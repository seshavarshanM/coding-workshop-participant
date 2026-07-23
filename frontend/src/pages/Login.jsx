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
import Chip from '@mui/material/Chip'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { label: 'Admin',   name: 'Alice Fernandes', email: 'alice.admin@acme.com',  password: 'Admin@123',   color: '#A78BFA' },
  { label: 'Manager', name: 'Michael Rao',     email: 'michael.rao@acme.com',  password: 'Manager@123', color: '#60A5FA' },
  { label: 'Member',  name: 'Sana Kapoor',     email: 'sana.kapoor@acme.com',  password: 'Member@123',  color: '#94A3B8' },
]

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#1565C0' },
    bgcolor: 'rgba(255,255,255,0.04)',
  },
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (email, password) => {
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) navigate('/', { replace: true })
    else setError(result.message)
  }

  const handleSubmit = e => {
    e.preventDefault()
    submit(form.email, form.password)
  }

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#0F172A', p: 2,
    }}>
      <Box sx={{ width: '100%', maxWidth: 430 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: '#F8FAFC', fontWeight: 800, letterSpacing: '-1px' }}>
            ACME<span style={{ color: '#63B3ED' }}>.</span>
          </Typography>
          <Typography sx={{ color: '#94A3B8', mt: 0.5, fontSize: '0.9rem' }}>
            Project Management Platform
          </Typography>
        </Box>

        <Paper elevation={0} sx={{
          p: 4, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#1E293B',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2, bgcolor: '#1565C0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#F8FAFC', fontWeight: 700, fontSize: '1rem' }}>Sign in</Typography>
              <Typography sx={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                Use your ACME employee account
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email address" name="email" type="email"
              value={form.email} onChange={handleChange} required autoComplete="username"
              sx={fieldSx}
              InputLabelProps={{ sx: { color: '#94A3B8' } }}
              InputProps={{ sx: { color: '#F8FAFC' } }}
            />
            <TextField
              fullWidth label="Password" name="password" type="password"
              value={form.password} onChange={handleChange} required autoComplete="current-password"
              sx={{ ...fieldSx, mt: 2 }}
              InputLabelProps={{ sx: { color: '#94A3B8' } }}
              InputProps={{ sx: { color: '#F8FAFC' } }}
            />
            <Button
              type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ mt: 3, py: 1.3, fontWeight: 700, fontSize: '0.9rem', borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign in'}
            </Button>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Typography sx={{ color: '#64748B', fontSize: '0.72rem', px: 1, letterSpacing: '0.5px' }}>
              QUICK SIGN-IN
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <Button
                key={acc.email}
                variant="outlined"
                size="small"
                disabled={loading}
                onClick={() => { setForm({ email: acc.email, password: acc.password }); submit(acc.email, acc.password) }}
                sx={{
                  color: '#CBD5E1', borderColor: 'rgba(255,255,255,0.12)',
                  fontSize: '0.78rem', justifyContent: 'flex-start', textTransform: 'none',
                  py: 0.9,
                  '&:hover': { borderColor: '#63B3ED', bgcolor: 'rgba(99,179,237,0.06)' },
                }}
              >
                <Chip
                  label={acc.label}
                  size="small"
                  sx={{
                    mr: 1.25, height: 20, fontSize: '0.66rem', fontWeight: 700,
                    bgcolor: 'rgba(255,255,255,0.08)', color: acc.color,
                  }}
                />
                {acc.name}
              </Button>
            ))}
          </Box>

          <Typography sx={{ color: '#475569', fontSize: '0.7rem', mt: 2, textAlign: 'center' }}>
            Passwords are verified server-side using bcrypt.
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
