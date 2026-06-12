import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import ModalNuevaOT from '../components/ModalNuevaOT.jsx';
import TipoBadge from '../components/TipoBadge.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { derivarEstado } from '../lib/estadoVisual.js';

const ETIQUETA_TIPO_ACTIVO = {
  TRANSFORMADOR_POTENCIA:  'Transformador potencia',
  INTERRUPTOR_AUTOMATICO:  'Interruptor automático',
  SECCIONADOR:             'Seccionador',
  PARARRAYOS:              'Pararrayos',
  TRANSFORMADOR_MEDIDA:    'Transformador medida',
  BATERIA_CONDENSADORES:   'Batería condensadores',
};

const TODOS_TIPOS = ['INSPECCION', 'PREVENTIVO', 'CORRECTIVO', 'INSTALACION', 'BAJA'];

const ETIQUETA_TIPO_OT = {
  INSPECCION:  'Inspección',
  PREVENTIVO:  'Preventivo',
  CORRECTIVO:  'Correctivo',
  INSTALACION: 'Instalación',
  BAJA:        'Baja',
};

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}


export default function OrdenesTrabajo() {
  const { token, usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [ots, setOts] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [descExpandida, setDescExpandida] = useState(null);
  const [hoveredDesc, setHoveredDesc] = useState(null);
  const [hoveredActivo, setHoveredActivo] = useState(null);
  const [paginaFiltrada, setPaginaFiltrada] = useState(1);

  // Filtros
  const [tipo, setTipo] = useState('');
  const [subestacionFiltro, setSubestacionFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  // Subestaciones para el selector
  const [subestaciones, setSubestaciones] = useState([]);
  useEffect(() => {
    apiFetch('/api/v1/subestaciones', {}, token)
      .then(data => setSubestaciones(data.datos ?? []))
      .catch(() => {});
  }, [token]);

  // Activos cargados para el cruce activo→subestación en cliente.
  // El backend no filtra OTs por subestación (la OT no tiene subestacionId);
  // construimos un mapa activoId→subestacionId con los activos ya en memoria.
  const [activos, setActivos] = useState([]);
  useEffect(() => {
    apiFetch('/api/v1/activos?limite=100', {}, token)
      .then(data => setActivos(data.datos ?? []))
      .catch(() => {});
  }, [token]);

  const activoSubestMap = useMemo(() => {
    const map = {};
    activos.forEach(a => { map[a.id] = a.subestacion?.id; });
    return map;
  }, [activos]);

  // Si se navega desde la navbar con ?nueva-ot=1, abrir el modal directamente
  useEffect(() => {
    if (searchParams.get('nueva-ot') === '1') {
      setMostrarModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const cargar = useCallback(() => {
    setCargando(true);
    setError('');
    // Cuando hay filtro de subestación (cliente) pedimos el máximo al backend para que
    // el cruce activoId→subestacionId tenga todos los datos, no solo la página actual.
    const limiteEfectivo = subestacionFiltro ? 100 : 20;
    const paginaEfectiva = subestacionFiltro ? 1 : pagina;
    const params = new URLSearchParams({ pagina: paginaEfectiva, limite: limiteEfectivo });
    if (tipo) params.set('tipo', tipo);
    if (fechaDesde) params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params.set('fechaHasta', fechaHasta);

    apiFetch(`/api/v1/ordenes-trabajo?${params}`, {}, token)
      .then(data => {
        setOts(data.datos ?? []);
        setPaginacion(data.paginacion ?? { pagina: 1, totalPaginas: 1 });
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [token, pagina, tipo, fechaDesde, fechaHasta, subestacionFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  // Filtro de subestación en cliente: cruza ot.activo.id con el mapa activoId→subestacionId.
  const otsFiltradas = subestacionFiltro
    ? ots.filter(ot => activoSubestMap[ot.activo?.id] === subestacionFiltro)
    : ots;

  const LIMITE = 20;
  const totalPaginasFiltradas = Math.ceil(otsFiltradas.length / LIMITE);
  // Cuando el filtro de subestación está activo paginamos en cliente sobre el dataset completo.
  const otsVisibles = subestacionFiltro
    ? otsFiltradas.slice((paginaFiltrada - 1) * LIMITE, paginaFiltrada * LIMITE)
    : otsFiltradas;

  const filtroActivo = !!(tipo || subestacionFiltro || fechaDesde || fechaHasta);

  function limpiar() {
    setTipo(''); setSubestacionFiltro(''); setFechaDesde(''); setFechaHasta(''); setPagina(1);
  }

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button className="btn-primario" onClick={() => setMostrarModal(true)}>
          + Nueva orden de trabajo
        </button>
        {confirmacion && (
          <span style={{ fontSize: '0.875rem', color: 'var(--color-primario)', fontWeight: 600 }}>
            {confirmacion}
          </span>
        )}
      </div>

      {/* Barra de filtros reactiva — aplica al instante, sin botón intermedio */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>

        <select className="filtro-input" value={tipo} onChange={e => { setTipo(e.target.value); setPagina(1); }}>
          <option value="">Todos los tipos</option>
          {TODOS_TIPOS.map(t => <option key={t} value={t}>{ETIQUETA_TIPO_OT[t]}</option>)}
        </select>

        <select className="filtro-input" value={subestacionFiltro} onChange={e => { setSubestacionFiltro(e.target.value); setPagina(1); setPaginaFiltrada(1); }}>
          <option value="">Todas las subestaciones</option>
          {subestaciones.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        {/* Separador visual */}
        <div style={{ width: 1, height: 28, background: '#E8E8E8', flexShrink: 0 }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
          Desde
          <input
            type="date"
            className="filtro-input"
            value={fechaDesde}
            onChange={e => { setFechaDesde(e.target.value); setPagina(1); }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
          Hasta
          <input
            type="date"
            className="filtro-input"
            value={fechaHasta}
            onChange={e => { setFechaHasta(e.target.value); setPagina(1); }}
          />
        </label>

        <button
          type="button"
          className="btn-secundario"
          style={{ marginLeft: 'auto', padding: '0.45rem 1rem', fontSize: '0.875rem', color: filtroActivo ? 'var(--color-ambar)' : undefined, borderColor: filtroActivo ? 'var(--color-ambar)' : undefined }}
          onClick={limpiar}
        >
          Limpiar
        </button>
      </div>

      {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : otsVisibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          No hay órdenes de trabajo con los filtros aplicados
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            {/* Las OTs son inmutables por diseño (regla #6): nacen cerradas y no se editan ni borran.
                Por eso la tabla no tiene columna de acciones de edición. */}
            {/* min-width en .tabla-ots (CSS): en tablet se anula porque las
                columnas .col-secundaria ya no se pintan y la tabla cabe */}
            <table className="tabla-ots" style={estilos.tabla}>
              <thead>
                <tr>
                  <th style={estilos.th}>Fecha</th>
                  <th style={estilos.th}>Activo</th>
                  <th style={estilos.th}>Estado</th>
                  <th style={estilos.th}>Tipo</th>
                  <th style={estilos.th}>Resultado</th>
                  <th style={estilos.th} className="col-secundaria">Técnico</th>
                  <th style={estilos.th} className="col-secundaria">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {otsVisibles.map((ot, idx) => (
                  <tr
                    key={ot.id}
                    onMouseEnter={() => setHoveredRow(ot.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: hoveredRow === ot.id ? '#F0F0F0' : idx % 2 === 0 ? '#fff' : '#F9F9F9',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ ...estilos.td, color: '#9AA0A6', fontSize: '0.82rem' }}>{formatFecha(ot.fechaIntervencion)}</td>
                    <td style={{ ...estilos.td, fontWeight: 600 }}>
                      {ot.activo ? (
                        <Link
                          to={`/activos/${ot.activo.id}`}
                          style={{
                            color: 'var(--color-primario)',
                            textDecoration: hoveredActivo === ot.id ? 'underline' : 'none',
                            background: hoveredActivo === ot.id ? 'rgba(164,198,58,0.15)' : 'transparent',
                            borderRadius: 4,
                            padding: '2px 4px',
                            transition: 'background 0.15s',
                          }}
                          title={ETIQUETA_TIPO_ACTIVO[ot.activo.tipo] ?? ot.activo.tipo}
                          onMouseEnter={() => setHoveredActivo(ot.id)}
                          onMouseLeave={() => setHoveredActivo(null)}
                        >
                          {ot.activo.codigo}
                        </Link>
                      ) : '—'}
                    </td>
                    <td style={estilos.td}>
                      <EstadoBadge estado={derivarEstado(ot.cicloVidaNueva, ot.disponibilidadNueva)} />
                    </td>
                    <td style={estilos.td}><TipoBadge tipo={ot.tipo} /></td>
                    <td style={{
                      ...estilos.td,
                      color: ot.resultado === 'NO_CONFORME' ? 'var(--color-rojo)' : ot.resultado === 'CONFORME' ? 'var(--color-primario)' : '#1A1A1A',
                      fontWeight: 600,
                    }}>
                      {ot.resultado === 'NO_CONFORME' ? 'NO CONFORME' : ot.resultado ?? '—'}
                    </td>
                    <td style={{ ...estilos.td, color: '#9AA0A6' }} className="col-secundaria">
                      {ot.autor?.nombre ?? '—'}
                    </td>
                    <td
                      style={{
                        ...estilos.td,
                        color: '#888',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        borderRadius: 4,
                        background: hoveredDesc === ot.id ? 'rgba(164,198,58,0.10)' : 'transparent',
                        transition: 'background 0.15s',
                        ...(descExpandida === ot.id
                          ? { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }
                          : {}),
                      }}
                      className="col-secundaria"
                      title={descExpandida !== ot.id ? 'Ver más' : undefined}
                      onMouseEnter={() => setHoveredDesc(ot.id)}
                      onMouseLeave={() => setHoveredDesc(null)}
                      onClick={() => setDescExpandida(prev => prev === ot.id ? null : ot.id)}
                    >
                      {ot.descripcion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subestacionFiltro ? (
            totalPaginasFiltradas > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem', alignItems: 'center' }}>
                <button className="btn-secundario" disabled={paginaFiltrada <= 1} onClick={() => setPaginaFiltrada(p => p - 1)}>←</button>
                <span style={{ fontSize: '0.875rem', color: '#666' }}>
                  Página {paginaFiltrada} de {totalPaginasFiltradas}
                </span>
                <button className="btn-secundario" disabled={paginaFiltrada >= totalPaginasFiltradas} onClick={() => setPaginaFiltrada(p => p + 1)}>→</button>
              </div>
            )
          ) : (
            paginacion.totalPaginas > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem', alignItems: 'center' }}>
                <button className="btn-secundario" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>←</button>
                <span style={{ fontSize: '0.875rem', color: '#666' }}>
                  Página {paginacion.pagina} de {paginacion.totalPaginas}
                </span>
                <button className="btn-secundario" disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina(p => p + 1)}>→</button>
              </div>
            )
          )}
        </>
      )}

      {mostrarModal && (
        <ModalNuevaOT
          token={token}
          usuario={usuario}
          onCerrar={() => setMostrarModal(false)}
          onCreada={() => {
            setMostrarModal(false);
            cargar();
            setConfirmacion('OT registrada correctamente.');
            setTimeout(() => setConfirmacion(''), 4000);
          }}
        />
      )}
    </div>
  );
}

const estilos = {
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' },
  th: {
    textAlign: 'left', padding: '0.5rem 0.75rem',
    fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    background: '#F5F5F5', borderBottom: '1px solid #E8E8E8',
  },
  td: {
    padding: '0.875rem 0.75rem', verticalAlign: 'middle',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
};
