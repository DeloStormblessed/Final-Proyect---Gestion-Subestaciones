import prisma from "../../lib/prisma.js";

// Constantes del dashboard. Si mañana se quiere parametrizar por query (?dias=N, ?topN=20),
// se promueven a parámetros de la función. Por ahora son fijos según scope §9.
const DIAS_VENTANA_OTS_RECIENTES = 30;
const LIMITE_TOP_INSPECCIONES_ATRASADAS = 10;
const LIMITE_ULTIMAS_OTS = 10;

const TIPOS_ORDEN_TRABAJO = [
  "INSPECCION",
  "PREVENTIVO",
  "CORRECTIVO",
  "INSTALACION",
  "BAJA",
];

// Prisma.groupBy() solo devuelve filas para grupos CON datos. Para que la respuesta sea
// estable (todas las claves del enum siempre presentes), rellenamos los que falten a 0.
// El consumidor (frontend, exportación, etc.) puede pintar todas las barras sin defensas.
function aMapaConCerosPorDefecto(filasGroupBy, campo, clavesEsperadas) {
  const mapa = Object.fromEntries(clavesEsperadas.map((k) => [k, 0]));
  for (const fila of filasGroupBy) {
    mapa[fila[campo]] = fila._count._all;
  }
  return mapa;
}

// Calcula días de retraso entre una fecha de inspección vencida y "ahora". Truncamos a días
// enteros: el ingeniero piensa en días, no en horas. Math.floor garantiza que 0.9 días
// se muestre como 0 (vencido HOY, técnicamente aún del día) y 1.1 como 1.
function calcularDiasDeRetraso(fechaProximaInspeccion, ahora) {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.floor(
    (ahora.getTime() - fechaProximaInspeccion.getTime()) / msPorDia,
  );
}

export async function obtenerDashboard() {
  const ahora = new Date();

  // Fecha límite para "OTs de los últimos 30 días". Se calcula UNA VEZ aquí para que todas
  // las queries usen el mismo corte y no haya inconsistencias por milisegundos.
  const hace30Dias = new Date(
    ahora.getTime() - DIAS_VENTANA_OTS_RECIENTES * 24 * 60 * 60 * 1000,
  );

  // V2 — activosPorEstado: groupBy no puede cruzar dos ejes, se usan 4 counts paralelos.
  // Los cuatro "estados lógicos" del dashboard corresponden a combinaciones de cicloVida+disponibilidad:
  //   EN_SERVICIO       = OPERATIVO + EN_SERVICIO
  //   AVERIADO          = OPERATIVO + AVERIADO
  //   FUERA_DE_SERVICIO = OPERATIVO + FUERA_DE_SERVICIO
  //   DADO_DE_BAJA      = DADO_DE_BAJA (disponibilidad congelada, irrelevante para el KPI)
  const [
    enServicioCount,
    averiadoCount,
    fueraCount,
    bajaCount,
    inspeccionesVencidas,
    topInspeccionesAtrasadas,
    filasOtsPorTipo,
    ultimasOrdenesTrabajo,
  ] = await Promise.all([
    // 1a. Activos operativos en servicio
    prisma.activo.count({
      where: { cicloVida: "OPERATIVO", disponibilidad: "EN_SERVICIO" },
    }),
    // 1b. Activos operativos averiados
    prisma.activo.count({
      where: { cicloVida: "OPERATIVO", disponibilidad: "AVERIADO" },
    }),
    // 1c. Activos operativos en descargo
    prisma.activo.count({
      where: { cicloVida: "OPERATIVO", disponibilidad: "FUERA_DE_SERVICIO" },
    }),
    // 1d. Activos dados de baja (cicloVida terminal)
    prisma.activo.count({
      where: { cicloVida: "DADO_DE_BAJA" },
    }),

    // 2. Conteo de activos con inspección vencida. Excluimos DADO_DE_BAJA porque un activo
    // retirado de servicio no se inspecciona — incluirlo sería un falso positivo en el KPI.
    // FUERA_DE_SERVICIO sí cuenta: volverá a entrar en servicio y su fecha sigue siendo relevante.
    prisma.activo.count({
      where: {
        fechaProximaInspeccion: { lt: ahora },
        cicloVida: "OPERATIVO",
      },
    }),

    // 3. Top 10 activos con inspección más atrasada (más vencida primero → orden ASC por fecha).
    // Mismo filtro de exclusión que en (2) por coherencia. Incluimos la subestación para que
    // el dashboard sea accionable de un vistazo (no solo "el activo X está vencido" sino
    // "el activo X de la subestación Y está vencido").
    prisma.activo.findMany({
      where: {
        fechaProximaInspeccion: { lt: ahora },
        cicloVida: "OPERATIVO",
      },
      orderBy: { fechaProximaInspeccion: "asc" },
      take: LIMITE_TOP_INSPECCIONES_ATRASADAS,
      select: {
        id: true,
        codigo: true,
        tipo: true,
        cicloVida: true,
        disponibilidad: true,
        fechaProximaInspeccion: true,
        subestacion: { select: { id: true, codigo: true, nombre: true } },
      },
    }),

    // 4. Conteo de OTs últimos 30 días por tipo. groupBy con where temporal.
    // createdAt y no fechaIntervencion: "registradas en los últimos 30 días", coherente
    // con el criterio de "últimas OTs registradas" del punto 5.
    prisma.ordenTrabajo.groupBy({
      by: ["tipo"],
      where: { createdAt: { gte: hace30Dias } },
      _count: { _all: true },
    }),

    // 5. Últimas 10 OTs registradas. createdAt (registro), NO fechaIntervencion (cuándo ocurrió).
    // Una OT registrada hoy con intervención de hace una semana cuenta como "reciente"
    // en el sentido del dashboard: "qué se ha metido al sistema últimamente".
    prisma.ordenTrabajo.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMITE_ULTIMAS_OTS,
      select: {
        id: true,
        tipo: true,
        resultado: true,
        // V2 — snapshot de dos ejes en lugar del par estadoAnterior/estadoNuevo de V1
        cicloVidaAnterior: true,
        disponibilidadAnterior: true,
        cicloVidaNueva: true,
        disponibilidadNueva: true,
        fechaIntervencion: true,
        createdAt: true,
        activo: { select: { id: true, codigo: true, tipo: true } },
        autor: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  // Post-procesado: enriquecer el top con diasDeRetraso calculado en backend.
  // Razón: el ingeniero piensa en "lleva 47 días vencido", no en fechas absolutas.
  // Calcular aquí garantiza misma zona horaria de referencia para todos los consumidores.
  const topConDiasDeRetraso = topInspeccionesAtrasadas.map((activo) => ({
    ...activo,
    diasDeRetraso: calcularDiasDeRetraso(activo.fechaProximaInspeccion, ahora),
  }));

  return {
    activosPorEstado: {
      EN_SERVICIO: enServicioCount,
      AVERIADO: averiadoCount,
      FUERA_DE_SERVICIO: fueraCount,
      DADO_DE_BAJA: bajaCount,
    },
    inspeccionesVencidas,
    topInspeccionesAtrasadas: topConDiasDeRetraso,
    otsUltimos30DiasPorTipo: aMapaConCerosPorDefecto(
      filasOtsPorTipo,
      "tipo",
      TIPOS_ORDEN_TRABAJO,
    ),
    ultimasOrdenesTrabajo,
  };
}
