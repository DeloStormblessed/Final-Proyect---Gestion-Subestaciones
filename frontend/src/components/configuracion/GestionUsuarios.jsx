import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiFetch } from '../../lib/apiNode.js';
import RolBadge from '../RolBadge.jsx';

const ROLES = ['OPERARIO', 'TECNICO', 'ADMIN'];

export default function GestionUsuarios() {
  const { usuario, token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  // Mensajes de error por fila: { [id]: string }
  const [erroresFila, setErroresFila] = useState({});

  // Modal de nuevo usuario
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [errorModal, setErrorModal] = useState(null);
  const [cargandoModal, setCargandoModal] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Cierra el modal con Escape
  useEffect(() => {
    if (!modalAbierto) return;
    function handleEsc(e) { if (e.key === 'Escape') cerrarModal(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [modalAbierto]);

  async function cargarUsuarios() {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch('/api/v1/usuarios?pagina=1&limite=100', {}, token);
      setUsuarios(data.datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cambiarRol(id, nuevoRol) {
    limpiarErrorFila(id);
    try {
      const actualizado = await apiFetch(
        `/api/v1/usuarios/${id}/rol`,
        { method: 'PATCH', body: JSON.stringify({ rol: nuevoRol }) },
        token,
      );
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol: actualizado.rol } : u));
    } catch (e) {
      setErroresFila(prev => ({ ...prev, [id]: e.message }));
    }
  }

  async function toggleActivacion(id, nuevoEstado) {
    limpiarErrorFila(id);
    try {
      const actualizado = await apiFetch(
        `/api/v1/usuarios/${id}/activacion`,
        { method: 'PATCH', body: JSON.stringify({ activo: nuevoEstado }) },
        token,
      );
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: actualizado.activo } : u));
    } catch (e) {
      setErroresFila(prev => ({ ...prev, [id]: e.message }));
    }
  }

  function limpiarErrorFila(id) {
    setErroresFila(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function abrirModal() {
    setForm({ nombre: '', email: '', password: '' });
    setErrorModal(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (cargandoModal) return;
    setModalAbierto(false);
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setCargandoModal(true);
    setErrorModal(null);
    try {
      await apiFetch('/api/v1/auth/registro', {
        method: 'POST',
        body: JSON.stringify(form),
      }, token);
      setModalAbierto(false);
      await cargarUsuarios();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setCargandoModal(false);
    }
  }

  if (cargando) {
    return (
      <div style={estiloEstado}>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>Cargando usuarios…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...estiloEstado, color: '#FC5779' }}>
        <span>Error al cargar usuarios: {error}</span>
        <button onClick={cargarUsuarios} style={estiloBotonReintentar}>Reintentar</button>
      </div>
    );
  }

  return (
    <>
      {/* Botón fuera del container, alineado a la izquierda — mismo patrón que Activos.jsx */}
      <div style={{ marginBottom: '1rem' }}>
        <button className="btn-primario" onClick={abrirModal}>
          + Nuevo usuario
        </button>
      </div>

      {/* Modal de registro */}
      {modalAbierto && (
        <div
          onClick={cerrarModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              padding: '1.75rem', width: '100%', maxWidth: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700, color: '#1A1A1A' }}>
              Nuevo usuario
            </h3>
            <form onSubmit={handleCrearUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={estiloLabel}>
                Nombre
                <input
                  required
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  style={estiloInput}
                  placeholder="Nombre completo"
                />
              </label>
              <label style={estiloLabel}>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={estiloInput}
                  placeholder="correo@ejemplo.com"
                />
              </label>
              <label style={estiloLabel}>
                Contraseña
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={estiloInput}
                  placeholder="Mínimo 8 caracteres"
                />
              </label>

              {errorModal && (
                <p style={{ margin: 0, color: '#EF4444', fontSize: '0.82rem' }}>{errorModal}</p>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={cargandoModal}
                  style={estiloBotonSecundario}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoModal}
                  style={estiloBotonPrimario}
                >
                  {cargandoModal ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={estilos.tabla}>
            <thead>
              <tr>
                {['Nombre', 'Email', 'Rol', 'Activo', 'Cambiar rol', 'Activación'].map(col => (
                  <th key={col} style={estilos.th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                    Sin usuarios registrados.
                  </td>
                </tr>
              ) : usuarios.map((u, i) => {
                // El admin no puede modificar su propia fila: evita auto-desactivación y
                // auto-cambio de rol, que el backend rechazaría con 422 igualmente.
                const esPropiaFila = u.id === usuario?.id;
                const errorFila = erroresFila[u.id];

                return (
                  <>
                    <tr
                      key={u.id}
                      onMouseEnter={() => setHoveredRow(u.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        background: hoveredRow === u.id ? '#F0F0F0' : i % 2 === 0 ? '#fff' : '#F9F9F9',
                        transition: 'background 0.1s',
                        opacity: esPropiaFila ? 0.75 : 1,
                      }}
                    >
                      <td style={estilos.td}>{u.nombre}</td>
                      <td style={{ ...estilos.td, color: '#9AA0A6' }}>{u.email}</td>
                      <td style={estilos.td}>
                        <RolBadge rol={u.rol} />
                      </td>
                      <td style={estilos.td}>
                        <span style={{
                          ...estiloBadge,
                          background: u.activo ? '#16A34A' : '#EF4444',
                          color: '#fff',
                        }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={estilos.td}>
                        <select
                          value={u.rol}
                          disabled={esPropiaFila}
                          onChange={e => cambiarRol(u.id, e.target.value)}
                          title={esPropiaFila ? 'No puedes cambiar tu propio rol' : undefined}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid #ddd',
                            fontSize: '0.8rem',
                            cursor: esPropiaFila ? 'not-allowed' : 'pointer',
                            opacity: esPropiaFila ? 0.4 : 1,
                          }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={estilos.td}>
                        <button
                          disabled={esPropiaFila}
                          onClick={() => toggleActivacion(u.id, !u.activo)}
                          title={esPropiaFila ? 'No puedes desactivarte a ti mismo' : undefined}
                          style={{
                            ...estiloBadge,
                            border: 'none',
                            cursor: esPropiaFila ? 'not-allowed' : 'pointer',
                            opacity: esPropiaFila ? 0.4 : 1,
                            background: u.activo ? '#EF4444' : '#16A34A',
                            color: '#fff',
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                    {/* Error de fila inline — muestra el mensaje del backend (422 u otro) */}
                    {errorFila && (
                      <tr key={`${u.id}-error`} style={{ background: '#FFF5F7' }}>
                        <td colSpan={6} style={{ padding: '0.4rem 0.75rem', color: '#EF4444', fontSize: '0.8rem' }}>
                          {errorFila}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// Mismos tokens de estilo que EstadoBadge y TipoBadge: fondo sólido, bordes rectos, sin transparencias.
const estiloBadge = {
  display: 'inline-block',
  minWidth: '5.5rem',
  textAlign: 'center',
  padding: '0.25rem 0.5rem',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

// Mismo patrón que Activos.jsx y OrdenesTrabajo.jsx
const estilos = {
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left', padding: '0.5rem 0.75rem',
    fontWeight: 700, color: '#1A1A1A', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    background: '#F5F5F5', borderBottom: '1px solid #E8E8E8',
  },
  td: { padding: '0.875rem 0.75rem', verticalAlign: 'middle' },
};

const estiloEstado = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '3rem',
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};

const estiloBotonReintentar = {
  padding: '0.35rem 1rem',
  borderRadius: 6,
  border: '1px solid #EF4444',
  background: 'transparent',
  color: '#EF4444',
  fontSize: '0.82rem',
  cursor: 'pointer',
};


const estiloLabel = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#1A1A1A',
};

const estiloInput = {
  padding: '0.5rem 0.65rem',
  borderRadius: 7,
  border: '1px solid #ddd',
  fontSize: '0.88rem',
  color: '#1A1A1A',
  outline: 'none',
};

const estiloBotonPrimario = {
  padding: '0.45rem 1.1rem',
  borderRadius: 7,
  border: 'none',
  background: '#1A1A1A',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const estiloBotonSecundario = {
  padding: '0.45rem 1.1rem',
  borderRadius: 7,
  border: '1px solid #ddd',
  background: 'transparent',
  color: '#555',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
