import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import EstadoBadge from '../components/EstadoBadge.jsx';

const C = { primario: '#A4C63A', gris: '#9AA0A6' };

const ESTADOS_ACTIVO = ['EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'];
const TIPOS_ACTIVO = [
  'TRANSFORMADOR_POTENCIA', 'INTERRUPTOR_AUTOMATICO', 'SECCIONADOR',
  'PARARRAYOS', 'TRANSFORMADOR_MEDIDA', 'BATERIA_CONDENSADORES',
];

const ETIQUETA_ESTADO = {
  EN_SERVICIO:       'En servicio',
  AVERIADO:          'Averiado',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA:      'Dado de baja',
};

const ETIQUETA_TIPO = {
  TRANSFORMADOR_POTENCIA:  'Transformador potencia',
  INTERRUPTOR_AUTOMATICO:  'Interruptor automático',
  SECCIONADOR:             'Seccionador',
  PARARRAYOS:              'Pararrayos',
  TRANSFORMADOR_MEDIDA:    'Transformador medida',
  BATERIA_CONDENSADORES:   'Batería condensadores',
};

// Orden de criticidad: en un GMAO lo primero que el técnico debe ver es lo que
// necesita acción inmediata. DADO_DE_BAJA al final porque no es operación diaria.
const ORDEN_ESTADO = { AVERIADO: 0, FUERA_DE_SERVICIO: 1, EN_SERVICIO: 2, DADO_DE_BAJA: 3 };

