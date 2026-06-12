import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetchIA } from '../lib/apiIA.js';

// Hilo de conversación por sesión de pestaña, NO el hilo "{userId}-default" eterno
// del backend: el historial acumulado se reenvía al LLM en cada llamada de cada turno,
// así que un hilo sin fin encarece todas las preguntas (y agota el rate-limit de Groq).
// sessionStorage (no localStorage): la conversación sobrevive a recargas pero cada
// pestaña/sesión nueva empieza con un hilo limpio. Clave por usuario para no heredar
// el hilo de otro login en la misma pestaña.
function claveConversacion(usuarioId) {
  return `chat-conversacion-${usuarioId}`;
}

export default function Chat() {
  const { token, usuario } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(() =>
    usuario ? sessionStorage.getItem(claveConversacion(usuario.id)) : null
  );
  const [cargandoHistorial, setCargandoHistorial] = useState(Boolean(conversationId));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // Si la sesión ya tenía conversación, se restaura desde el ia-service al entrar
  // a /chat (la memoria vive en el checkpointer de Postgres, no en el navegador).
  // Forma confirmada en routers/chat.py: { conversation_id, mensajes: [{ rol, contenido }] }
  useEffect(() => {
    if (!conversationId) return;
    let cancelado = false;
    (async () => {
      try {
        const data = await apiFetchIA(`/api/chat/history/${conversationId}`, {}, token);
        if (!cancelado) setMensajes(data.mensajes ?? []);
      } catch {
        // Historial irrecuperable (hilo borrado, servicio caído…): no es bloqueante,
        // se descarta el id y la siguiente pregunta estrena conversación.
        if (!cancelado) {
          sessionStorage.removeItem(claveConversacion(usuario.id));
          setConversationId(null);
        }
      } finally {
        if (!cancelado) setCargandoHistorial(false);
      }
    })();
    return () => { cancelado = true; };
    // Solo al montar: el id solo cambia desde esta misma página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuevaConversacion() {
    sessionStorage.removeItem(claveConversacion(usuario.id));
    setConversationId(null);
    setMensajes([]);
    setError('');
  }

  // Scroll automático al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, enviando]);

  async function enviarMensaje() {
    const texto = input.trim();
    if (!texto || enviando) return;

    setInput('');
    setError('');
    // Añade el mensaje del usuario de inmediato (UX optimista)
    setMensajes(prev => [...prev, { rol: 'usuario', contenido: texto }]);
    setEnviando(true);

    try {
      // El id lo genera el CLIENTE (hilo nuevo por sesión); si no se enviara,
      // el backend caería en el hilo "-default" acumulativo que queremos evitar.
      // Prefijo con el id de usuario: el hilo queda atribuible y sin colisiones.
      const id = conversationId ?? `${usuario.id}-${crypto.randomUUID()}`;
      const body = { message: texto, conversation_id: id };

      const data = await apiFetchIA('/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      }, token);

      setConversationId(data.conversation_id);
      sessionStorage.setItem(claveConversacion(usuario.id), data.conversation_id);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          Asistente de mantenimiento
        </h2>
        {/* Estrenar hilo a demanda: además de mejorar la UX, descarta el historial
            acumulado que encarece cada turno del agente */}
        {mensajes.length > 0 && !enviando && (
          <button
            onClick={nuevaConversacion}
            className="btn-secundario"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            Nueva conversación
          </button>
        )}
      </div>

      {/* Área de mensajes */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--color-fondo)',
        borderRadius: 12,
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        marginBottom: '0.75rem',
      }}>
        {cargandoHistorial && (
          <div style={{ textAlign: 'center', color: '#aaa', margin: 'auto', padding: '2rem' }}>
            Recuperando conversación…
          </div>
        )}

        {!cargandoHistorial && mensajes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#aaa', margin: 'auto', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤖</div>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Hola, {usuario?.nombre?.split(' ')[0] ?? 'operario'}.</p>
            <p style={{ fontSize: '0.875rem' }}>
              Puedo consultarte el estado de tus activos, inspecciones pendientes o el dashboard de mantenimiento.
            </p>
          </div>
        )}

        {mensajes.map((msg, i) => (
          <Burbuja key={i} rol={msg.rol} contenido={msg.contenido} />
        ))}

        {/* Indicador de escritura mientras el agente responde */}
        {enviando && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={estilos.avatarAsistente}>🤖</div>
            <div style={{ ...estilos.burbuja, background: 'var(--color-fondo-suave)', color: '#666' }}>
              <PointsTyping />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="banner-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      {/* Input de mensaje */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-fondo)', borderRadius: 10, padding: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta… (Enter para enviar)"
          rows={1}
          disabled={enviando}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            background: 'transparent',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={enviarMensaje}
          disabled={!input.trim() || enviando}
          className="btn-primario"
          style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}
        >
          {enviando ? '…' : 'Enviar'}
        </button>
      </div>

      {/* TODO: mostrar fuentes cuando RAG esté activo en ia-service */}
    </div>
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
      {!esUsuario && <div style={estilos.avatarAsistente}>🤖</div>}

      <div style={{
        ...estilos.burbuja,
        background: esUsuario ? 'var(--color-primario)' : 'var(--color-fondo-suave)',
        color: esUsuario ? 'var(--color-nav)' : 'var(--color-texto)',
        borderBottomRightRadius: esUsuario ? 4 : 14,
        borderBottomLeftRadius: esUsuario ? 14 : 4,
        maxWidth: '78%',
        whiteSpace: 'pre-wrap',
      }}>
        {contenido}
      </div>

      {esUsuario && <div style={estilos.avatarUsuario}>👤</div>}
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
  burbuja: {
    padding: '0.65rem 0.95rem',
    borderRadius: 14,
    fontSize: '0.9rem',
    lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  avatarAsistente: { fontSize: '1.1rem', flexShrink: 0 },
  avatarUsuario:   { fontSize: '1.1rem', flexShrink: 0 },
};
