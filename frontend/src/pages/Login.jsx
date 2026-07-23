import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import { useAuth } from '../context/AuthContext'
import { palette, shadow } from '../theme/tokens'

const DEMO = [
  { role: 'Admin',   name: 'Alice Fernandes', title: 'Head of PMO',
    email: 'alice.admin@acme.com',  password: 'Admin@123',   color: '#7A5AF8' },
  { role: 'Manager', name: 'Michael Rao',     title: 'Engineering Manager',
    email: 'michael.rao@acme.com',  password: 'Manager@123', color: '#4F46E5' },
  { role: 'Member',  name: 'Sana Kapoor',     title: 'Senior Backend Engineer',
    email: 'sana.kapoor@acme.com',  password: 'Member@123',  color: '#0E9384' },
]

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (email, password) => {
    setError(''); setLoading(true)
    const res = await login(email, password)
    setLoading(false)
    if (res.success) navigate('/', { replace: true })
    else setError(res.message)
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      {/* Left: the product's own claim, stated plainly */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between',
        bgcolor: palette.navBg, p: 6, color: '#fff',
      }}>
        <Typography sx={{ fontWeight: 750, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>
          ACME<Box component="span" sx={{ color: '#818CF8' }}> Project Hub</Box>
        </Typography>

        <Box sx={{ maxWidth: 420 }}>
          <Typography sx={{
            fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.035em',
            lineHeight: 1.15, mb: 2,
          }}>
            Every project, every hour, every rupee —
            <Box component="span" sx={{ color: '#818CF8' }}> in one place.</Box>
          </Typography>
          <Typography sx={{ color: '#98A2B3', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Track delivery progress, spot projects slipping before the deadline,
            see who is over-allocated, and keep spend against plan honest.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 4 }}>
          {[['6', 'Projects tracked'], ['10', 'Team members'], ['4', 'Departments']].map(([n, l]) => (
            <Box key={l}>
              <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{n}</Typography>
              <Typography sx={{ color: '#667085', fontSize: '0.75rem' }}>{l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right: sign in */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 5 } }}>
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Typography variant="h5" sx={{ mb: 0.5 }}>Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use your ACME employee account.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={e => { e.preventDefault(); submit(form.email, form.password) }}>
            <TextField fullWidth label="Work email" name="email" type="email" required
              value={form.email} onChange={change} autoComplete="username" sx={{ mb: 2 }} />
            <TextField fullWidth label="Password" name="password" type="password" required
              value={form.password} onChange={change} autoComplete="current-password" />
            <Button type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ mt: 2.5, py: 1.15 }}>
              {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Sign in'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="overline" color="text.secondary">Demo accounts</Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {DEMO.map(d => (
              <Paper key={d.email} onClick={() => !loading && submit(d.email, d.password)}
                sx={{
                  p: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                  transition: 'border-color .15s ease, box-shadow .15s ease',
                  '&:hover': { borderColor: palette.accent, boxShadow: shadow.sm },
                }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: d.color, fontSize: '0.75rem' }}>
                  {initials(d.name)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>{d.name}</Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block' }}>{d.title}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: d.color, fontWeight: 700 }}>{d.role}</Typography>
              </Paper>
            ))}
          </Box>

          <Typography variant="caption" sx={{ display: 'block', mt: 2.5, textAlign: 'center' }}>
            Passwords are verified server-side with bcrypt.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
