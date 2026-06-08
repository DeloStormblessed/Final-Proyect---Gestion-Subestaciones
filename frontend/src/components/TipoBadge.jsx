const COLORES = {
  CORRECTIVO:  'var(--color-rojo)',
  PREVENTIVO:  'var(--color-primario)',
  INSPECCION:  'var(--color-violeta)',
  INSTALACION: 'var(--color-oliva)',
  BAJA:        'var(--color-gris)',
};

const ETIQUETAS = {
  CORRECTIVO:  'Correctivo',
  PREVENTIVO:  'Preventivo',
  INSPECCION:  'Inspección',
  INSTALACION: 'Instalación',
  BAJA:        'Baja',
};

export default function TipoBadge({ tipo }) {
  const color = COLORES[tipo] ?? 'var(--color-gris)';
  const textoOscuro = tipo === 'PREVENTIVO' || tipo === 'INSTALACION';
  return (
    <span style={{
      background: color,
      color: textoOscuro ? 'var(--color-nav)' : '#fff',
      padding: '0.2rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[tipo] ?? tipo}
    </span>
  );
}
