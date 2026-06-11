// Sigue el mismo patrón visual que EstadoBadge y TipoBadge:
// fondo sólido con la variable CSS del color del rol, texto oscuro/claro según luminosidad.
const COLORES = {
  ADMIN:    'var(--color-violeta)',
  TECNICO:  'var(--color-primario)',
  OPERARIO: 'var(--color-ambar)',
};

const ETIQUETAS = {
  ADMIN:    'Admin',
  TECNICO:  'Técnico',
  OPERARIO: 'Operario',
};

export default function RolBadge({ rol }) {
  const color = COLORES[rol] ?? 'var(--color-gris)';
  // violeta → texto claro; primario y ambar son colores claros → texto oscuro
  const textoOscuro = rol === 'TECNICO' || rol === 'OPERARIO';
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '5.5rem',
      textAlign: 'center',
      background: color,
      color: textoOscuro ? 'var(--color-nav)' : '#fff',
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
