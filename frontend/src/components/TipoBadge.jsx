const COLORES = {
  INSPECCION:  { bg: '#1D4ED8', texto: '#fff' },
  PREVENTIVO:  { bg: '#0F766E', texto: '#fff' },
  CORRECTIVO:  { bg: '#A21CAF', texto: '#fff' },
  INSTALACION: { bg: '#6D28D9', texto: '#fff' },
  BAJA:        { bg: '#4B5563', texto: '#fff' },
};

const ETIQUETAS = {
  CORRECTIVO:  'Correctivo',
  PREVENTIVO:  'Preventivo',
  INSPECCION:  'Inspección',
  INSTALACION: 'Instalación',
  BAJA:        'Baja',
};

export default function TipoBadge({ tipo }) {
  const { bg, texto } = COLORES[tipo] ?? { bg: '#64748B', texto: '#fff' };
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '6rem',
      textAlign: 'center',
      background: bg,
      color: texto,
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[tipo] ?? tipo}
    </span>
  );
}
