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
    // min-width, font-size y padding viven en .badge-estado (index.css):
    // en tablet se compactan vía media query, y el inline lo impediría
    <span className="badge-estado" style={{
      display: 'inline-block',
      textAlign: 'center',
      background: color,
      color: '#fff',
      borderRadius: '6px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
