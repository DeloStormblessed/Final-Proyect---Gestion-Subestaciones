import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Guard de ruta para páginas exclusivas de ADMIN.
// Dos niveles: sin sesión → /login; con sesión pero rol ≠ ADMIN → /dashboard.
// Ocultar el enlace en la UI es solo UX; este componente es el control de acceso real.
export default function RutaAdmin() {
  const { token, usuario } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (usuario?.rol !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
