import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/dashboard',         label: 'Dashboard' },
  { to: '/activos',           label: 'Activos'   },
  { to: '/ordenes-trabajo',   label: 'Órdenes'   },
  { to: '/chat',              label: 'Asistente' },
];

const ROL_COLOR = {
  ADMIN:    '#9C8CF7',
  TECNICO:  '#A4C63A',
  OPERARIO: '#FEBD01',
};

export default function Topbar() {
  const { usuario } = useAuth();

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
