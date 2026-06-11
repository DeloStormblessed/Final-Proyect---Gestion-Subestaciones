import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <h1 style={estilos.titulo}>Gestión Subestaciones</h1>
        <br></br>
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
    backgroundImage: 'url(/login-bg.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '1rem',
  },
  tarjeta: {
    background: 'rgba(14, 116, 144, 0.50)',
    borderRadius: 12,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 8px 40px rgba(0,0,0,0.30)',
    backdropFilter: 'blur(4px)',
  },
  titulo: {
    fontSize: '1.4rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
    color: '#fff',
  },
  subtitulo: {
    color: 'rgba(255,255,255,0.75)',
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
    color: 'rgba(255,255,255,0.90)',
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
