import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Clave del hilo de chat en sessionStorage. Vive aquí (y no en ChatWidget)
// porque logout() debe borrarla: cerrar sesión borra TODO rastro de la sesión,
// incluida la conversación con el asistente.
export const CLAVE_CHAT_SESION = 'chat-widget';

export function AuthProvider({ children }) {
  // Inicialización lazy: lee localStorage en el primer render, antes de que
  // RutaProtegida evalúe si hay sesión, evitando el redirect espurio en F5.
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('usuario');
    return saved ? JSON.parse(saved) : null;
  });

  function login(usuarioData, tokenData) {
    setUsuario(usuarioData);
    setToken(tokenData);
    localStorage.setItem('token', tokenData);
    localStorage.setItem('usuario', JSON.stringify(usuarioData));
  }

  function logout() {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    // La conversación del asistente muere con la sesión, no debe heredarla
    // el siguiente usuario que entre en esta misma pestaña
    sessionStorage.removeItem(CLAVE_CHAT_SESION);
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
