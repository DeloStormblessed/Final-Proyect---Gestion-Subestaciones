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
  ADMIN:    '#7C3AED',
  TECNICO:  '#4D7C0F',
  OPERARIO: '#B45309',
};

export default function Topbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [hoverGear, setHoverGear] = useState(false);
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
          <NavPill key={to} to={to} label={label} />
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
            onMouseEnter={() => setHoverGear(true)}
            onMouseLeave={() => setHoverGear(false)}
            title="Menú"
            style={{
              width: 36,
              height: 36,
              background: abierto ? '#E4E4E4' : hoverGear ? '#F0F0F0' : '#fff',
              border: '1px solid #E0E0E0',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              flexShrink: 0,
              color: abierto || hoverGear ? '#1A1A1A' : '#888',
              transition: 'background 0.15s, color 0.15s',
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
          fontSize: '0.85rem', fontWeight: 700, color: '#fff',
          flexShrink: 0,
        }}>
          {usuario?.nombre?.charAt(0).toUpperCase() ?? '?'}
        </div>
      </div>
    </header>
  );
}

function NavPill({ to, label }) {
  const [hover, setHover] = useState(false);
  return (
    <NavLink
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        padding: '0.25rem 0.85rem',
        borderRadius: 999,
        fontSize: '0.82rem',
        fontWeight: 700,
        background: isActive ? '#0E0E0E' : hover ? '#F0F0F0' : 'transparent',
        color: isActive ? '#fff' : hover ? '#1A1A1A' : '#aaa',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap',
      })}
    >
      {label}
    </NavLink>
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
