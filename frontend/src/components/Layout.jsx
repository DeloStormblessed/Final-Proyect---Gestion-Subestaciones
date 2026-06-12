import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Topbar from './Topbar.jsx';
import ChatWidget from './ChatWidget.jsx';

// SVG inline — sin dependencias de iconografía externa
const IconDashboard = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconActivos = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
    <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
  </svg>
);

const IconOrdenes = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

const IconLogout = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconLogo = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

// El asistente IA ya no es una ruta: es el widget flotante (ChatWidget)
const NAV_ITEMS = [
  { to: '/dashboard',        label: 'Dashboard', Icon: IconDashboard },
  { to: '/activos',          label: 'Activos',   Icon: IconActivos   },
  { to: '/ordenes-trabajo',  label: 'Órdenes',   Icon: IconOrdenes   },
];

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [logoutHover, setLogoutHover] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F0F2F5', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 72,
        background: '#0E0E0E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.25rem 0',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          width: 44, height: 44,
          background: '#A4C63A',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '2rem',
          flexShrink: 0,
        }}>
          <IconLogo size={20} color="#0E0E0E" />
        </div>

        {/* Links de navegación */}
        <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <SideNavItem key={to} to={to} label={label} Icon={Icon} />
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: logoutHover ? '#FC5779' : '#1a1a1a',
            border: `2px solid ${logoutHover ? '#FC5779' : '#333'}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <IconLogout size={16} color={logoutHover ? '#fff' : '#666'} />
        </button>
      </aside>

      {/* ── Contenido principal ── */}
      <div style={{ flex: 1, marginLeft: 72, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Topbar />
        {/* El padding vive en .contenido-principal: se reduce en tablet vía media query */}
        <main className="contenido-principal" style={{ flex: 1, overflow: 'auto', scrollbarGutter: 'stable' }}>
          <Outlet />
        </main>
      </div>

      {/* Asistente IA flotante: dentro de Layout para que su estado (la
          conversación) sobreviva a la navegación y muera con el logout */}
      <ChatWidget />
    </div>
  );
}

function SideNavItem({ to, label, Icon }) {
  const [hover, setHover] = useState(false);
  return (
    <NavLink
      to={to}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 10,
        background: isActive ? '#A4C63A' : hover ? 'rgba(255,255,255,0.07)' : 'transparent',
        transition: 'background 0.15s',
        cursor: 'pointer',
      })}
    >
      {({ isActive }) => (
        <Icon size={20} color={isActive ? '#0E0E0E' : hover ? '#bbb' : '#666'} />
      )}
    </NavLink>
  );
}
