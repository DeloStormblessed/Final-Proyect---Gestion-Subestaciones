import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import TipoBadge from '../components/TipoBadge.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { derivarEstado } from '../lib/estadoVisual.js';

const C = {
  primario:  '#16A34A',  // EN_SERVICIO
  rojo:      '#EF4444',  // AVERIADO
  ambar:     '#D97706',  // FUERA_DE_SERVICIO / atraso
  violeta:   '#1D4ED8',  // INSPECCION
  oliva:     '#6D28D9',  // INSTALACION
  gris:      '#4B5563',  // DADO_DE_BAJA / BAJA
  nav:       '#0E0E0E',
};

const COLOR_ESTADO = {
  EN_SERVICIO:       '#16A34A',
  AVERIADO:          '#EF4444',
  FUERA_DE_SERVICIO: '#D97706',
  DADO_DE_BAJA:      '#4B5563',
};

const COLOR_TIPO = {
  CORRECTIVO:  '#A21CAF',
  PREVENTIVO:  '#0F766E',
  INSPECCION:  '#1D4ED8',
  INSTALACION: '#6D28D9',
  BAJA:        '#4B5563',
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
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredActivo, setHoveredActivo] = useState(null);

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
  // suma de otsUltimos30DiasPorTipo: mismo dato que agrega el donut, sin cálculo nuevo de dominio
  const totalOTs30dias = Object.values(otsUltimos30DiasPorTipo).reduce((s, v) => s + v, 0);

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
      {/* auto-fit colapsa a 2 columnas en tablet y a 1 en móvil sin media queries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <KpiCard titulo="Activos totales"  valor={totalActivos}                 color={C.nav} />
        <KpiCard titulo="En servicio"      valor={activosPorEstado.EN_SERVICIO} color={C.primario} valorArriba />
        <KpiCard titulo="Averiados"        valor={activosPorEstado.AVERIADO}    color={C.rojo}    valorArriba />
        <KpiCard titulo="Insp. vencidas"   valor={inspeccionesVencidas}         color={C.ambar}   valorArriba />
        <KpiCard titulo="OTs (30 días)"    valor={totalOTs30dias}               color={C.violeta} valorArriba />
      </div>

      {/* ── Gráfico de líneas + columna derecha ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'stretch' }}>

        {/* Gráfico de líneas: atraso de mantenimiento (acumulado semanal) */}
        {(() => {
          // Punto activo: hover actualiza activeIdx; por defecto muestra el último dato
          const punto = serieOTs[activeIdx ?? serieOTs.length - 1];
          return (
            <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
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

        {/* Columna derecha: donuts en fila + top atrasadas debajo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
            <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={s.cardTitle}>Activos por estado</p>
              {donutEstado.length === 0 ? <Empty /> : (
                <DonutConLeyenda
                  datos={donutEstado}
                  colorKey="estado"
                  colorMap={COLOR_ESTADO}
                />
              )}
            </div>

            <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
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

          <div style={s.card}>
            <p style={s.cardTitle}>Top inspecciones atrasadas</p>
            {topInspeccionesAtrasadas.length === 0 ? <Empty texto="Sin atrasos" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {topInspeccionesAtrasadas.slice(0, 4).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{a.codigo}</span>
                    <span style={{ color: C.rojo, fontWeight: 700 }}>+{a.diasDeRetraso}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Fila inferior: últimas OTs a ancho completo ── */}
      <div>

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
                      <th style={s.th}>Fecha</th>
                      <th style={s.th}>Activo</th>
                      <th style={s.th}>Estado</th>
                      <th style={s.th}>Tipo</th>
                      <th style={s.th}>Resultado</th>
                      <th style={s.th} className="col-secundaria">Técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasOrdenesTrabajo.map((ot, idx) => (
                      <tr
                        key={ot.id}
                        onMouseEnter={() => setHoveredRow(ot.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          background: hoveredRow === ot.id ? '#F0F0F0' : idx % 2 === 0 ? '#fff' : '#F9F9F9',
                          transition: 'background 0.1s',
                        }}
                      >
                        <td style={{ ...s.td, color: C.gris, fontSize: '0.82rem' }}>{formatFecha(ot.fechaIntervencion)}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>
                          {ot.activo?.id ? (
                            <Link
                              to={`/activos/${ot.activo.id}`}
                              style={{
                                color: C.primario,
                                textDecoration: hoveredActivo === ot.id ? 'underline' : 'none',
                                background: hoveredActivo === ot.id ? 'rgba(22,163,74,0.12)' : 'transparent',
                                borderRadius: 4,
                                padding: '2px 4px',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={() => setHoveredActivo(ot.id)}
                              onMouseLeave={() => setHoveredActivo(null)}
                            >
                              {ot.activo.codigo}
                            </Link>
                          ) : '—'}
                        </td>
                        <td style={s.td}>
                          <EstadoBadge estado={derivarEstado(ot.cicloVidaNueva, ot.disponibilidadNueva)} />
                        </td>
                        <td style={s.td}><TipoBadge tipo={ot.tipo} /></td>
                        <td style={{ ...s.td, color: ot.resultado === 'NO_CONFORME' ? C.rojo : ot.resultado === 'CONFORME' ? C.primario : '#1A1A1A', fontWeight: 600 }}>
                          {ot.resultado === 'NO_CONFORME' ? 'NO CONFORME' : ot.resultado ?? '—'}
                        </td>
                        <td style={{ ...s.td, color: C.gris }} className="col-secundaria">{ot.autor?.nombre ?? '—'}</td>
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
    // columna: donut arriba, leyenda abajo, espacio distribuido uniformemente
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', flex: 1, minHeight: 0 }}>
      <div style={{ flexShrink: 0, width: 150, height: 150, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
              paddingAngle={2} dataKey="value" labelLine={false}>
              {datos.map(e => <Cell key={e[colorKey]} fill={colorMap[e[colorKey]] ?? C.gris} />)}
            </Pie>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
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
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#F5F5F5', borderBottom: '1px solid #E8E8E8' },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' },
};
