const COLORES = {
  EN_SERVICIO:       '#16A34A',
  AVERIADO:          '#EF4444',
  FUERA_DE_SERVICIO: '#D97706',
  DADO_DE_BAJA:      '#4B5563',
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
      color: '#fff',
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
