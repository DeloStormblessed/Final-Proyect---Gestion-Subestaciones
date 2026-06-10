// backend/lib/transiciones.js
// Máquina de estados V2 — dos ejes independientes.
// Eje 1 · cicloVida:      OPERATIVO | DADO_DE_BAJA  (la baja es terminal, sin retorno)
// Eje 2 · disponibilidad: EN_SERVICIO | AVERIADO | FUERA_DE_SERVICIO
//                         (solo significativa si cicloVida = OPERATIVO)
//
// Separar cicloVida de disponibilidad permite registrar QUÉ trabajo se hizo
// (tipo de OT) y en QUÉ CONDICIÓN quedó el equipo (desenlace declarado) como
// dimensiones ortogonales. Reponer un equipo a servicio es el desenlace de la
// intervención (ResultadoIntervencion.OPERATIVO), no un "correctivo de reposición".

import { ReglaNegocio } from './errores.js';

const CICLO_VIDA_VALIDOS      = new Set(['OPERATIVO', 'DADO_DE_BAJA']);
const DISPONIBILIDAD_VALIDAS  = new Set(['EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO']);
const RESULTADO_INSPECCION_VALIDOS = new Set(['CONFORME', 'NO_CONFORME']);

// ResultadoIntervencion → disponibilidad resultante.
// El tipo de OT registra QUÉ se hizo; este mapa traduce el desenlace
// declarado (OPERATIVO/DEFECTUOSO/EN_DESCARGO) al eje de disponibilidad.
const DISP_POR_INTERVENCION = {
  OPERATIVO:   'EN_SERVICIO',
  DEFECTUOSO:  'AVERIADO',
  EN_DESCARGO: 'FUERA_DE_SERVICIO',
};

/**
 * Aplica una transición de estado sobre un activo (modelo V2, dos ejes).
 * Función pura: sin BD, sin Express, testeable como módulo aislado.
 *
 * INSTALACION no llega aquí: es creación atómica del activo con estado inicial
 * OPERATIVO/EN_SERVICIO fijado en el service, no una transición sobre un activo existente.
 *
 * @param {{ cicloVida: string, disponibilidad: string }} estadoActual
 * @param {string} tipoOT — 'INSPECCION' | 'PREVENTIVO' | 'CORRECTIVO' | 'BAJA'
 * @param {{ resultadoInspeccion?: string, resultadoIntervencion?: string }} opts
 * @returns {{ cicloVida: string, disponibilidad: string }}  estado nuevo (ambos ejes)
 * @throws {ReglaNegocio}
 */
export function aplicarTransicion(estadoActual, tipoOT, { resultadoInspeccion, resultadoIntervencion } = {}) {
  const { cicloVida, disponibilidad } = estadoActual ?? {};

  // Guard: ejes de entrada deben pertenecer a los enums conocidos.
  if (!CICLO_VIDA_VALIDOS.has(cicloVida)) {
    throw new ReglaNegocio(`cicloVida desconocido: ${cicloVida}`);
  }
  if (!DISPONIBILIDAD_VALIDAS.has(disponibilidad)) {
    throw new ReglaNegocio(`disponibilidad desconocida: ${disponibilidad}`);
  }

  // Regla A — activo DADO_DE_BAJA: ninguna OT de mantenimiento es válida.
  // Un activo retirado está documentado y no vuelve a recibir intervenciones.
  if (cicloVida === 'DADO_DE_BAJA') {
    throw new ReglaNegocio(
      `Transición no permitida: el activo está DADO_DE_BAJA y no admite OTs de tipo ${tipoOT}`,
    );
  }

  // A partir de aquí, cicloVida === 'OPERATIVO' en todos los casos.

  switch (tipoOT) {
    // Regla B — BAJA: mueve cicloVida → DADO_DE_BAJA (terminal).
    // No toca el eje de disponibilidad: se congela en su último valor registrado.
    case 'BAJA':
      return { cicloVida: 'DADO_DE_BAJA', disponibilidad };

    // Regla C — INSPECCION: solo mueve disponibilidad, nunca cicloVida.
    // Sobre AVERIADO y FUERA_DE_SERVICIO es un no-op de estado (diagnostica, no repara).
    // La OT se registra igualmente como evidencia documental de la inspección realizada.
    case 'INSPECCION': {
      if (!RESULTADO_INSPECCION_VALIDOS.has(resultadoInspeccion)) {
        throw new ReglaNegocio(
          'Una OT de tipo INSPECCION requiere indicar resultadoInspeccion (CONFORME o NO_CONFORME)',
        );
      }
      if (disponibilidad === 'EN_SERVICIO') {
        // Solo desde EN_SERVICIO el resultado puede degradar la disponibilidad.
        // El recálculo de fechaProximaInspeccion cuando CONFORME lo hace el service.
        return {
          cicloVida,
          disponibilidad: resultadoInspeccion === 'CONFORME' ? 'EN_SERVICIO' : 'AVERIADO',
        };
      }
      // AVERIADO o FUERA_DE_SERVICIO: no-op (el resultado no cambia la disponibilidad).
      return { cicloVida, disponibilidad };
    }

    // Regla D — PREVENTIVO: lleva ResultadoIntervencion obligatorio.
    // Se rechaza sobre AVERIADO: un equipo con avería confirmada requiere correctivo
    // primero; aplicar preventivo sería documentalmente incorrecto (UNE-EN 13306).
    case 'PREVENTIVO': {
      if (disponibilidad === 'AVERIADO') {
        throw new ReglaNegocio(
          'Transición no permitida: no se puede aplicar PREVENTIVO a un activo AVERIADO',
        );
      }
      const nuevaDisp = DISP_POR_INTERVENCION[resultadoIntervencion];
      if (!nuevaDisp) {
        throw new ReglaNegocio(
          'Una OT de tipo PREVENTIVO requiere indicar resultadoIntervencion (OPERATIVO, DEFECTUOSO o EN_DESCARGO)',
        );
      }
      return { cicloVida, disponibilidad: nuevaDisp };
    }

    // Regla E — CORRECTIVO: lleva ResultadoIntervencion obligatorio.
    // Acepta cualquier disponibilidad: la intervención correctiva se aplica tanto a
    // averiados como a equipos en descargo o incluso en servicio (mantenimiento curativo).
    case 'CORRECTIVO': {
      const nuevaDisp = DISP_POR_INTERVENCION[resultadoIntervencion];
      if (!nuevaDisp) {
        throw new ReglaNegocio(
          'Una OT de tipo CORRECTIVO requiere indicar resultadoIntervencion (OPERATIVO, DEFECTUOSO o EN_DESCARGO)',
        );
      }
      return { cicloVida, disponibilidad: nuevaDisp };
    }

    default:
      throw new ReglaNegocio(`Tipo de OT desconocido: ${tipoOT}`);
  }
}
