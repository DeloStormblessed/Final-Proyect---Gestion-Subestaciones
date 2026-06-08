import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import TipoBadge from '../components/TipoBadge.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';

const COLORES_ESTADO = {
  EN_SERVICIO:       'var(--color-primario)',
  AVERIADO:          'var(--color-rojo)',
  FUERA_DE_SERVICIO: 'var(--color-ambar)',
  DADO_DE_BAJA:      'var(--color-gris)',
};

// Colores planos para recharts (no acepta var(--css))
const COLORES_TIPO_HEX = {
  CORRECTIVO:  '#FC5779',
  PREVENTIVO:  '#A4C63A',
  INSPECCION:  '#9C8CF7',
  INSTALACION: '#C9C466',
  BAJA:        '#9AA0A6',
};

const ETIQUETA_ESTADO = {
  EN_SERVICIO:       'En servicio',
  AVERIADO:          'Averiado',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA:      'Dado de baja',
};

const ETIQUETA_TIPO = {
  CORRECTIVO:  'Correctivo',
  PREVENTIVO:  'Preventivo',
  INSPECCION:  'Inspección',
  INSTALACION: 'Instalación',
  BAJA:        'Baja',
};

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const { token } = useAuth();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/v1/dashboard', {}, token)
      .then(setDatos)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [token]);

  if (cargando) return <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>;
  if (error) return <p className="banner-error">{error}</p>;
  if (!datos) return null;

  const { activosPorEstado, inspeccionesVencidas, topInspeccionesAtrasadas, otsUltimos30DiasPorTipo, ultimasOrdenesTrabajo } = datos;

  // Datos para el donut de OTs por tipo
  const donutData = Object.entries(otsUltimos30DiasPorTipo)
    .filter(([, v]) => v > 0)
    .map(([tipo, value]) => ({ name: ETIQUETA_TIPO[tipo] ?? tipo, value, tipo }));

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Dashboard</h2>

      {/* Tarjetas KPI: activos por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {Object.entries(activosPorEstado).map(([estado, total]) => (
          <div key={estado} style={{
            background: 'var(--color-fondo)',
            borderRadius: 10,
            padding: '1.25rem 1rem',
            borderLeft: `4px solid ${COLORES_ESTADO[estado] ?? '#ddd'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.35rem' }}>
              {ETIQUETA_ESTADO[estado] ?? estado}
            </div>
          </div>
        ))}
      </div>

      {/* Segunda fila: donut + inspecciones vencidas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Donut OTs últimos 30 días */}
        <div style={estilos.bloque}>
          <h3 style={estilos.bloqueTitle}>OTs últimos 30 días por tipo</h3>
          {donutData.length === 0
            ? <p style={estilos.vacio}>Sin órdenes de trabajo en los últimos 30 días</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.tipo} fill={COLORES_TIPO_HEX[entry.tipo] ?? '#ccc'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Inspecciones vencidas */}
        <div style={estilos.bloque}>
          <h3 style={estilos.bloqueTitle}>Inspecciones vencidas</h3>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-rojo)', marginBottom: '1rem' }}>
            {inspeccionesVencidas}
          </div>
          {topInspeccionesAtrasadas.length === 0
            ? <p style={estilos.vacio}>Ninguna inspección atrasada</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topInspeccionesAtrasadas.slice(0, 5).map(activo => (
                  <div key={activo.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.825rem',
                    padding: '0.4rem 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}>
                    <span style={{ fontWeight: 600 }}>{activo.codigo}</span>
                    <span style={{ color: 'var(--color-rojo)', fontWeight: 600 }}>
                      +{activo.diasDeRetraso}d
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Últimas OTs */}
      <div style={estilos.bloque}>
        <h3 style={estilos.bloqueTitle}>Últimas órdenes de trabajo</h3>
        {ultimasOrdenesTrabajo.length === 0
          ? <p style={estilos.vacio}>Sin órdenes de trabajo recientes</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={estilos.tabla}>
                <thead>
                  <tr>
                    <th style={estilos.th}>Tipo</th>
                    <th style={estilos.th}>Activo</th>
                    <th style={estilos.th}>Resultado</th>
                    <th style={estilos.th}>Fecha</th>
                    <th style={estilos.th}>Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasOrdenesTrabajo.map(ot => (
                    <tr key={ot.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={estilos.td}><TipoBadge tipo={ot.tipo} /></td>
                      <td style={estilos.td}>{ot.activo?.codigo ?? '—'}</td>
                      <td style={estilos.td}>{ot.resultado ?? '—'}</td>
                      <td style={estilos.td}>{formatFecha(ot.fechaIntervencion)}</td>
                      <td style={estilos.td}>{ot.autor?.nombre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

const estilos = {
  bloque: {
    background: 'var(--color-fondo)',
    borderRadius: 10,
    padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  bloqueTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#555',
    marginBottom: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  vacio: {
    color: '#aaa',
    fontSize: '0.875rem',
    textAlign: 'center',
    padding: '1.5rem 0',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    fontWeight: 600,
    color: '#777',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    borderBottom: '2px solid #f0f0f0',
  },
  td: {
    padding: '0.6rem 0.75rem',
    verticalAlign: 'middle',
  },
};
