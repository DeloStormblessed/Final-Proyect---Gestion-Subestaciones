import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import TipoBadge from '../components/TipoBadge.jsx';

const C = {
  primario:  '#A4C63A',
  rojo:      '#FC5779',
  ambar:     '#FEBD01',
  violeta:   '#9C8CF7',
  oliva:     '#C9C466',
  gris:      '#9AA0A6',
  nav:       '#0E0E0E',
};

const COLOR_ESTADO = {
  EN_SERVICIO:       C.primario,
  AVERIADO:          C.rojo,
  FUERA_DE_SERVICIO: C.ambar,
  DADO_DE_BAJA:      C.gris,
};

const COLOR_TIPO = {
  CORRECTIVO:  C.rojo,
  PREVENTIVO:  C.primario,
  INSPECCION:  C.violeta,
  INSTALACION: C.oliva,
  BAJA:        C.gris,
};

const LABEL_ESTADO = {
  EN_SERVICIO:       'En servicio',
  AVERIADO:          'Averiado',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA:      'Dado de baja',
};

const LABEL_TIPO = {
  CORRECTIVO:  'Correctivo',
  PREVENTIVO:  'Preventivo',
  INSPECCION:  'Inspección',
  INSTALACION: 'Instalación',
  BAJA:        'Baja',
};