function sortByCriticidad(a, b) {
  const dif = (ORDEN_ESTADO[a.estado] ?? 99) - (ORDEN_ESTADO[b.estado] ?? 99);
  if (dif !== 0) return dif;
  // Secundario: fecha de próxima inspección ascendente (la más urgente primero; null al final)
  const fa = a.fechaProximaInspeccion ? new Date(a.fechaProximaInspeccion).getTime() : Infinity;
  const fb = b.fechaProximaInspeccion ? new Date(b.fechaProximaInspeccion).getTime() : Infinity;
  return fa - fb;
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ModalNuevoActivo({ onCerrar, onCreado, token }) {
  const [subestaciones, setSubestaciones] = useState([]);
  const [form, setForm] = useState({
    codigo: '', tipo: TIPOS_ACTIVO[0], fabricante: '',
    modelo: '', numeroSerie: '', fechaPuestaEnServicio: '', subestacionId: '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/subestaciones', {}, token)
      .then(data => setSubestaciones(data.datos ?? []))
      .catch(() => setSubestaciones([]));
  }, [token]);

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const payload = { ...form };
      if (!payload.modelo) delete payload.modelo;
      if (!payload.numeroSerie) delete payload.numeroSerie;
      await apiFetch('/api/v1/activos', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={estilosModal.overlay} onClick={onCerrar}>
      <div style={estilosModal.caja} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700 }}>Nuevo activo</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={estilosModal.label}>
            Código <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <input required value={form.codigo} onChange={e => setField('codigo', e.target.value)}
              placeholder="Ej. T-001, QA-005" style={estilosModal.input} />
          </label>

          <label style={estilosModal.label}>
            Tipo <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <select required value={form.tipo} onChange={e => setField('tipo', e.target.value)} style={estilosModal.input}>
              {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
            </select>
          </label>

          <label style={estilosModal.label}>
            Fabricante <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <input required value={form.fabricante} onChange={e => setField('fabricante', e.target.value)}
              placeholder="Siemens, ABB…" style={estilosModal.input} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={estilosModal.label}>
              Modelo
              <input value={form.modelo} onChange={e => setField('modelo', e.target.value)}
                placeholder="Opcional" style={estilosModal.input} />
            </label>
            <label style={estilosModal.label}>
              Número de serie
              <input value={form.numeroSerie} onChange={e => setField('numeroSerie', e.target.value)}
                placeholder="Opcional" style={estilosModal.input} />
            </label>
          </div>

          <label style={estilosModal.label}>
            Fecha puesta en servicio <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <input required type="date" value={form.fechaPuestaEnServicio}
              onChange={e => setField('fechaPuestaEnServicio', e.target.value)} style={estilosModal.input} />
          </label>

          <label style={estilosModal.label}>
            Subestación <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <select required value={form.subestacionId} onChange={e => setField('subestacionId', e.target.value)} style={estilosModal.input}>
              <option value="">Selecciona subestación…</option>
              {subestaciones.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
            </select>
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onCerrar} className="btn-secundario">Cancelar</button>
            <button type="submit" disabled={cargando} className="btn-primario">
              {cargando ? 'Creando…' : 'Crear activo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Activos() {
  const { token, usuario } = useAuth();
  const [activos, setActivos] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [mostrarDadosDeBaja, setMostrarDadosDeBaja] = useState(false);

  // Filtros
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [inspeccionVencida, setInspeccionVencida] = useState(false);
  const [subestacionId, setSubestacionId] = useState('');
  const [pagina, setPagina] = useState(1);

  // Lista de subestaciones para el selector de filtro
  const [subestaciones, setSubestaciones] = useState([]);
  useEffect(() => {
    apiFetch('/api/v1/subestaciones', {}, token)
      .then(data => setSubestaciones(data.datos ?? []))
      .catch(() => {});
  }, [token]);

  // Debounce de 300ms para la búsqueda: evita llamar a cargar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  const puedeCrear = usuario?.rol === 'TECNICO' || usuario?.rol === 'ADMIN';

  const cargar = useCallback(() => {
    setCargando(true);
    setError('');
    const params = new URLSearchParams({ pagina, limite: 20 });
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (busqueda) params.set('busqueda', busqueda);
    if (inspeccionVencida) params.set('inspeccionVencida', 'true');
    if (subestacionId) params.set('subestacionId', subestacionId);

    apiFetch(`/api/v1/activos?${params}`, {}, token)
      .then(data => {
        setActivos(data.datos ?? []);
        setPaginacion(data.paginacion ?? { pagina: 1, totalPaginas: 1 });
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [token, pagina, estado, tipo, busqueda, inspeccionVencida, subestacionId]);

  useEffect(() => { cargar(); }, [cargar]);

// Filtrado y ordenación en cliente — el backend no los soporta sin modificación:
  // • DADO_DE_BAJA: ocultos por defecto (no son operación diaria) y siempre excluidos
  //   cuando inspeccionVencida está activo (un activo retirado no se inspecciona,
  //   alineado con el dashboard que ya los excluye de ese KPI).
  // • sortByCriticidad: AVERIADO → FUERA_DE_SERVICIO → EN_SERVICIO → DADO_DE_BAJA,
  //   con fechaProximaInspeccion ascendente como desempate.
  const activosVisibles = [...activos]
    .filter(a => mostrarDadosDeBaja ? a.estado === 'DADO_DE_BAJA' : a.estado !== 'DADO_DE_BAJA')
    .sort(sortByCriticidad);

  const filtroActivo = !!(estado || tipo || busquedaInput || inspeccionVencida || subestacionId || mostrarDadosDeBaja);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        {puedeCrear && (
          <button className="btn-primario" onClick={() => setMostrarModal(true)}>
            + Nuevo activo
          </button>
        )}
      </div>

      {/* Barra de filtros reactiva — aplica al instante sin botón intermedio */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>

        {/* Búsqueda con icono de lupa */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', color: '#aaa', pointerEvents: 'none' }} />
          <input
            className="filtro-input"
            value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            placeholder="Buscar por código, fabricante…"
            style={{ paddingLeft: '2rem', minWidth: 210 }}
          />
        </div>

        <select className="filtro-input" value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}>
          <option value="">Todos los estados</option>
          {ESTADOS_ACTIVO.map(e => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
        </select>

        <select className="filtro-input" value={tipo} onChange={e => { setTipo(e.target.value); setPagina(1); }}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
        </select>

        <select className="filtro-input" value={subestacionId} onChange={e => { setSubestacionId(e.target.value); setPagina(1); }}>
          <option value="">Todas las subestaciones</option>
          {subestaciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        {/* Separador visual entre selects y checkboxes */}
        <div style={{ width: 1, height: 28, background: '#E8E8E8', flexShrink: 0 }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={inspeccionVencida} onChange={e => { setInspeccionVencida(e.target.checked); setPagina(1); }} />
          Inspección vencida
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={mostrarDadosDeBaja} onChange={e => { setMostrarDadosDeBaja(e.target.checked); setPagina(1); }} />
          Dado de baja
        </label>

        <button
          type="button"
          className="btn-secundario"
          style={{ marginLeft: 'auto', padding: '0.45rem 1rem', fontSize: '0.875rem', color: filtroActivo ? 'var(--color-ambar)' : undefined, borderColor: filtroActivo ? 'var(--color-ambar)' : undefined }}
          onClick={() => { setEstado(''); setTipo(''); setBusquedaInput(''); setBusqueda(''); setInspeccionVencida(false); setSubestacionId(''); setMostrarDadosDeBaja(false); setPagina(1); }}
        >
          Limpiar
        </button>
      </div>

      {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : activosVisibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          No se encontraron activos con los filtros aplicados
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: 'var(--color-fondo)', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={estilos.tabla}>
              {/* Orden de columnas por prioridad operacional: primero qué es el activo
                  (código, tipo), luego en qué condición está y cuándo toca revisarlo
                  (estado, próxima inspección — lo accionable, donde el ojo llega antes),
                  luego dónde está físicamente (subestación), y al final el dato de
                  catálogo (fabricante), que es el menos urgente para operar. */}
              <thead>
                <tr>
                  <th style={{ ...estilos.th, width: '10%' }}>Código</th>
                  <th style={{ ...estilos.th, width: '20%' }}>Tipo</th>
                  <th style={{ ...estilos.th, width: '15%' }}>Estado</th>
                  <th style={{ ...estilos.th, width: '13%' }}>Próx. inspección</th>
                  <th style={{ ...estilos.th, width: '17%' }} className="col-secundaria">Subestación</th>
                  <th style={{ ...estilos.th, width: '15%' }} className="col-secundaria">Fabricante</th>
                  <th style={{ ...estilos.th, width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {activosVisibles.map((activo, idx) => (
                  <tr
                    key={activo.id}
                    onMouseEnter={() => setHoveredRow(activo.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: hoveredRow === activo.id ? '#F0F0F0' : idx % 2 === 0 ? '#fff' : '#F9F9F9',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Código es el dato principal — weight 600 para que el ojo lo encuentre primero */}
                    <td style={{ ...estilos.td, fontWeight: 600, color: '#1A1A1A' }}>{activo.codigo}</td>
                    <td style={estilos.td}>{ETIQUETA_TIPO[activo.tipo] ?? activo.tipo}</td>
                    <td style={estilos.td}><EstadoBadge estado={activo.estado} /></td>
                    <td style={{ ...estilos.td, color: C.gris }}>{formatFecha(activo.fechaProximaInspeccion)}</td>
                    {/* Subestación: dato de localización, color normal */}
                    <td style={{ ...estilos.td, color: '#1A1A1A' }} className="col-secundaria">{activo.subestacion?.nombre ?? '—'}</td>
                    {/* Fabricante: dato de catálogo, el menos urgente — gris suave */}
                    <td style={{ ...estilos.td, color: C.gris }} className="col-secundaria">{activo.fabricante}</td>
                    <td style={{ ...estilos.td, textAlign: 'right' }}>
                      <Link
                        to={`/activos/${activo.id}`}
                        title="Ver detalle"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.25rem 0.65rem', borderRadius: 999,
                          fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                          background: 'rgba(164,198,58,0.12)', color: C.primario,
                          border: `1.5px solid ${C.primario}`,
                          outline: 'none', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = C.primario;
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(164,198,58,0.12)';
                          e.currentTarget.style.color = C.primario;
                        }}
                      >
                        <Eye size={13} />
                        Ver activo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {paginacion.totalPaginas > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem', alignItems: 'center' }}>
              <button className="btn-secundario" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>←</button>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>
                Página {paginacion.pagina} de {paginacion.totalPaginas}
              </span>
              <button className="btn-secundario" disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina(p => p + 1)}>→</button>
            </div>
          )}
        </>
      )}

      {mostrarModal && (
        <ModalNuevoActivo
          token={token}
          onCerrar={() => setMostrarModal(false)}
          onCreado={() => { setMostrarModal(false); cargar(); }}
        />
      )}
    </div>
  );
}

const estilos = {
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#F5F5F5', borderBottom: '1px solid #E8E8E8' },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

const estilosFiltro = {
  select: { padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-fondo)' },
};

const estilosModal = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '1rem',
  },
  caja: {
    background: 'var(--color-fondo)',
    borderRadius: 12, padding: '1.75rem',
    width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 500 },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' },
};
