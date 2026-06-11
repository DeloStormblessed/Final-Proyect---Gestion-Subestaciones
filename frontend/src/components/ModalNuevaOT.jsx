import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiNode.js';
import { estadoVisual } from '../lib/estadoVisual.js';

// Tipos de OT disponibles por rol.
// INSTALACION se excluye siempre: se genera de forma atómica al crear el activo
// (no existe activo sin su OT de origen), así que ofrecerla a mano no tiene sentido.
const TIPOS_OT_POR_ROL = {
  OPERARIO: ['INSPECCION'],
  TECNICO:  ['PREVENTIVO', 'CORRECTIVO', 'INSPECCION', 'BAJA'],
  ADMIN:    ['PREVENTIVO', 'CORRECTIVO', 'INSPECCION', 'BAJA'],
};

const ETIQUETA_TIPO_OT = {
  INSPECCION: 'Inspección',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  BAJA:       'Baja',
};

const ETIQUETA_TIPO_ACTIVO = {
  TRANSFORMADOR_POTENCIA:  'Transformador potencia',
  INTERRUPTOR_AUTOMATICO:  'Interruptor automático',
  SECCIONADOR:             'Seccionador',
  PARARRAYOS:              'Pararrayos',
  TRANSFORMADOR_MEDIDA:    'Transformador medida',
  BATERIA_CONDENSADORES:   'Batería condensadores',
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
  input: { padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' },
};

// activoPreseleccionado: cuando se abre desde la ficha de un activo concreto, se pasa el
// objeto activo ya conocido. El selector de activo se oculta y el id queda fijado.
// Sin él, el modal funciona en modo "libre" (selector visible, activo a elegir).
export default function ModalNuevaOT({ onCerrar, onCreada, token, usuario, activoPreseleccionado = null }) {
  const [activosDisponibles, setActivosDisponibles] = useState([]);
  const [subestaciones, setSubestaciones] = useState([]);
  const [filtroSubestacion, setFiltroSubestacion] = useState('');
  const [filtroElemento, setFiltroElemento] = useState('');
  const [form, setForm] = useState({ activoId: activoPreseleccionado?.id ?? '', tipo: '', descripcion: '', resultado: '', resultadoIntervencion: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActivos, setCargandoActivos] = useState(!activoPreseleccionado);

  const tiposDisponibles = TIPOS_OT_POR_ROL[usuario?.rol] ?? ['INSPECCION'];

  useEffect(() => {
    if (activoPreseleccionado) return;
    apiFetch('/api/v1/subestaciones', {}, token)
      .then(data => setSubestaciones(data.datos ?? []))
      .catch(() => {});
  }, [token, activoPreseleccionado]);

  useEffect(() => {
    // Si el activo ya viene fijado desde la ficha, no hace falta cargar la lista.
    if (activoPreseleccionado) return;
    // Cargamos activos con límite alto para el selector.
    // Filtramos DADO_DE_BAJA en cliente: un activo retirado no recibe OTs nuevas.
    apiFetch('/api/v1/activos?limite=100', {}, token)
      .then(data => setActivosDisponibles((data.datos ?? []).filter(a => estadoVisual(a) !== 'DADO_DE_BAJA')))
      .catch(() => setActivosDisponibles([]))
      .finally(() => setCargandoActivos(false));
  }, [token, activoPreseleccionado]);

  // Filtros de subestación y elemento aplicados en cliente sobre la lista completa.
  const activosFiltrados = activosDisponibles
    .filter(a => !filtroSubestacion || a.subestacion?.id === filtroSubestacion)
    .filter(a => !filtroElemento || a.tipo === filtroElemento);

  const activoSeleccionado = activoPreseleccionado ?? activosDisponibles.find(a => a.id === form.activoId) ?? null;
  function setField(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Al cambiar de tipo, limpiar los campos condicionales que ya no aplican
      if (field === 'tipo' && value !== 'INSPECCION') next.resultado = '';
      if (field === 'tipo' && !['PREVENTIVO', 'CORRECTIVO'].includes(value)) next.resultadoIntervencion = '';
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.activoId) { setError('Selecciona un activo.'); return; }
    if (!form.tipo) { setError('Selecciona el tipo de OT.'); return; }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return; }
    if (form.tipo === 'INSPECCION' && !form.resultado) { setError('El resultado es obligatorio para inspecciones.'); return; }
    if (['PREVENTIVO', 'CORRECTIVO'].includes(form.tipo) && !form.resultadoIntervencion) { setError('El resultado es obligatorio para preventivos y correctivos.'); return; }

    setError('');
    setCargando(true);
    try {
      const payload = { tipo: form.tipo, descripcion: form.descripcion.trim() };
      // resultado solo va en el body si el tipo es INSPECCION (schema Zod lo rechaza en otro caso)
      if (form.tipo === 'INSPECCION') payload.resultado = form.resultado;
      // resultadoIntervencion declara en qué condición queda el equipo tras el preventivo/correctivo;
      // reponer servicio es el desenlace OPERATIVO, no un "correctivo de reposición".
      if (['PREVENTIVO', 'CORRECTIVO'].includes(form.tipo)) payload.resultadoIntervencion = form.resultadoIntervencion;

      await apiFetch(`/api/v1/activos/${form.activoId}/ordenes-trabajo`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      onCreada();
    } catch (err) {
      // El backend devuelve 422 con mensaje cuando la Regla A (transición de estado) o la
      // Regla B (bloqueo por inspección vencida) impiden la OT. Mostramos ese mensaje
      // directamente: la lógica de negocio vive en el backend; el front la consume y la muestra.
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={estilosModal.overlay} onClick={onCerrar}>
      <div style={estilosModal.caja} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700 }}>
            {activoPreseleccionado ? `Registrar OT — ${activoPreseleccionado.codigo}` : 'Nueva orden de trabajo'}
          </h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {error && <p className="banner-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Filtros + selector de activo: solo visibles en modo libre */}
          {!activoPreseleccionado && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <label style={estilosModal.label}>
                  Subestación
                  <select value={filtroSubestacion} onChange={e => { setFiltroSubestacion(e.target.value); setField('activoId', ''); }} style={estilosModal.input}>
                    <option value="">Todas</option>
                    {subestaciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
                <label style={estilosModal.label}>
                  Elemento
                  <select value={filtroElemento} onChange={e => { setFiltroElemento(e.target.value); setField('activoId', ''); }} style={estilosModal.input}>
                    <option value="">Todos</option>
                    {Object.entries(ETIQUETA_TIPO_ACTIVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              <label style={estilosModal.label}>
                <span>Activo <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
                {cargandoActivos ? (
                  <span style={{ fontSize: '0.85rem', color: '#aaa', padding: '0.55rem 0' }}>Cargando activos…</span>
                ) : (
                  <select required value={form.activoId} onChange={e => setField('activoId', e.target.value)} style={estilosModal.input}>
                    <option value="">Selecciona un activo…</option>
                    {activosFiltrados.map(a => (
                      <option key={a.id} value={a.id}>{a.codigo} · {ETIQUETA_TIPO_ACTIVO[a.tipo] ?? a.tipo}</option>
                    ))}
                  </select>
                )}
              </label>
            </>
          )}

          {/* Tipo OT y Resultado en el mismo grid de dos columnas para que todos los
              desplegables tengan el mismo ancho que Subestación y Elemento. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <label style={estilosModal.label}>
              <span>Tipo de OT <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
              <select required value={form.tipo} onChange={e => setField('tipo', e.target.value)} style={estilosModal.input}>
                <option value="">Selecciona tipo…</option>
                {tiposDisponibles.map(t => <option key={t} value={t}>{ETIQUETA_TIPO_OT[t]}</option>)}
              </select>
            </label>

            {form.tipo === 'INSPECCION' && (
              <label style={estilosModal.label}>
                <span>Resultado <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
                <select required value={form.resultado} onChange={e => setField('resultado', e.target.value)} style={estilosModal.input}>
                  <option value="">Selecciona resultado…</option>
                  <option value="CONFORME">Conforme</option>
                  <option value="NO_CONFORME">No conforme</option>
                </select>
              </label>
            )}

            {['PREVENTIVO', 'CORRECTIVO'].includes(form.tipo) && (
              <label style={estilosModal.label}>
                <span>Resultado <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
                <select
                  required
                  value={form.resultadoIntervencion}
                  onChange={e => setField('resultadoIntervencion', e.target.value)}
                  style={estilosModal.input}
                >
                  <option value="">Selecciona el resultado…</option>
                  <option value="OPERATIVO">Operativo</option>
                  <option value="DEFECTUOSO">Defectuoso</option>
                  <option value="EN_DESCARGO">En descargo</option>
                </select>
              </label>
            )}
          </div>

          <label style={estilosModal.label}>
            <span>Descripción <span style={{ color: 'var(--color-rojo)' }}>*</span></span>
            <textarea
              required
              value={form.descripcion}
              onChange={e => setField('descripcion', e.target.value)}
              placeholder="Describe el trabajo realizado…"
              rows={3}
              style={{ ...estilosModal.input, resize: 'vertical', fontFamily: 'inherit' }}
            />
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
