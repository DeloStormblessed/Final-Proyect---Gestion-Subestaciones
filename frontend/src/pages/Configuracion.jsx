import { useState } from 'react';
import GestionUsuarios from '../components/configuracion/GestionUsuarios.jsx';
import MaquinaEstados from '../components/configuracion/MaquinaEstados.jsx';
import PermisosRol from '../components/configuracion/PermisosRol.jsx';

const PANELES = [
  { valor: 'usuarios', label: 'Gestión de usuarios' },
  { valor: 'estados',  label: 'Máquina de estados'  },
  { valor: 'permisos', label: 'Permisos por rol'     },
];

export default function Configuracion() {
  const [panel, setPanel] = useState('usuarios');

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          Configuración
        </h1>
        <select
          value={panel}
          onChange={e => setPanel(e.target.value)}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #ddd',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: '#fff',
            cursor: 'pointer',
            color: '#1A1A1A',
          }}
        >
          {PANELES.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
      </div>

      {panel === 'usuarios' && <GestionUsuarios />}
      {panel === 'estados'  && <MaquinaEstados />}
      {panel === 'permisos' && <PermisosRol />}
    </div>
  );
}