// Genera buckets semanales para los últimos numMeses meses (4 puntos por mes)
// Genera buckets semanales para los últimos numMeses meses (4 puntos por mes)
function ultimasSemanas(numMeses = 6) {
  const semanas = [];
  const ahora = new Date();
  const fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - numMeses + 1, 1);

  let cursor = new Date(fechaInicio);
  let mesVisto = null;

  while (cursor <= ahora) {
    const finSemana = new Date(cursor);
    finSemana.setDate(finSemana.getDate() + 6);

    const mesKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    // Etiqueta visible: solo en la primera semana de cada mes
    const label = mesKey !== mesVisto
      ? cursor.toLocaleDateString('es-ES', { month: 'short' })
      : '';
    if (mesKey !== mesVisto) mesVisto = mesKey;

    semanas.push({
      id:    cursor.toISOString().slice(0, 10), // clave única para recharts
      label,
      inicio: new Date(cursor),
      fin:    new Date(Math.min(finSemana.getTime(), ahora.getTime())),
    });

    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

// Calcula la serie semanal con 3 métricas.
// "Atraso" usa el mismo criterio que el KPI topInspeccionesAtrasadas:
// activos cuya fechaProximaInspeccion ya ha vencido en cada punto del tiempo.
// Así el valor final del gráfico coincide con el número del KPI.
function calcularSerie(ots, semanas, activosAtrasados) {
  let acumAbiertos    = 0;
  let acumCompletados = 0;

  return semanas.map(({ id, label, inicio, fin }) => {
    const bucket = ots.filter(ot => {
      const f = new Date(ot.fechaIntervencion ?? ot.createdAt);
      return f >= inicio && f <= fin;
    });

    acumAbiertos    += bucket.length;
    acumCompletados += bucket.filter(o => o.tipo === 'INSPECCION' || o.tipo === 'PREVENTIVO').length;

    // Cuenta cuántos activos tenían ya su inspección vencida al final de esta semana
    const atraso = activosAtrasados.filter(a =>
      new Date(a.fechaProximaInspeccion) <= fin
    ).length;

    return { id, label, abiertos: acumAbiertos, completados: acumCompletados, atraso };
  });
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Dot con número encima — para OT abiertos y OT completados
function DotConLabel({ cx, cy, value, color }) {
  if (cx === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>
        {value}
      </text>
    </g>
  );
}

// Dot con badge ámbar encima — para Atraso
function DotAmbar({ cx, cy, value }) {
  if (cx === undefined) return null;
  const w = Math.max(20, String(value).length * 7 + 12);
  const h = 16;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={C.ambar} stroke="#fff" strokeWidth={1.5} />
      <rect x={cx - w / 2} y={cy - h - 8} width={w} height={h} rx={3} fill={C.ambar} />
      <text x={cx} y={cy - h / 2 - 8} textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={700} fill="#fff">{value}</text>
    </g>
  );
}

function TooltipLineas({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '0.65rem 0.9rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem', minWidth: 150 }}>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.25rem', color: p.color, marginBottom: 3 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}


export default function Dashboard() {
  const { token } = useAuth();
  const [datos, setDatos] = useState(null);
  const [serieOTs, setSerieOTs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // null = mostrar último punto por defecto; se actualiza con el hover
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => {
    const semanas = ultimasSemanas(6);

    Promise.all([
      apiFetch('/api/v1/dashboard', {}, token),
      // 100 OTs es suficiente para el seed; en producción ampliar o paginar
      apiFetch('/api/v1/ordenes-trabajo?limite=100&pagina=1', {}, token),
    ])
      .then(([dashboard, otsResp]) => {
        setDatos(dashboard);
        setSerieOTs(calcularSerie(
          otsResp.datos ?? [],
          semanas,
          dashboard.topInspeccionesAtrasadas ?? [],
        ));
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [token]);

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <span className="spinner" />
    </div>
  );
  if (error) return <p className="banner-error">{error}</p>;
  if (!datos) return null;

  const { activosPorEstado, inspeccionesVencidas, topInspeccionesAtrasadas, otsUltimos30DiasPorTipo, ultimasOrdenesTrabajo } = datos;
  const totalActivos = Object.values(activosPorEstado).reduce((s, v) => s + v, 0);

  const donutEstado = Object.entries(activosPorEstado)
    .filter(([, v]) => v > 0)
    .map(([estado, value]) => ({ name: LABEL_ESTADO[estado], value, estado }));

  const donutTipo = Object.entries(otsUltimos30DiasPorTipo)
    .filter(([, v]) => v > 0)
    .map(([tipo, value]) => ({ name: LABEL_TIPO[tipo] ?? tipo, value, tipo }));

  const hayDatosSerie = serieOTs.some(m => m.abiertos > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>


      {/* ── KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <KpiCard titulo="Activos totales"  valor={totalActivos}                 color={C.nav} />
        <KpiCard titulo="En servicio"      valor={activosPorEstado.EN_SERVICIO} color={C.primario} valorArriba />
        <KpiCard titulo="Averiados"        valor={activosPorEstado.AVERIADO}    color={C.rojo}    valorArriba />
        <KpiCard titulo="Insp. vencidas"   valor={inspeccionesVencidas}         color={C.ambar}   valorArriba />
      </div>

      {/* ── Gráfico de líneas + donuts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>

        {/* Gráfico de líneas: atraso de mantenimiento (acumulado semanal) */}
        {(() => {
          // Punto activo: hover actualiza activeIdx; por defecto muestra el último dato
          const punto = serieOTs[activeIdx ?? serieOTs.length - 1];
          return (
            <div style={{ ...s.card, gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
              {/* Título + leyenda con valores integrados en una sola línea */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <p style={{ ...s.cardTitle, marginBottom: 0 }}>Atraso de mantenimiento</p>
                {punto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.82rem' }}>
                    <span style={{ color: C.rojo, fontWeight: 700 }}>{punto.abiertos}</span>
                    <span style={{ color: '#1A1A1A' }}>OT abiertos</span>
                    <span style={{ color: C.primario, fontWeight: 700, marginLeft: '1.25rem' }}>{punto.completados}</span>
                    <span style={{ color: '#1A1A1A' }}>OT completados</span>
                    <span style={{ color: C.ambar, fontWeight: 700, marginLeft: '1.25rem' }}>{punto.atraso}</span>
                    <span style={{ color: '#1A1A1A' }}>atrasos</span>
                  </div>
                )}
              </div>

              {!hayDatosSerie ? (
                <div style={{ textAlign: 'center', color: '#ccc', padding: '3rem 0', fontSize: '0.85rem' }}>
                  Sin historial de órdenes de trabajo
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={serieOTs}
                      margin={{ top: 20, right: 16, left: 8, bottom: 4 }}
                      onMouseMove={(s) => {
                        if (s.isTooltipActive && s.activeTooltipIndex != null)
                          setActiveIdx(s.activeTooltipIndex);
                      }}
                      onMouseLeave={() => setActiveIdx(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                      <XAxis
                        dataKey="id"
                        tick={{ fontSize: 11, fill: '#1A1A1A' }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(_id, index) => serieOTs[index]?.label ?? ''}
                      />
                      <Tooltip content={() => null} cursor={{ stroke: '#e0e0e0', strokeWidth: 1 }} />
                      <Line type="linear" dataKey="abiertos"    stroke={C.rojo}    strokeWidth={2.5} dot={{ r: 3, fill: C.rojo,    strokeWidth: 0 }} activeDot={false} />
                      <Line type="linear" dataKey="completados" stroke={C.primario} strokeWidth={2.5} dot={{ r: 3, fill: C.primario, strokeWidth: 0 }} activeDot={false} />
                      <Line type="linear" dataKey="atraso"      stroke={C.ambar}   strokeWidth={2}   dot={{ r: 3, fill: C.ambar,   strokeWidth: 0 }} activeDot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })()}

        {/* Donuts apilados — la columna estira para igualar la altura del gráfico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={s.cardTitle}>Activos por estado</p>
            {donutEstado.length === 0 ? <Empty /> : (
              <DonutConLeyenda
                datos={donutEstado}
                colorKey="estado"
                colorMap={COLOR_ESTADO}
              />
            )}
          </div>

          <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={s.cardTitle}>OTs por tipo (30 días)</p>
            {donutTipo.length === 0 ? <Empty /> : (
              <DonutConLeyenda
                datos={donutTipo}
                colorKey="tipo"
                colorMap={COLOR_TIPO}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Fila inferior: estado del parque + últimas OTs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>

        {/* Estado del parque con barra de progreso */}
        <div style={s.card}>
          <p style={s.cardTitle}>Estado del parque</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}>
            {Object.entries(activosPorEstado).map(([estado, total]) => (
              <div key={estado}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_ESTADO[estado] ?? C.gris }} />
                    <span style={{ fontSize: '0.88rem', color: '#1A1A1A' }}>{LABEL_ESTADO[estado]}</span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1A1A1A' }}>{total}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0' }}>
                  <div style={{
                    width: `${totalActivos ? (total / totalActivos) * 100 : 0}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: COLOR_ESTADO[estado] ?? C.gris,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Inspecciones atrasadas */}
          {topInspeccionesAtrasadas.length > 0 && (
            <>
              <p style={{ ...s.cardTitle, marginTop: '1.5rem' }}>Top inspecciones atrasadas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {topInspeccionesAtrasadas.slice(0, 4).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{a.codigo}</span>
                    <span style={{ color: C.rojo, fontWeight: 700 }}>+{a.diasDeRetraso}d</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Últimas OTs */}
        <div style={s.card}>
          <p style={s.cardTitle}>Últimas órdenes de trabajo</p>
          {ultimasOrdenesTrabajo.length === 0
            ? <Empty texto="Sin órdenes recientes" />
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.tabla}>
                  <thead>
                    <tr>
                      <th style={s.th}>Tipo</th>
                      <th style={s.th}>Activo</th>
                      <th style={s.th}>Resultado</th>
                      <th style={s.th}>Fecha</th>
                      <th style={s.th}>Técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasOrdenesTrabajo.map(ot => (
                      <tr key={ot.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={s.td}><TipoBadge tipo={ot.tipo} /></td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{ot.activo?.codigo ?? '—'}</td>
                        <td style={{ ...s.td, color: ot.resultado === 'NO_CONFORME' ? C.rojo : ot.resultado === 'CONFORME' ? C.primario : '#1A1A1A', fontWeight: 600 }}>
                          {ot.resultado ?? '—'}
                        </td>
                        <td style={{ ...s.td, color: '#1A1A1A' }}>{formatFecha(ot.fechaIntervencion)}</td>
                        <td style={{ ...s.td, color: '#1A1A1A' }}>{ot.autor?.nombre ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ── Componentes de apoyo ──

function DonutConLeyenda({ datos, colorKey, colorMap }) {
  const total = datos.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flexShrink: 0, width: 150, height: 150, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
              paddingAngle={2} dataKey="value" labelLine={false}>
              {datos.map(e => <Cell key={e[colorKey]} fill={colorMap[e[colorKey]] ?? C.gris} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total en el centro del hueco del donut */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', textAlign: 'center',
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>{total}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0 }}>
        {datos.map(e => (
          <div key={e[colorKey]} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colorMap[e[colorKey]] ?? C.gris, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>
              {e.value} <span style={{ fontWeight: 400, color: colorMap[e[colorKey]] ?? C.gris }}>({total ? Math.round(e.value / total * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ titulo, valor, color, valorArriba = false }) {
  const numero = <span style={{ fontSize: '4rem', fontWeight: 800, lineHeight: 1, color }}>{valor}</span>;
  const etiqueta = <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1A1A1A' }}>{titulo}</span>;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '1.5rem 1rem',
      border: `2px solid ${color}`,
      boxShadow: `0 4px 20px ${color}28`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.35rem',
      textAlign: 'center',
    }}>
      {valorArriba ? <>{numero}{etiqueta}</> : <>{etiqueta}{numero}</>}
    </div>
  );
}

function Empty({ texto = 'Sin datos' }) {
  return <div style={{ textAlign: 'center', color: '#ddd', padding: '1.5rem 0', fontSize: '0.85rem' }}>{texto}</div>;
}

const s = {
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTitle: { fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A1A1A', marginBottom: '0.75rem' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.6rem', fontWeight: 700, color: '#1A1A1A', fontSize: '0.8rem', textTransform: 'uppercase', borderBottom: '1px solid #f0f0f0' },
  td: { padding: '0.55rem 0.6rem', verticalAlign: 'middle' },
};
