// backend/tests/transiciones.test.js
// Suite V2 — modelo de dos ejes (cicloVida + disponibilidad).
// Los tests del modelo de un eje (V1) se reemplazan íntegramente: afirman
// un contrato de retorno de tipo string que ya no existe.

import { describe, it, expect } from 'vitest';
import { aplicarTransicion } from '../lib/transiciones.js';
import { ReglaNegocio } from '../lib/errores.js';

// Helpers para construir estados de entrada de forma legible
const op  = (disp) => ({ cicloVida: 'OPERATIVO',    disponibilidad: disp });
const baja = (disp) => ({ cicloVida: 'DADO_DE_BAJA', disponibilidad: disp });

describe('aplicarTransicion — V2 dos ejes', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Regla A — DADO_DE_BAJA: todas las OTs se rechazan
  // Un activo retirado está documentado y no vuelve a recibir intervenciones.
  // ─────────────────────────────────────────────────────────────────────────
  describe('Regla A — activo DADO_DE_BAJA: todas las OTs se rechazan', () => {
    it('rechaza INSPECCION sobre DADO_DE_BAJA', () => {
      expect(() =>
        aplicarTransicion(baja('EN_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'CONFORME' })
      ).toThrow(ReglaNegocio);
    });
    it('rechaza PREVENTIVO sobre DADO_DE_BAJA', () => {
      expect(() =>
        aplicarTransicion(baja('EN_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'OPERATIVO' })
      ).toThrow(ReglaNegocio);
    });
    it('rechaza CORRECTIVO sobre DADO_DE_BAJA', () => {
      expect(() =>
        aplicarTransicion(baja('AVERIADO'), 'CORRECTIVO', { resultadoIntervencion: 'OPERATIVO' })
      ).toThrow(ReglaNegocio);
    });
    it('rechaza BAJA sobre DADO_DE_BAJA (ya está retirado)', () => {
      expect(() =>
        aplicarTransicion(baja('FUERA_DE_SERVICIO'), 'BAJA')
      ).toThrow(ReglaNegocio);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Regla B — BAJA: cicloVida → DADO_DE_BAJA (terminal); disponibilidad se congela
  // ─────────────────────────────────────────────────────────────────────────
  describe('Regla B — BAJA mueve cicloVida y congela disponibilidad', () => {
    it('desde EN_SERVICIO: cicloVida → DADO_DE_BAJA, disponibilidad = EN_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'BAJA'))
        .toEqual({ cicloVida: 'DADO_DE_BAJA', disponibilidad: 'EN_SERVICIO' });
    });
    it('desde AVERIADO: cicloVida → DADO_DE_BAJA, disponibilidad = AVERIADO', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'BAJA'))
        .toEqual({ cicloVida: 'DADO_DE_BAJA', disponibilidad: 'AVERIADO' });
    });
    it('desde FUERA_DE_SERVICIO: cicloVida → DADO_DE_BAJA, disponibilidad = FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'BAJA'))
        .toEqual({ cicloVida: 'DADO_DE_BAJA', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Regla C — INSPECCION: mueve disponibilidad, nunca cicloVida
  // Sobre AVERIADO y FUERA_DE_SERVICIO es no-op: diagnostica, no repara.
  // ─────────────────────────────────────────────────────────────────────────
  describe('Regla C — INSPECCION', () => {
    it('EN_SERVICIO + CONFORME → EN_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('EN_SERVICIO + NO_CONFORME → AVERIADO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'NO_CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('AVERIADO + CONFORME → AVERIADO (no-op: la inspección diagnostica, no repara)', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'INSPECCION', { resultadoInspeccion: 'CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('AVERIADO + NO_CONFORME → AVERIADO (no-op)', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'INSPECCION', { resultadoInspeccion: 'NO_CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('FUERA_DE_SERVICIO + CONFORME → FUERA_DE_SERVICIO (no-op)', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('FUERA_DE_SERVICIO + NO_CONFORME → FUERA_DE_SERVICIO (no-op)', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'NO_CONFORME' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('sin resultadoInspeccion → lanza ReglaNegocio', () => {
      expect(() => aplicarTransicion(op('EN_SERVICIO'), 'INSPECCION')).toThrow(ReglaNegocio);
    });
    it('resultadoInspeccion inválido → lanza ReglaNegocio', () => {
      expect(() =>
        aplicarTransicion(op('EN_SERVICIO'), 'INSPECCION', { resultadoInspeccion: 'MAS_O_MENOS' })
      ).toThrow(ReglaNegocio);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Regla D — PREVENTIVO: requiere ResultadoIntervencion; rechaza AVERIADO
  // No se hace preventivo a algo ya averiado: requiere correctivo primero (UNE-EN 13306).
  // ─────────────────────────────────────────────────────────────────────────
  describe('Regla D — PREVENTIVO', () => {
    it('EN_SERVICIO + OPERATIVO → EN_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'OPERATIVO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('EN_SERVICIO + DEFECTUOSO → AVERIADO (se detectó defecto durante el preventivo)', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'DEFECTUOSO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('EN_SERVICIO + EN_DESCARGO → FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'EN_DESCARGO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('AVERIADO + desenlace válido → lanza ReglaNegocio (preventivo sobre averiado prohibido)', () => {
      expect(() =>
        aplicarTransicion(op('AVERIADO'), 'PREVENTIVO', { resultadoIntervencion: 'OPERATIVO' })
      ).toThrow(ReglaNegocio);
    });
    it('FUERA_DE_SERVICIO + OPERATIVO → EN_SERVICIO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'OPERATIVO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('FUERA_DE_SERVICIO + DEFECTUOSO → AVERIADO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'DEFECTUOSO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('FUERA_DE_SERVICIO + EN_DESCARGO → FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'PREVENTIVO', { resultadoIntervencion: 'EN_DESCARGO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('sin resultadoIntervencion → lanza ReglaNegocio', () => {
      expect(() => aplicarTransicion(op('EN_SERVICIO'), 'PREVENTIVO')).toThrow(ReglaNegocio);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Regla E — CORRECTIVO: requiere ResultadoIntervencion; acepta cualquier disponibilidad
  // El correctivo puede aplicarse independientemente del estado de disponibilidad.
  // ─────────────────────────────────────────────────────────────────────────
  describe('Regla E — CORRECTIVO', () => {
    it('EN_SERVICIO + OPERATIVO → EN_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'OPERATIVO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('EN_SERVICIO + DEFECTUOSO → AVERIADO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'DEFECTUOSO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('EN_SERVICIO + EN_DESCARGO → FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('EN_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'EN_DESCARGO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('AVERIADO + OPERATIVO → EN_SERVICIO (reposición de servicio)', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'CORRECTIVO', { resultadoIntervencion: 'OPERATIVO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('AVERIADO + DEFECTUOSO → AVERIADO', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'CORRECTIVO', { resultadoIntervencion: 'DEFECTUOSO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('AVERIADO + EN_DESCARGO → FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('AVERIADO'), 'CORRECTIVO', { resultadoIntervencion: 'EN_DESCARGO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('FUERA_DE_SERVICIO + OPERATIVO → EN_SERVICIO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'OPERATIVO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'EN_SERVICIO' });
    });
    it('FUERA_DE_SERVICIO + DEFECTUOSO → AVERIADO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'DEFECTUOSO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'AVERIADO' });
    });
    it('FUERA_DE_SERVICIO + EN_DESCARGO → FUERA_DE_SERVICIO', () => {
      expect(aplicarTransicion(op('FUERA_DE_SERVICIO'), 'CORRECTIVO', { resultadoIntervencion: 'EN_DESCARGO' }))
        .toEqual({ cicloVida: 'OPERATIVO', disponibilidad: 'FUERA_DE_SERVICIO' });
    });
    it('sin resultadoIntervencion → lanza ReglaNegocio', () => {
      expect(() => aplicarTransicion(op('AVERIADO'), 'CORRECTIVO')).toThrow(ReglaNegocio);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Errores de entrada — protección contra llamadas malformadas
  // En producción el enum de Prisma lo blinda; aquí cubrimos tests directos
  // y posibles datos corruptos en migraciones o seeds.
  // ─────────────────────────────────────────────────────────────────────────
  describe('Errores de entrada', () => {
    it('cicloVida desconocido → lanza ReglaNegocio', () => {
      expect(() =>
        aplicarTransicion({ cicloVida: 'FANTASMA', disponibilidad: 'EN_SERVICIO' }, 'BAJA')
      ).toThrow(ReglaNegocio);
    });
    it('disponibilidad desconocida → lanza ReglaNegocio', () => {
      expect(() =>
        aplicarTransicion({ cicloVida: 'OPERATIVO', disponibilidad: 'FUNCIONANDO' }, 'BAJA')
      ).toThrow(ReglaNegocio);
    });
    it('tipo de OT desconocido → lanza ReglaNegocio', () => {
      expect(() =>
        aplicarTransicion(op('EN_SERVICIO'), 'REVISION_MAGICA')
      ).toThrow(ReglaNegocio);
    });
  });
});
