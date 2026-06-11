import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetchIA } from '../lib/apiIA.js';

export default function Chat() {
  const { token, usuario } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

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
      const body = { message: texto };
      // reenvía el conversation_id para mantener la memoria entre turnos
      if (conversationId) body.conversation_id = conversationId;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
        Asistente de mantenimiento
      </h2>

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
        {mensajes.length === 0 && (
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
