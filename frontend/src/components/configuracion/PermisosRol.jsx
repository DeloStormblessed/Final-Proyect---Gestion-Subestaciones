// Tabla de permisos verificada contra el middleware requireRol del backend
// y la autorización híbrida de las rutas de OT (OPERARIO solo INSPECCION).
import RolBadge from '../RolBadge.jsx';

const ROLES = ['OPERARIO', 'TECNICO', 'ADMIN'];

// Permisos derivados del backend: routes.js de cada feature + middleware requireRol
const FILAS = [
  { capacidad: 'Ver activos y subestaciones',       OPERARIO: true,  TECNICO: true,  ADMIN: true  },
  { capacidad: 'Crear activo',                       OPERARIO: false, TECNICO: true,  ADMIN: true  },
  { capacidad: 'Editar activo',                      OPERARIO: false, TECNICO: true,  ADMIN: true  },
  { capacidad: 'Ver historial de OTs',               OPERARIO: true,  TECNICO: true,  ADMIN: true  },
  { capacidad: 'Crear OT — tipo INSPECCION',         OPERARIO: true,  TECNICO: true,  ADMIN: true  },
  { capacidad: 'Crear OT — tipo PREVENTIVO / CORRECTIVO', OPERARIO: false, TECNICO: true, ADMIN: true },
  { capacidad: 'Crear OT — tipo INSTALACION / BAJA', OPERARIO: false, TECNICO: true,  ADMIN: true  },
  { capacidad: 'Gestión de usuarios',                OPERARIO: false, TECNICO: false, ADMIN: true  },
  { capacidad: 'Acceso a /configuracion',            OPERARIO: false, TECNICO: false, ADMIN: true  },
];

export default function PermisosRol() {
  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <table style={estilos.tabla}>
        <thead>
          <tr>
            <th style={estilos.th}>Capacidad</th>
            {ROLES.map(rol => (
              <th key={rol} style={{ ...estilos.th, textAlign: 'center' }}>
                <RolBadge rol={rol} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FILAS.map((fila, i) => (
            <tr
              key={fila.capacidad}
              style={{ background: i % 2 === 0 ? '#fff' : '#F9F9F9' }}
            >
              <td style={estilos.td}>{fila.capacidad}</td>
              {ROLES.map(rol => (
                <td key={rol} style={{ ...estilos.td, textAlign: 'center' }}>
                  {fila[rol]
                    ? <Checkmark />
                    : <span style={{ color: '#bbb', fontSize: '1.1rem', fontWeight: 700 }}>—</span>
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Checkmark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="var(--color-primario)" />
      <polyline points="7 12 10.5 15.5 17 9" fill="none" stroke="#0E0E0E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mismo patrón que Activos.jsx y OrdenesTrabajo.jsx
const estilos = {
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left', padding: '0.5rem 0.75rem',
    fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    background: '#F5F5F5', borderBottom: '1px solid #E8E8E8',
  },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle', color: '#1A1A1A' },
};
