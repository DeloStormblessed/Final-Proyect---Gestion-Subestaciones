import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/apiNode.js';
import EstadoBadge from '../components/EstadoBadge.jsx';
import TipoBadge from '../components/TipoBadge.jsx';

const TIPOS_OT = ['INSPECCION', 'PREVENTIVO', 'CORRECTIVO', 'INSTALACION', 'BAJA'];
const RESULTADOS = ['CONFORME', 'NO_CONFORME'];

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
            Fabricante <span style={{ color: 'var(--color-rojo)' }}>*</span>
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

function ModalRegistrarOT({ activo, token, onCerrar, onRegistrada, rolUsuario }) {
  const tiposDisponibles = rolUsuario === 'OPERARIO' ? ['INSPECCION'] : TIPOS_OT;

  const [form, setForm] = useState({
    tipo: tiposDisponibles[0],
    descripcion: '',
    resultado: '',
    fechaIntervencion: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const payload = {
        tipo: form.tipo,
        descripcion: form.descripcion,
        fechaIntervencion: form.fechaIntervencion,
        activoId: activo.id,
      };
      // resultado solo aplica a INSPECCION
      if (form.tipo === 'INSPECCION' && form.resultado) {
        payload.resultado = form.resultado;
      }
      await apiFetch('/api/v1/ordenes-trabajo', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      onRegistrada();
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
          <h3 style={{ fontWeight: 700 }}>Registrar OT — {activo.codigo}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={estilosModal.label}>
            Tipo de OT
            <select required value={form.tipo} onChange={e => setField('tipo', e.target.value)} style={estilosModal.input}>
              {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {/* Resultado solo se pide cuando es INSPECCION */}
          {form.tipo === 'INSPECCION' && (
            <label style={estilosModal.label}>
              Resultado <span style={{ color: 'var(--color-rojo)' }}>*</span>
              <select required value={form.resultado} onChange={e => setField('resultado', e.target.value)} style={estilosModal.input}>
                <option value="">Selecciona resultado…</option>
                {RESULTADOS.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </label>
          )}

          <label style={estilosModal.label}>
            Descripción <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <textarea
              required
              value={form.descripcion}
              onChange={e => setField('descripcion', e.target.value)}
              rows={3}
              style={{ ...estilosModal.input, resize: 'vertical' }}
              placeholder="Describe la intervención realizada"
            />
          </label>

          <label style={estilosModal.label}>
            Fecha de intervención <span style={{ color: 'var(--color-rojo)' }}>*</span>
            <input required type="date" value={form.fechaIntervencion}
              onChange={e => setField('fechaIntervencion', e.target.value)} style={estilosModal.input} />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onCerrar} className="btn-secundario">Cancelar</button>
            <button type="submit" disabled={cargando} className="btn-primario">
              {cargando ? 'Registrando…' : 'Registrar OT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ActivoDetalle() {
  const { id } = useParams();
  const { token, usuario } = useAuth();
  const [activo, setActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'editar' | 'ot' | null

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
      {/* Cabecera del activo */}
      <div style={{ background: 'var(--color-fondo)', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activo.codigo}</h2>
              <EstadoBadge estado={activo.estado} />
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

      {/* Etiquetas */}
      {activo.etiquetas?.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activo.etiquetas.map(et => (
            <span key={et.id} style={{
              background: et.color ?? '#eee',
              color: '#333',
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {et.nombre}
            </span>
          ))}
        </div>
      )}

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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={estilos.th}>Tipo</th>
                  <th style={estilos.th}>Descripción</th>
                  <th style={estilos.th}>Resultado</th>
                  <th style={estilos.th}>Estado anterior → nuevo</th>
                  <th style={estilos.th}>Fecha</th>
                  <th style={estilos.th}>Técnico</th>
                </tr>
              </thead>
              <tbody>
                {activo.ordenesTrabajo.map(ot => (
                  <tr key={ot.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={estilos.td}><TipoBadge tipo={ot.tipo} /></td>
                    <td style={{ ...estilos.td, maxWidth: 260, whiteSpace: 'pre-wrap' }}>{ot.descripcion}</td>
                    <td style={estilos.td}>{ot.resultado ?? '—'}</td>
                    <td style={estilos.td}>{ot.estadoAnterior} → {ot.estadoNuevo}</td>
                    <td style={estilos.td}>{formatFecha(ot.fechaIntervencion)}</td>
                    <td style={estilos.td}>{ot.autor?.nombre ?? '—'}</td>
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
        <ModalRegistrarOT
          activo={activo}
          token={token}
          rolUsuario={usuario?.rol}
          onCerrar={() => setModal(null)}
          onRegistrada={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}

const estilos = {
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600, color: '#777', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '0.6rem 0.75rem', verticalAlign: 'top' },
};

const estilosModal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  caja: { background: 'var(--color-fondo)', borderRadius: 12, padding: '1.75rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 500 },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' },
};
