// Sigue el mismo patrón visual que EstadoBadge y TipoBadge:
// fondo sólido con la variable CSS del color del rol, texto oscuro/claro según luminosidad.
const COLORES = {
  ADMIN:    { bg: '#7C3AED', texto: '#fff' },
  TECNICO:  { bg: '#4D7C0F', texto: '#fff' },
  OPERARIO: { bg: '#B45309', texto: '#fff' },
};

const ETIQUETAS = {
  ADMIN:    'Admin',
  TECNICO:  'Técnico',
  OPERARIO: 'Operario',
};

export default function RolBadge({ rol }) {
  const { bg, texto } = COLORES[rol] ?? { bg: '#64748B', texto: '#fff' };
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '5.5rem',
      textAlign: 'center',
      background: bg,
      color: texto,
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {ETIQUETAS[rol] ?? rol}
    </span>
  );
}
