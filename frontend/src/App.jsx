import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import RutaAdmin from './components/RutaAdmin.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Activos from './pages/Activos.jsx';
import ActivoDetalle from './pages/ActivoDetalle.jsx';
import Chat from './pages/Chat.jsx';
import OrdenesTrabajo from './pages/OrdenesTrabajo.jsx';
import Configuracion from './pages/Configuracion.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      {/* Rutas autenticadas: primero valida token, luego aplica Layout */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/activos"          element={<Activos />} />
          <Route path="/activos/:id"      element={<ActivoDetalle />} />
          <Route path="/ordenes-trabajo"  element={<OrdenesTrabajo />} />
          <Route path="/chat"             element={<Chat />} />

          {/* Rutas exclusivas de ADMIN: RutaAdmin redirige si rol ≠ ADMIN */}
          <Route element={<RutaAdmin />}>
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
