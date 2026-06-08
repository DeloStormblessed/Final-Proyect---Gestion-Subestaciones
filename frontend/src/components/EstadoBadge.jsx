const COLORES = {
  EN_SERVICIO:       'var(--color-primario)',
  AVERIADO:          'var(--color-rojo)',
  FUERA_DE_SERVICIO: 'var(--color-ambar)',
  DADO_DE_BAJA:      'var(--color-gris)',
};

const ETIQUETAS = {
  EN_SERVICIO:       'En servicio',
  AVERIADO:          'Averiado',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA:      'Dado de baja',
};

export default function EstadoBadge({ estado }) {
  const color = COLORES[estado] ?? 'var(--color-gris)';
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '8.5rem',
      textAlign: 'center',
      background: color,
      color: estado === 'FUERA_DE_SERVICIO' ? '#333' : estado === 'EN_SERVICIO' ? 'var(--color-nav)' : '#fff',
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
