import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import EstadoBadge from '../components/EstadoBadge.jsx';
import TipoBadge from '../components/TipoBadge.jsx';
import ModalNuevaOT from '../components/ModalNuevaOT.jsx';
import { estadoVisual, derivarEstado } from '../lib/estadoVisual.js';

const ETIQUETA_TIPO_ACTIVO = {
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

function ModalEditarActivo({ activo, token, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    fabricante: activo.fabricante ?? '',
    modelo:     activo.modelo     ?? '',
    numeroSerie: activo.numeroSerie ?? '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch(`/api/v1/activos/${activo.id}`, {
        method: 'PUT',
        // solo datos descriptivos; no se cambia estado ni código (regla de dominio)
        body: JSON.stringify(form),
      }, token);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={estilosModal.overlay} onClick={onCerrar}>
      <div style={estilosModal.caja} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700 }}>Editar activo {activo.codigo}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={estilosModal.label}>
            <span>Fabricante <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
            <input required value={form.fabricante} onChange={e => setForm(p => ({ ...p, fabricante: e.target.value }))} style={estilosModal.input} />
          </label>
          <label style={estilosModal.label}>
            Modelo
            <input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} style={estilosModal.input} />
          </label>
          <label style={estilosModal.label}>
            Número de serie
            <input value={form.numeroSerie} onChange={e => setForm(p => ({ ...p, numeroSerie: e.target.value }))} style={estilosModal.input} />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onCerrar} className="btn-secundario">Cancelar</button>
            <button type="submit" disabled={cargando} className="btn-primario">
              {cargando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ActivoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, usuario } = useAuth();
  const [activo, setActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'editar' | 'ot' | null
  const [descExpandida, setDescExpandida] = useState(null);
  const [hoveredDesc, setHoveredDesc] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const puedeEditar = usuario?.rol === 'TECNICO' || usuario?.rol === 'ADMIN';

  function cargar() {
    setCargando(true);
    setError('');
    apiFetch(`/api/v1/activos/${id}`, {}, token)
      .then(setActivo)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [id, token]);

  if (cargando) return <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>;
  if (error) return <p className="banner-error">{error}</p>;
  if (!activo) return null;

  return (
    <div>
      <button
        className="btn-primario"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      >
        ← Volver
      </button>

      {/* Cabecera del activo */}
      <div style={{ background: 'var(--color-fondo)', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activo.codigo}</h2>
              <EstadoBadge estado={estadoVisual(activo)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem 1.5rem', fontSize: '0.875rem', color: '#555' }}>
              <span><strong>Tipo:</strong> {ETIQUETA_TIPO_ACTIVO[activo.tipo] ?? activo.tipo}</span>
              <span><strong>Fabricante:</strong> {activo.fabricante}</span>
              {activo.modelo && <span><strong>Modelo:</strong> {activo.modelo}</span>}
              {activo.numeroSerie && <span><strong>N.º serie:</strong> {activo.numeroSerie}</span>}
              <span><strong>Subestación:</strong> {activo.subestacion?.nombre ?? '—'}</span>
              <span><strong>Puesta en servicio:</strong> {formatFecha(activo.fechaPuestaEnServicio)}</span>
              <span><strong>Próx. inspección:</strong> {formatFecha(activo.fechaProximaInspeccion)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {puedeEditar && (
              <button className="btn-secundario" onClick={() => setModal('editar')}>Editar</button>
            )}
            <button className="btn-primario" onClick={() => setModal('ot')}>Registrar OT</button>
          </div>
        </div>
      </div>

      {/* Historial de OTs — SOLO LECTURA; la OT es inmutable (regla dura #6) */}
      <div style={{ background: 'var(--color-fondo)', borderRadius: 10, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '1rem' }}>
          Historial de órdenes de trabajo
        </h3>

        {!activo.ordenesTrabajo || activo.ordenesTrabajo.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
            Sin órdenes de trabajo registradas
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={estilos.th}>Fecha</th>
                  <th style={estilos.th}>Estado</th>
                  <th style={estilos.th}>Tipo</th>
                  <th style={estilos.th}>Resultado</th>
                  <th style={estilos.th}>Técnico</th>
                  <th style={estilos.th}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {/* Ordenamos por createdAt desc (timestamp completo) y no por fechaIntervencion
                    (solo día): dos OTs del mismo día quedan en su orden real de creación
                    y la cadena estadoNuevo→estadoAnterior se lee coherente. */}
                {[...activo.ordenesTrabajo]
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((ot, idx) => (
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
                    <td style={{ ...estilos.td, color: '#9AA0A6' }}>{ot.autor?.nombre ?? '—'}</td>
                    <td
                      style={{
                        ...estilos.td,
                        cursor: 'pointer',
                        color: '#555',
                        borderRadius: 4,
                        background: hoveredDesc === ot.id ? 'rgba(164,198,58,0.10)' : 'transparent',
                        transition: 'background 0.15s',
                        ...(descExpandida === ot.id
                          ? { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }
                          : {}),
                      }}
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
        )}
      </div>

      {modal === 'editar' && (
        <ModalEditarActivo
          activo={activo}
          token={token}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}

      {modal === 'ot' && (
        <ModalNuevaOT
          token={token}
          usuario={usuario}
          activoPreseleccionado={activo}
          onCerrar={() => setModal(null)}
          onCreada={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}

const estilos = {
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#F5F5F5', borderBottom: '1px solid #E8E8E8' },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

const estilosModal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  caja: { background: 'var(--color-fondo)', borderRadius: 12, padding: '1.75rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 500 },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' },
};
