// Función primitiva: recibe los dos ejes sueltos.
// Reutilizable para activos, snapshots de OT, o cualquier par cicloVida+disponibilidad.
export function derivarEstado(cicloVida, disponibilidad) {
  if (cicloVida === 'DADO_DE_BAJA') return 'DADO_DE_BAJA';
  return disponibilidad; // EN_SERVICIO | AVERIADO | FUERA_DE_SERVICIO
}

// Wrapper para activos: extrae los ejes del objeto y delega en derivarEstado.
// Recompone los dos ejes del backend V2 en el estado visual único que la UI ya conocía.
export function estadoVisual(activo) {
  return derivarEstado(activo.cicloVida, activo.disponibilidad);
}
