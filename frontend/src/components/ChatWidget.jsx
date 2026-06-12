import { useState, useEffect, useRef } from 'react';
import { useAuth, CLAVE_CHAT_SESION } from '../context/AuthContext.jsx';
import { apiFetchIA } from '../lib/apiIA.js';

// Widget flotante del asistente, montado en Layout (no es una ruta).
// Ciclo de vida del historial: el estado se respalda en sessionStorage →
// sobrevive a la navegación entre páginas y al F5, pero muere al cerrar la
// pestaña (alcance natural de sessionStorage) o al hacer logout (lo borra
// AuthContext.logout(), por eso la clave vive allí). La memoria del agente
// está en el servidor keyed por conversation_id: restaurar el id tras un F5
// restaura también el contexto del LLM, no solo las burbujas pintadas.

function leerSesionChat() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_CHAT_SESION)) ?? {};
  } catch {
    return {}; // JSON corrupto → se arranca hilo limpio, no se rompe el render
  }
}
const IconChat = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconCerrar = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export default function ChatWidget() {
  const { token, usuario } = useAuth();
  const [abierto, setAbierto] = useState(false);
  // Inicialización lazy desde sessionStorage: recupera el hilo tras un F5
  const [mensajes, setMensajes] = useState(() => leerSesionChat().mensajes ?? []);
  const [input, setInput] = useState('');
  // El id lo genera el CLIENTE en el primer mensaje; si no se enviara, el
  // backend caería en el hilo "-default" acumulativo que queremos evitar.
  // Prefijo con el id de usuario: el hilo queda atribuible y sin colisiones.
  const [conversationId, setConversationId] = useState(() => leerSesionChat().conversationId ?? null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // Respaldo del hilo en sessionStorage en cada cambio (ver comentario de cabecera)
  useEffect(() => {
    sessionStorage.setItem(CLAVE_CHAT_SESION, JSON.stringify({ mensajes, conversationId }));
  }, [mensajes, conversationId]);

  // Scroll automático al último mensaje (también al reabrir el panel)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, enviando, abierto]);

  async function enviarMensaje() {
    const texto = input.trim();
    if (!texto || enviando) return;

    setInput('');
    setError('');
    // Añade el mensaje del usuario de inmediato (UX optimista)
    setMensajes(prev => [...prev, { rol: 'usuario', contenido: texto }]);
    setEnviando(true);

    try {
      const id = conversationId ?? `${usuario.id}-${crypto.randomUUID()}`;
      const body = { message: texto, conversation_id: id };

      const data = await apiFetchIA('/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      }, token);

      setConversationId(data.conversation_id);
      setMensajes(prev => [...prev, { rol: 'asistente', contenido: data.respuesta }]);
    } catch (err) {
      setError(err.message);
      // Elimina el mensaje optimista si hubo error
      setMensajes(prev => prev.slice(0, -1));
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  }

  return (
    <>
      {/* Panel: se oculta con render condicional pero el estado (mensajes,
          conversationId) vive en este componente, que sigue montado */}
      {abierto && (
        <div style={estilos.panel}>
          {/* Cabecera */}
          <div style={estilos.cabecera}>
            <span style={{ fontSize: '1.1rem' }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>
              Asistente de mantenimiento
            </span>
            <button
              onClick={() => setAbierto(false)}
              title="Cerrar"
              style={estilos.btnCerrarCabecera}
            >
              <IconCerrar size={18} color="#999" />
            </button>
          </div>

          {/* Área de mensajes */}
          <div style={estilos.areaMensajes}>
            {mensajes.length === 0 && (
              <div style={{ textAlign: 'center', color: '#aaa', margin: 'auto', padding: '1.5rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  Hola, {usuario?.nombre?.split(' ')[0] ?? 'operario'}.
                </p>
                <p style={{ fontSize: '0.85rem' }}>
                  Puedo consultarte el estado de tus activos, inspecciones pendientes o la normativa de mantenimiento.
                </p>
              </div>
            )}

            {mensajes.map((msg, i) => (
              <Burbuja key={i} rol={msg.rol} contenido={msg.contenido} />
            ))}

            {/* Indicador de escritura mientras el agente responde */}
            {enviando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={estilos.avatar}>🤖</div>
                <div style={{ ...estilos.burbuja, background: 'var(--color-fondo-suave)', color: '#666' }}>
                  <PointsTyping />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="banner-error" style={{ margin: '0 0.75rem 0.5rem', fontSize: '0.85rem' }}>
              {error}
            </p>
          )}

          {/* Input de mensaje */}
          <div style={estilos.zonaInput}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta…"
              rows={1}
              disabled={enviando}
              style={estilos.textarea}
            />
            <button
              onClick={enviarMensaje}
              disabled={!input.trim() || enviando}
              className="btn-primario"
              style={{ alignSelf: 'flex-end', padding: '0.45rem 0.9rem', fontSize: '0.875rem' }}
            >
              {enviando ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante, visible en todas las páginas autenticadas */}
      <button
        onClick={() => setAbierto(a => !a)}
        title={abierto ? 'Cerrar asistente' : 'Abrir asistente'}
        style={estilos.botonFlotante}
      >
        {abierto
          ? <IconCerrar size={22} color="var(--color-nav)" />
          : <IconChat size={24} color="var(--color-nav)" />}
      </button>
    </>
  );
}

function Burbuja({ rol, contenido }) {
  const esUsuario = rol === 'usuario';
  return (
    <div style={{
      display: 'flex',
      justifyContent: esUsuario ? 'flex-end' : 'flex-start',
      alignItems: 'flex-end',
      gap: '0.5rem',
    }}>
      {!esUsuario && <div style={estilos.avatar}>🤖</div>}

      <div style={{
        ...estilos.burbuja,
        background: esUsuario ? 'var(--color-primario)' : 'var(--color-fondo-suave)',
        color: esUsuario ? 'var(--color-nav)' : 'var(--color-texto)',
        borderBottomRightRadius: esUsuario ? 4 : 14,
        borderBottomLeftRadius: esUsuario ? 14 : 4,
        maxWidth: '82%',
        whiteSpace: 'pre-wrap',
      }}>
        {contenido}
      </div>

      {esUsuario && <div style={estilos.avatar}>👤</div>}
    </div>
  );
}

function PointsTyping() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--color-gris)',
          animation: `bounce 1s ${i * 0.15}s infinite`,
          display: 'inline-block',
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </span>
  );
}

const estilos = {
  botonFlotante: {
    position: 'fixed',
    bottom: '1.25rem',
    right: '1.25rem',
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--color-primario)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
    zIndex: 1001,
  },
  panel: {
    position: 'fixed',
    bottom: 'calc(1.25rem + 56px + 0.75rem)',
    right: '1.25rem',
    // Responsive sin media queries: en escritorio clava 380px; en móvil el
    // min() cede al ancho del viewport menos margen
    width: 'min(380px, calc(100vw - 2rem))',
    height: 'min(560px, calc(100vh - 8rem))',
    background: 'var(--color-fondo)',
    borderRadius: 14,
    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
  },
  cabecera: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #eee',
    flexShrink: 0,
  },
  btnCerrarCabecera: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 2,
  },
  areaMensajes: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  zonaInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0.75rem',
    borderTop: '1px solid #eee',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    background: 'transparent',
    lineHeight: 1.5,
  },
  burbuja: {
    padding: '0.6rem 0.85rem',
    borderRadius: 14,
    fontSize: '0.875rem',
    lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  avatar: { fontSize: '1.05rem', flexShrink: 0 },
};
