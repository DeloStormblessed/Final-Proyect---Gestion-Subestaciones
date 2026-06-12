import { Link } from 'react-router-dom';

// Página 404 del catch-all (*). Standalone (fuera de Layout): debe funcionar
// igual con o sin sesión. El botón apunta a /dashboard; si no hay sesión,
// RutaProtegida ya rebota a /login — no hace falta lógica de auth aquí.
export default function NoEncontrada() {
  return (
    <div style={estilos.pagina}>
      <div style={estilos.tarjeta}>
        <div style={estilos.codigo}>404</div>
        <h1 style={estilos.titulo}>Página no encontrada</h1>
        <p style={estilos.texto}>
          La ruta que buscas no existe o ha cambiado de sitio.
        </p>
        <Link to="/dashboard" className="btn-primario" style={estilos.boton}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F0F2F5',
    padding: '1rem',
  },
  tarjeta: {
    background: 'var(--color-fondo)',
    borderRadius: 14,
    padding: '3rem 2.5rem',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    maxWidth: 420,
    width: '100%',
  },
  codigo: {
    fontSize: '4.5rem',
    fontWeight: 800,
    lineHeight: 1,
    color: 'var(--color-primario)',
    marginBottom: '0.75rem',
  },
  titulo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--color-texto)',
    marginBottom: '0.5rem',
  },
  texto: {
    fontSize: '0.9rem',
    color: '#888',
    marginBottom: '1.75rem',
  },
  boton: {
    display: 'inline-block',
    padding: '0.6rem 1.5rem',
    textDecoration: 'none',
  },
};
