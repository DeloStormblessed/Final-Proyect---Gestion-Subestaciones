import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import EstadoBadge from '../components/EstadoBadge.jsx';

const C = { primario: '#A4C63A', gris: '#9AA0A6' };

const ESTADOS_ACTIVO = ['EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'];
const TIPOS_ACTIVO = [
  'TRANSFORMADOR_POTENCIA', 'INTERRUPTOR_AUTOMATICO', 'SECCIONADOR',
  'PARARRAYOS', 'TRANSFORMADOR_MEDIDA', 'BATERIA_CONDENSADORES',
];

const ETIQUETA_TIPO = {
  TRANSFORMADOR_POTENCIA:  'Transformador potencia',
  INTERRUPTOR_AUTOMATICO:  'Interruptor automático',
  SECCIONADOR:             'Seccionador',
  PARARRAYOS:              'Pararrayos',
  TRANSFORMADOR_MEDIDA:    'Transformador medida',
  BATERIA_CONDENSADORES:   'Batería condensadores',
};

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

  // Filtros
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [inspeccionVencida, setInspeccionVencida] = useState(false);
  const [pagina, setPagina] = useState(1);

  const puedeCrear = usuario?.rol === 'TECNICO' || usuario?.rol === 'ADMIN';

  const cargar = useCallback(() => {
    setCargando(true);
    setError('');
    const params = new URLSearchParams({ pagina, limite: 20 });
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (busqueda) params.set('busqueda', busqueda);
    if (inspeccionVencida) params.set('inspeccionVencida', 'true');

    apiFetch(`/api/v1/activos?${params}`, {}, token)
      .then(data => {
        setActivos(data.datos ?? []);
        setPaginacion(data.paginacion ?? { pagina: 1, totalPaginas: 1 });
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [token, pagina, estado, tipo, busqueda, inspeccionVencida]);

  useEffect(() => { cargar(); }, [cargar]);

  function handleFiltroSubmit(e) {
    e.preventDefault();
    setPagina(1);
    cargar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Activos</h2>
        {puedeCrear && (
          <button className="btn-primario" onClick={() => setMostrarModal(true)}>
            + Nuevo activo
          </button>
        )}
      </div>

      {/* Filtros */}
      <form onSubmit={handleFiltroSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <select value={estado} onChange={e => setEstado(e.target.value)} style={estilosFiltro.select}>
          <option value="">Todos los estados</option>
          {ESTADOS_ACTIVO.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </select>

        <select value={tipo} onChange={e => setTipo(e.target.value)} style={estilosFiltro.select}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
        </select>

        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código, fabricante…"
          style={{ ...estilosFiltro.select, minWidth: 200 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={inspeccionVencida} onChange={e => setInspeccionVencida(e.target.checked)} />
          Inspección vencida
        </label>

        <button type="submit" className="btn-primario" style={{ padding: '0.5rem 1rem' }}>Filtrar</button>
        <button type="button" className="btn-secundario" onClick={() => { setEstado(''); setTipo(''); setBusqueda(''); setInspeccionVencida(false); setPagina(1); }}>
          Limpiar
        </button>
      </form>

      {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : activos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          No se encontraron activos con los filtros aplicados
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: 'var(--color-fondo)', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={estilos.tabla}>
              <thead>
                <tr>
                  <th style={estilos.th}>Código</th>
                  <th style={estilos.th}>Tipo</th>
                  <th style={estilos.th}>Fabricante</th>
                  <th style={estilos.th} className="col-secundaria">Subestación</th>
                  <th style={estilos.th}>Estado</th>
                  <th style={estilos.th} className="col-secundaria">Próx. inspección</th>
                  <th style={estilos.th}></th>
                </tr>
              </thead>
              <tbody>
                {activos.map((activo, idx) => (
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
                    <td style={estilos.td}>{activo.fabricante}</td>
                    {/* Subestación y fecha son contexto secundario — gris para no competir con Código */}
                    <td style={{ ...estilos.td, color: C.gris }} className="col-secundaria">{activo.subestacion?.nombre ?? '—'}</td>
                    <td style={estilos.td}><EstadoBadge estado={activo.estado} /></td>
                    <td style={{ ...estilos.td, color: C.gris }} className="col-secundaria">{formatFecha(activo.fechaProximaInspeccion)}</td>
                    <td style={{ ...estilos.td, textAlign: 'right' }}>
                      <Link
                        to={`/activos/${activo.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.25rem 0.65rem', borderRadius: 999,
                          fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                          background: 'rgba(164,198,58,0.12)', color: C.primario,
                          border: `2px solid ${C.primario}`,
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
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#F5F5F5', borderBottom: '1px solid #E8E8E8' },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' },
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
