import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/activos',   label: 'Activos',   icon: '⚡' },
  { to: '/chat',      label: 'Asistente', icon: '🤖' },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: 'var(--color-nav)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 1.25rem 1.5rem', borderBottom: '1px solid #222' }}>
          <span style={{ color: 'var(--color-primario)', fontWeight: 700, fontSize: '1rem' }}>
            ⚡ GMAO
          </span>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 1.25rem',
                color: isActive ? 'var(--color-primario)' : '#aaa',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.9rem',
                borderLeft: isActive ? '3px solid var(--color-primario)' : '3px solid transparent',
                transition: 'all 0.15s',
              })}
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #222' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#aaa',
              padding: '0.4rem 0.75rem',
              borderRadius: 4,
              fontSize: '0.8rem',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Cabecera */}
        <header style={{
          background: 'var(--color-fondo)',
          borderBottom: '1px solid #eee',
          padding: '0.85rem 2rem',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            {usuario?.nombre}
          </span>
          <span style={{
            background: 'var(--color-fondo-suave)',
            border: '1px solid #ddd',
            padding: '0.15rem 0.5rem',
            borderRadius: 4,
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#555',
          }}>
            {usuario?.rol}
          </span>
        </header>

        {/* Página activa */}
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
