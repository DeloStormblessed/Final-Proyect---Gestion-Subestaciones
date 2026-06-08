import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const data = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(data.usuario, data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={estilos.pagina}>
      <div style={estilos.tarjeta}>
        <h1 style={estilos.titulo}>⚡ GMAO Subestaciones</h1>
        <p style={estilos.subtitulo}>Inicia sesión para continuar</p>

        {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={estilos.form}>
          <label style={estilos.label}>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={estilos.input}
              placeholder="usuario@empresa.com"
            />
          </label>

          <label style={estilos.label}>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              style={estilos.input}
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <button
            type="submit"
            disabled={cargando}
            className="btn-primario"
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: '#666' }}>
          ¿Sin cuenta?{' '}
          <Link to="/registro" style={{ color: 'var(--color-primario)', fontWeight: 600 }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-fondo-suave)',
    padding: '1rem',
  },
  tarjeta: {
    background: 'var(--color-fondo)',
    borderRadius: 12,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  titulo: {
    fontSize: '1.4rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
    color: 'var(--color-texto)',
  },
  subtitulo: {
    color: '#666',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-texto)',
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
};
