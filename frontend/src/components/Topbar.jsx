import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/dashboard',        label: 'Dashboard' },
  { to: '/activos',          label: 'Activos'   },
  { to: '/ordenes-trabajo',  label: 'Órdenes'   },
  { to: '/chat',             label: 'Asistente' },
];

const ROL_COLOR = {
  ADMIN:    '#9C8CF7',
  TECNICO:  '#A4C63A',
  OPERARIO: '#FEBD01',
};

export default function Topbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const menuRef = useRef(null);

  // Cierra el dropdown al hacer click fuera o al pulsar Escape.
  // Los listeners se registran solo cuando el menú está abierto para no acumular handlers.
  useEffect(() => {
    if (!abierto) return;

    function handleClickFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setAbierto(false);
    }

    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [abierto]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header style={{
      height: 60,
      background: '#fff',
      borderBottom: '1px solid #eee',
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 9,
    }}>

      {/* Tabs de navegación */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              padding: '0.25rem 0.85rem',
              borderRadius: 999,
              fontSize: '0.82rem',
              fontWeight: 700,
              background: isActive ? '#0E0E0E' : 'transparent',
              color: isActive ? '#fff' : '#aaa',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Info de usuario — siempre a la derecha, ancho fijo para no mover el layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>

        {/* Menú de configuración — visible para todos los roles.
            Ocultar "Configuración" para no-ADMIN es solo UX: el acceso real lo
            controla RutaAdmin (guard de ruta) + la autorización del backend.
            Un TECNICO que teclee /configuracion es redirigido a /dashboard. */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAbierto(a => !a)}
            title="Menú"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              color: abierto ? '#1A1A1A' : '#888',
              transition: 'color 0.15s',
            }}
          >
            <Settings size={20} />
          </button>

          {abierto && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 50,
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              minWidth: 160,
              overflow: 'hidden',
            }}>
              {/* "Configuración" solo para ADMIN: el resto ni lo ve */}
              {usuario?.rol === 'ADMIN' && (
                <ItemMenu
                  onClick={() => { navigate('/configuracion'); setAbierto(false); }}
                  label="Configuración"
                />
              )}
              <ItemMenu
                onClick={handleLogout}
                label="Cerrar sesión"
                danger
              />
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', minWidth: 0, maxWidth: 160, overflow: 'hidden' }}>
          <div style={{
            fontSize: '0.85rem', fontWeight: 600, color: '#1A1A1A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {usuario?.nombre}
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: ROL_COLOR[usuario?.rol] ?? '#aaa' }}>
            {usuario?.rol}
          </div>
        </div>
        <div style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: ROL_COLOR[usuario?.rol] ?? '#eee',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', fontWeight: 700, color: '#0E0E0E',
          flexShrink: 0,
        }}>
          {usuario?.nombre?.charAt(0).toUpperCase() ?? '?'}
        </div>
      </div>
    </header>
  );
}

function ItemMenu({ onClick, label, danger = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '0.6rem 1rem',
        background: hover ? '#F6F6F6' : 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: danger ? '#FC5779' : '#1A1A1A',
        fontWeight: 500,
        transition: 'background 0.12s',
      }}
    >
      {label}
    </button>
  );
}
