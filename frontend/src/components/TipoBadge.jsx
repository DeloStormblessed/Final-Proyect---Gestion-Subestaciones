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
    // min-width, font-size y padding viven en .badge-tipo (index.css):
    // en tablet se compactan vía media query, y el inline lo impediría
    <span className="badge-tipo" style={{
      display: 'inline-block',
      textAlign: 'center',
      background: bg,
      color: texto,
      borderRadius: '6px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[tipo] ?? tipo}
    </span>
  );
}
