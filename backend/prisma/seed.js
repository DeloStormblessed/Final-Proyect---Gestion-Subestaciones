import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { aplicarTransicion } from "../lib/transiciones.js";
import { obtenerIntervaloInspeccion, calcularProximaInspeccion } from "../lib/intervalos-inspeccion.js";

const prisma = new PrismaClient();

const ahora = new Date();
const enDias = (d) => new Date(ahora.getTime() + d * 24 * 60 * 60 * 1000);

// Estado inicial de cualquier activo recién instalado.
const INI = { cicloVida: "OPERATIVO", disponibilidad: "EN_SERVICIO" };

// Aplica una transición con la misma máquina de estados que la app y crea la OT.
// Los snapshots cicloVida*/disponibilidad* son coherentes por construcción:
// un historial inválido es imposible porque aplicarTransicion lanzaría antes de crear nada.
async function ot(activoId, estadoActual, tipo, opts, campos) {
  const nuevo = aplicarTransicion(estadoActual, tipo, opts);
  await prisma.ordenTrabajo.create({
    data: {
      tipo,
      resultado:             opts.resultadoInspeccion   ?? null,
      resultadoIntervencion: opts.resultadoIntervencion ?? null,
      cicloVidaAnterior:      estadoActual.cicloVida,
      disponibilidadAnterior: estadoActual.disponibilidad,
      cicloVidaNueva:         nuevo.cicloVida,
      disponibilidadNueva:    nuevo.disponibilidad,
      ...campos,
      activoId,
    },
  });
  return nuevo;
}

// Limpieza en cascada respetando FK con onDelete: Restrict.
async function limpiar() {
  await prisma.ordenTrabajo.deleteMany();
  await prisma.activo.deleteMany();
  await prisma.etiqueta.deleteMany();
  await prisma.subestacion.deleteMany();
  await prisma.usuario.deleteMany();
}

async function crearUsuarios() {
  const passwordAdmin    = await bcrypt.hash("admin123",    10);
  const passwordTecnico  = await bcrypt.hash("tecnico123",  10);
  const passwordOperario = await bcrypt.hash("operario123", 10);

  const admin = await prisma.usuario.create({
    data: { email: "admin@gmao.com", passwordHash: passwordAdmin, nombre: "Ana Administradora", rol: "ADMIN" },
  });
  const tecnico1 = await prisma.usuario.create({
    data: { email: "tecnico@gmao.com", passwordHash: passwordTecnico, nombre: "Tomás Técnico", rol: "TECNICO" },
  });
  const tecnico2 = await prisma.usuario.create({
    data: { email: "tecnico2@gmao.com", passwordHash: passwordTecnico, nombre: "Teresa Técnica", rol: "TECNICO" },
  });
  const operario1 = await prisma.usuario.create({
    data: { email: "operario@gmao.com", passwordHash: passwordOperario, nombre: "Óscar Operario", rol: "OPERARIO" },
  });
  const operario2 = await prisma.usuario.create({
    data: { email: "operario2@gmao.com", passwordHash: passwordOperario, nombre: "Olivia Operaria", rol: "OPERARIO" },
  });

  return { admin, tecnico1, tecnico2, operario1, operario2 };
}

async function crearSubestaciones() {
  const norte = await prisma.subestacion.create({
    data: { codigo: "SE-NORTE-220", nombre: "Subestación Norte 220kV", ubicacion: "Madrid", tensionNominal: 220 },
  });
  const levante = await prisma.subestacion.create({
    data: { codigo: "SE-LEVANTE-132", nombre: "Subestación Levante 132kV", ubicacion: "Valencia", tensionNominal: 132 },
  });
  const costa = await prisma.subestacion.create({
    data: { codigo: "SE-COSTA-66", nombre: "Subestación Costa 66kV", ubicacion: "Málaga", tensionNominal: 66 },
  });
  const sur = await prisma.subestacion.create({
    data: { codigo: "SE-SUR-132", nombre: "Subestación Sur 132kV", ubicacion: "Sevilla", tensionNominal: 132 },
  });
  const centro = await prisma.subestacion.create({
    data: { codigo: "SE-CENTRO-66", nombre: "Subestación Centro 66kV", ubicacion: "Toledo", tensionNominal: 66 },
  });
  const noroeste = await prisma.subestacion.create({
    data: { codigo: "SE-NOROESTE-45", nombre: "Subestación Noroeste 45kV", ubicacion: "A Coruña", tensionNominal: 45 },
  });
  // Subestación inactiva sin activos: demuestra soft delete y que el dashboard la ignora.
  const industrial = await prisma.subestacion.create({
    data: { codigo: "SE-INDUSTRIAL-45", nombre: "Subestación Polígono Industrial 45kV", ubicacion: "Bilbao", tensionNominal: 45, activa: false },
  });

  return { norte, levante, costa, sur, centro, noroeste, industrial };
}

async function crearEtiquetas() {
  const critico      = await prisma.etiqueta.create({ data: { nombre: "Crítico",                color: "#dc2626" } });
  const garantia     = await prisma.etiqueta.create({ data: { nombre: "Garantía vigente",       color: "#16a34a" } });
  const postTormenta = await prisma.etiqueta.create({ data: { nombre: "Revisión post-tormenta", color: "#eab308" } });
  const pendienteBaja = await prisma.etiqueta.create({ data: { nombre: "Pendiente de baja",     color: "#6b7280" } });

  return { critico, garantia, postTormenta, pendienteBaja };
}

// Crea el activo y su OT de INSTALACION (siempre OPERATIVO/EN_SERVICIO).
// fechaProximaInspeccionOverride se usa para los activos con inspección vencida
// que deben alimentar la curva de atrasos del dashboard.
async function crearActivoConInstalacion({
  codigo, tipo, fabricante, modelo, numeroSerie, subestacionId,
  diasDesdePuestaEnServicio, fechaProximaInspeccionOverride,
}, autorId) {
  const fechaPuestaEnServicio  = enDias(diasDesdePuestaEnServicio);
  const fechaProximaInspeccion = fechaProximaInspeccionOverride
    ?? calcularProximaInspeccion(fechaPuestaEnServicio, tipo);

  const activo = await prisma.activo.create({
    data: { codigo, tipo, fabricante, modelo, numeroSerie, fechaPuestaEnServicio, fechaProximaInspeccion, subestacionId },
  });

  await prisma.ordenTrabajo.create({
    data: {
      tipo: "INSTALACION",
      descripcion: `Puesta en servicio de ${codigo}`,
      cicloVidaAnterior: null,
      disponibilidadAnterior: null,
      cicloVidaNueva: "OPERATIVO",
      disponibilidadNueva: "EN_SERVICIO",
      fechaIntervencion: fechaPuestaEnServicio,
      createdAt: fechaPuestaEnServicio,
      activoId: activo.id,
      autorId,
    },
  });

  return activo;
}

async function crearActivos(usuarios, subs) {
  // ── SE-NORTE-220 ────────────────────────────────────────────────────────────

  const ac01 = await crearActivoConInstalacion({
    codigo: "T-NORTE-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Siemens", modelo: "TR-220-40", numeroSerie: "SN-V2-001",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -180,
  }, usuarios.tecnico1.id);
  // RICH: INSP(CONFORME) → PREV(OPERATIVO) → INSP(CONFORME) → EN_SERVICIO
  {
    let e = INI;
    e = await ot(ac01.id, e, "INSPECCION", { resultadoInspeccion: "CONFORME" }, {
      descripcion: "Inspección semestral programada: parámetros eléctricos y térmicos conformes",
      fechaIntervencion: enDias(-150), createdAt: enDias(-150), autorId: usuarios.tecnico1.id,
    });
    e = await ot(ac01.id, e, "PREVENTIVO", { resultadoIntervencion: "OPERATIVO" }, {
      descripcion: "Mantenimiento preventivo semestral: limpieza de bornes, ajuste de protecciones y revisión de devanados",
      fechaIntervencion: enDias(-90), createdAt: enDias(-90), autorId: usuarios.tecnico1.id,
    });
    e = await ot(ac01.id, e, "INSPECCION", { resultadoInspeccion: "CONFORME" }, {
      descripcion: "Inspección rutinaria trimestral: sin anomalías detectadas",
      fechaIntervencion: enDias(-21), createdAt: enDias(-21), autorId: usuarios.operario1.id,
    });
    await prisma.activo.update({
      where: { id: ac01.id },
      data: { ...e, fechaProximaInspeccion: calcularProximaInspeccion(enDias(-21), "TRANSFORMADOR_POTENCIA") },
    });
  }

  const ac02 = await crearActivoConInstalacion({
    codigo: "T-NORTE-02", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "ABB", modelo: "TR-220-50", numeroSerie: "SN-V2-002",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -150,
  }, usuarios.tecnico1.id);
  // RICH: PREV(DEFECTUOSO) → CORR(OPERATIVO) → EN_SERVICIO
  {
    let e = INI;
    e = await ot(ac02.id, e, "PREVENTIVO", { resultadoIntervencion: "DEFECTUOSO" }, {
      descripcion: "Preventivo programado: rebabas en bobinado secundario detectadas — equipo pasa a avería",
      fechaIntervencion: enDias(-110), createdAt: enDias(-110), autorId: usuarios.tecnico2.id,
    });
    e = await ot(ac02.id, e, "CORRECTIVO", { resultadoIntervencion: "OPERATIVO" }, {
      descripcion: "Reparación de bobinado y prueba de vacío superada: equipo repuesto a servicio",
      fechaIntervencion: enDias(-60), createdAt: enDias(-60), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac02.id }, data: e });
  }

  const ac03 = await crearActivoConInstalacion({
    codigo: "T-NORTE-03", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "ABB", modelo: "TR-220-60", numeroSerie: "SN-V2-003",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -90,
  }, usuarios.tecnico1.id);
  // MEDIUM: INSP(NO_CONFORME) → AVERIADO
  {
    let e = INI;
    e = await ot(ac03.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Anomalía térmica detectada en bobinado primario — equipo pasa a avería, pendiente correctivo",
      fechaIntervencion: enDias(-28), createdAt: enDias(-28), autorId: usuarios.operario1.id,
    });
    await prisma.activo.update({ where: { id: ac03.id }, data: e });
  }

  const ac04 = await crearActivoConInstalacion({
    codigo: "QA-NORTE-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "Schneider", modelo: "SF6-220", numeroSerie: "SN-V2-004",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.tecnico2.id);
  // MEDIUM: INSP(CONFORME) → EN_SERVICIO, fecha actualizada
  {
    let e = INI;
    e = await ot(ac04.id, e, "INSPECCION", { resultadoInspeccion: "CONFORME" }, {
      descripcion: "Inspección anual: aislamiento y mecanismo de disparo conformes",
      fechaIntervencion: enDias(-14), createdAt: enDias(-14), autorId: usuarios.operario2.id,
    });
    await prisma.activo.update({
      where: { id: ac04.id },
      data: { ...e, fechaProximaInspeccion: calcularProximaInspeccion(enDias(-14), "INTERRUPTOR_AUTOMATICO") },
    });
  }

  // Solo INSTAL, VENCIDA (mar-2026): override enDias(-101)
  const ac05 = await crearActivoConInstalacion({
    codigo: "QA-NORTE-02", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "Siemens", modelo: "SF6-220-G2", numeroSerie: "SN-V2-005",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -400,
    fechaProximaInspeccionOverride: enDias(-101),
  }, usuarios.tecnico1.id);

  const ac06 = await crearActivoConInstalacion({
    codigo: "QB-NORTE-01", tipo: "SECCIONADOR",
    fabricante: "Hitachi", modelo: "SC-220", numeroSerie: "SN-V2-006",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -80,
  }, usuarios.tecnico2.id);
  // MEDIUM: PREV(EN_DESCARGO) → FUERA_DE_SERVICIO
  {
    let e = INI;
    e = await ot(ac06.id, e, "PREVENTIVO", { resultadoIntervencion: "EN_DESCARGO" }, {
      descripcion: "Preventivo programado: engrase de mecanismo — consignado pendiente de prueba funcional",
      fechaIntervencion: enDias(-35), createdAt: enDias(-35), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac06.id }, data: e });
  }

  // Solo INSTAL, EN_SERVICIO
  const ac07 = await crearActivoConInstalacion({
    codigo: "F-NORTE-01", tipo: "PARARRAYOS",
    fabricante: "Siemens", modelo: "PR-220", numeroSerie: "SN-V2-007",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -200,
  }, usuarios.tecnico2.id);

  const ac08 = await crearActivoConInstalacion({
    codigo: "TT-NORTE-01", tipo: "TRANSFORMADOR_MEDIDA",
    fabricante: "Arteche", modelo: "TM-220-OLD", numeroSerie: "SN-V2-008",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -700,
  }, usuarios.tecnico1.id);
  // RICH: INSP(NO_CONFORME, -400d) → BAJA(-180d) → DADO_DE_BAJA
  {
    let e = INI;
    e = await ot(ac08.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección post-tormenta: daños por descarga atmosférica — avería grave, irreparable",
      fechaIntervencion: enDias(-400), createdAt: enDias(-400), autorId: usuarios.tecnico2.id,
    });
    e = await ot(ac08.id, e, "BAJA", {}, {
      descripcion: "Baja definitiva por daños irreparables tras descarga atmosférica",
      fechaIntervencion: enDias(-180), createdAt: enDias(-180), autorId: usuarios.admin.id,
    });
    await prisma.activo.update({ where: { id: ac08.id }, data: e });
  }

  // Solo INSTAL, EN_SERVICIO
  const ac09 = await crearActivoConInstalacion({
    codigo: "C-NORTE-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "ABB", modelo: "BC-220", numeroSerie: "SN-V2-009",
    subestacionId: subs.norte.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.operario1.id);

  // ── SE-LEVANTE-132 ──────────────────────────────────────────────────────────

  // RICH, VENCIDA (ene-2026): override enDias(-151)
  const ac10 = await crearActivoConInstalacion({
    codigo: "T-LEVANTE-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Hitachi", modelo: "TR-132-30", numeroSerie: "SN-V2-010",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -200,
    fechaProximaInspeccionOverride: enDias(-151),
  }, usuarios.tecnico1.id);
  // INSP(NO_CONFORME) → CORR(OPERATIVO) → EN_SERVICIO (fecha sigue siendo override)
  {
    let e = INI;
    e = await ot(ac10.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección semestral: fuga de aceite en pasatapas — equipo pasa a avería",
      fechaIntervencion: enDias(-165), createdAt: enDias(-165), autorId: usuarios.tecnico2.id,
    });
    e = await ot(ac10.id, e, "CORRECTIVO", { resultadoIntervencion: "OPERATIVO" }, {
      descripcion: "Sustitución de pasatapas y reposición de aceite dieléctrico: equipo repuesto a servicio",
      fechaIntervencion: enDias(-120), createdAt: enDias(-120), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac10.id }, data: e });
  }

  // Solo INSTAL, EN_SERVICIO
  const ac11 = await crearActivoConInstalacion({
    codigo: "T-LEVANTE-02", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Schneider", modelo: "TR-132-40", numeroSerie: "SN-V2-011",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -80,
  }, usuarios.tecnico2.id);

  const ac12 = await crearActivoConInstalacion({
    codigo: "QA-LEVANTE-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "ABB", modelo: "SF6-132", numeroSerie: "SN-V2-012",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.tecnico2.id);
  // MEDIUM: INSP(NO_CONFORME) → AVERIADO
  {
    let e = INI;
    e = await ot(ac12.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección rutinaria: fallo en mecanismo de disparo — equipo pasa a avería",
      fechaIntervencion: enDias(-45), createdAt: enDias(-45), autorId: usuarios.operario2.id,
    });
    await prisma.activo.update({ where: { id: ac12.id }, data: e });
  }

  const ac13 = await crearActivoConInstalacion({
    codigo: "QB-LEVANTE-01", tipo: "SECCIONADOR",
    fabricante: "Siemens", modelo: "SC-132", numeroSerie: "SN-V2-013",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -60,
  }, usuarios.tecnico1.id);
  // MEDIUM: INSP(CONFORME) → EN_SERVICIO, fecha actualizada
  {
    let e = INI;
    e = await ot(ac13.id, e, "INSPECCION", { resultadoInspeccion: "CONFORME" }, {
      descripcion: "Inspección trimestral: engrase de mecanismo y apriete de contactos conformes",
      fechaIntervencion: enDias(-7), createdAt: enDias(-7), autorId: usuarios.operario1.id,
    });
    await prisma.activo.update({
      where: { id: ac13.id },
      data: { ...e, fechaProximaInspeccion: calcularProximaInspeccion(enDias(-7), "SECCIONADOR") },
    });
  }

  const ac14 = await crearActivoConInstalacion({
    codigo: "F-LEVANTE-01", tipo: "PARARRAYOS",
    fabricante: "ABB", modelo: "PR-132", numeroSerie: "SN-V2-014",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -200,
  }, usuarios.tecnico2.id);
  // RICH: INSP(NO_CONFORME) → CORR(OPERATIVO) → EN_SERVICIO
  {
    let e = INI;
    e = await ot(ac14.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección post-tormenta: fractura en aislador de descargador — equipo averiado",
      fechaIntervencion: enDias(-130), createdAt: enDias(-130), autorId: usuarios.tecnico2.id,
    });
    e = await ot(ac14.id, e, "CORRECTIVO", { resultadoIntervencion: "OPERATIVO" }, {
      descripcion: "Sustitución de aislador fracturado y revisión de conexiones: equipo operativo",
      fechaIntervencion: enDias(-85), createdAt: enDias(-85), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac14.id }, data: e });
  }

  const ac15 = await crearActivoConInstalacion({
    codigo: "TT-LEVANTE-01", tipo: "TRANSFORMADOR_MEDIDA",
    fabricante: "Arteche", modelo: "TM-132-OLD", numeroSerie: "SN-V2-015",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -400,
  }, usuarios.admin.id);
  // MEDIUM: BAJA → DADO_DE_BAJA
  {
    let e = INI;
    e = await ot(ac15.id, e, "BAJA", {}, {
      descripcion: "Baja por fin de vida útil: sustituido por modelo de mayor precisión de medida",
      fechaIntervencion: enDias(-300), createdAt: enDias(-300), autorId: usuarios.admin.id,
    });
    await prisma.activo.update({ where: { id: ac15.id }, data: e });
  }

  const ac16 = await crearActivoConInstalacion({
    codigo: "C-LEVANTE-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "ABB", modelo: "BC-132", numeroSerie: "SN-V2-016",
    subestacionId: subs.levante.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.tecnico2.id);
  // MEDIUM: INSP(CONFORME) → EN_SERVICIO, fecha actualizada
  {
    let e = INI;
    e = await ot(ac16.id, e, "INSPECCION", { resultadoInspeccion: "CONFORME" }, {
      descripcion: "Inspección semestral: capacidad y factor de pérdidas dentro de tolerancias",
      fechaIntervencion: enDias(-10), createdAt: enDias(-10), autorId: usuarios.operario2.id,
    });
    await prisma.activo.update({
      where: { id: ac16.id },
      data: { ...e, fechaProximaInspeccion: calcularProximaInspeccion(enDias(-10), "BATERIA_CONDENSADORES") },
    });
  }

  // ── SE-COSTA-66 ─────────────────────────────────────────────────────────────

  // Solo INSTAL, VENCIDA (feb-2026): override enDias(-124)
  const ac17 = await crearActivoConInstalacion({
    codigo: "T-COSTA-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Siemens", modelo: "TR-66-20", numeroSerie: "SN-V2-017",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -200,
    fechaProximaInspeccionOverride: enDias(-124),
  }, usuarios.tecnico1.id);

  const ac18 = await crearActivoConInstalacion({
    codigo: "QA-COSTA-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "Hitachi", modelo: "SF6-66", numeroSerie: "SN-V2-018",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -150,
  }, usuarios.tecnico1.id);
  // RICH: INSP(NO_CONFORME) → CORR(EN_DESCARGO) → FUERA_DE_SERVICIO
  {
    let e = INI;
    e = await ot(ac18.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección anual: desgaste severo de contactos principales — equipo pasa a avería",
      fechaIntervencion: enDias(-100), createdAt: enDias(-100), autorId: usuarios.tecnico2.id,
    });
    e = await ot(ac18.id, e, "CORRECTIVO", { resultadoIntervencion: "EN_DESCARGO" }, {
      descripcion: "Sustitución parcial de contactos: en descargo pendiente de ajuste final y pruebas",
      fechaIntervencion: enDias(-55), createdAt: enDias(-55), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac18.id }, data: e });
  }

  const ac19 = await crearActivoConInstalacion({
    codigo: "QB-COSTA-01", tipo: "SECCIONADOR",
    fabricante: "Schneider", modelo: "SC-66", numeroSerie: "SN-V2-019",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -85,
  }, usuarios.tecnico2.id);
  // MEDIUM: PREV(OPERATIVO) → EN_SERVICIO
  {
    let e = INI;
    e = await ot(ac19.id, e, "PREVENTIVO", { resultadoIntervencion: "OPERATIVO" }, {
      descripcion: "Preventivo trimestral: engrase y ajuste de mecanismo de maniobra — equipo operativo",
      fechaIntervencion: enDias(-30), createdAt: enDias(-30), autorId: usuarios.operario1.id,
    });
    await prisma.activo.update({ where: { id: ac19.id }, data: e });
  }

  // Solo INSTAL, VENCIDA (may-2026): override enDias(-16)
  const ac20 = await crearActivoConInstalacion({
    codigo: "F-COSTA-01", tipo: "PARARRAYOS",
    fabricante: "Siemens", modelo: "PR-66", numeroSerie: "SN-V2-020",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -400,
    fechaProximaInspeccionOverride: enDias(-16),
  }, usuarios.tecnico2.id);

  const ac21 = await crearActivoConInstalacion({
    codigo: "TT-COSTA-01", tipo: "TRANSFORMADOR_MEDIDA",
    fabricante: "Arteche", modelo: "TM-66", numeroSerie: "SN-V2-021",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.tecnico1.id);

  const ac22 = await crearActivoConInstalacion({
    codigo: "C-COSTA-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "ABB", modelo: "BC-66", numeroSerie: "SN-V2-022",
    subestacionId: subs.costa.id, diasDesdePuestaEnServicio: -60,
  }, usuarios.operario2.id);

  // ── SE-SUR-132 ──────────────────────────────────────────────────────────────

  // Solo INSTAL, VENCIDA (abr-2026): override enDias(-70)
  const ac23 = await crearActivoConInstalacion({
    codigo: "T-SUR-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "ABB", modelo: "TR-132-25", numeroSerie: "SN-V2-023",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -200,
    fechaProximaInspeccionOverride: enDias(-70),
  }, usuarios.tecnico1.id);

  const ac24 = await crearActivoConInstalacion({
    codigo: "T-SUR-02", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Siemens", modelo: "TR-132-35", numeroSerie: "SN-V2-024",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -350,
  }, usuarios.tecnico2.id);
  // MEDIUM: BAJA → DADO_DE_BAJA
  {
    let e = INI;
    e = await ot(ac24.id, e, "BAJA", {}, {
      descripcion: "Baja por sustitución: nuevo transformador de mayor capacidad instalado en su posición",
      fechaIntervencion: enDias(-250), createdAt: enDias(-250), autorId: usuarios.admin.id,
    });
    await prisma.activo.update({ where: { id: ac24.id }, data: e });
  }

  const ac25 = await crearActivoConInstalacion({
    codigo: "QA-SUR-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "Schneider", modelo: "SF6-132-G2", numeroSerie: "SN-V2-025",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -150,
  }, usuarios.tecnico1.id);

  const ac26 = await crearActivoConInstalacion({
    codigo: "QB-SUR-01", tipo: "SECCIONADOR",
    fabricante: "Hitachi", modelo: "SC-132", numeroSerie: "SN-V2-026",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -85,
  }, usuarios.tecnico2.id);
  // MEDIUM: INSP(NO_CONFORME) → AVERIADO
  {
    let e = INI;
    e = await ot(ac26.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección rutinaria: deformación en cuchilla principal — equipo pasa a avería",
      fechaIntervencion: enDias(-50), createdAt: enDias(-50), autorId: usuarios.operario2.id,
    });
    await prisma.activo.update({ where: { id: ac26.id }, data: e });
  }

  const ac27 = await crearActivoConInstalacion({
    codigo: "F-SUR-01", tipo: "PARARRAYOS",
    fabricante: "ABB", modelo: "PR-132-B", numeroSerie: "SN-V2-027",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -200,
  }, usuarios.tecnico1.id);

  const ac28 = await crearActivoConInstalacion({
    codigo: "C-SUR-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "Schneider", modelo: "BC-132", numeroSerie: "SN-V2-028",
    subestacionId: subs.sur.id, diasDesdePuestaEnServicio: -90,
  }, usuarios.operario1.id);

  // ── SE-CENTRO-66 ────────────────────────────────────────────────────────────

  // Solo INSTAL, VENCIDA (may-2026): override enDias(-40)
  const ac29 = await crearActivoConInstalacion({
    codigo: "T-CENTRO-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "Hitachi", modelo: "TR-66-15", numeroSerie: "SN-V2-029",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -200,
    fechaProximaInspeccionOverride: enDias(-40),
  }, usuarios.tecnico2.id);

  const ac30 = await crearActivoConInstalacion({
    codigo: "QA-CENTRO-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "ABB", modelo: "SF6-66-B", numeroSerie: "SN-V2-030",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.tecnico1.id);

  const ac31 = await crearActivoConInstalacion({
    codigo: "QB-CENTRO-01", tipo: "SECCIONADOR",
    fabricante: "Schneider", modelo: "SC-66-B", numeroSerie: "SN-V2-031",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -45,
  }, usuarios.tecnico2.id);

  const ac32 = await crearActivoConInstalacion({
    codigo: "F-CENTRO-01", tipo: "PARARRAYOS",
    fabricante: "Siemens", modelo: "PR-66-B", numeroSerie: "SN-V2-032",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -200,
  }, usuarios.tecnico1.id);
  // MEDIUM: INSP(NO_CONFORME) → AVERIADO
  {
    let e = INI;
    e = await ot(ac32.id, e, "INSPECCION", { resultadoInspeccion: "NO_CONFORME" }, {
      descripcion: "Inspección anual: grietas en elemento varistor — equipo pasa a avería, pendiente sustitución",
      fechaIntervencion: enDias(-40), createdAt: enDias(-40), autorId: usuarios.tecnico2.id,
    });
    await prisma.activo.update({ where: { id: ac32.id }, data: e });
  }

  const ac33 = await crearActivoConInstalacion({
    codigo: "TT-CENTRO-01", tipo: "TRANSFORMADOR_MEDIDA",
    fabricante: "Arteche", modelo: "TM-66-B", numeroSerie: "SN-V2-033",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -150,
  }, usuarios.operario1.id);

  const ac34 = await crearActivoConInstalacion({
    codigo: "C-CENTRO-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "ABB", modelo: "BC-66-B", numeroSerie: "SN-V2-034",
    subestacionId: subs.centro.id, diasDesdePuestaEnServicio: -150,
  }, usuarios.tecnico2.id);
  // MEDIUM: PREV(EN_DESCARGO) → FUERA_DE_SERVICIO
  {
    let e = INI;
    e = await ot(ac34.id, e, "PREVENTIVO", { resultadoIntervencion: "EN_DESCARGO" }, {
      descripcion: "Preventivo semestral: condensadores con deriva de capacidad — consignado para revisión en taller",
      fechaIntervencion: enDias(-20), createdAt: enDias(-20), autorId: usuarios.tecnico1.id,
    });
    await prisma.activo.update({ where: { id: ac34.id }, data: e });
  }

  // ── SE-NOROESTE-45 ──────────────────────────────────────────────────────────

  const ac35 = await crearActivoConInstalacion({
    codigo: "T-NOROESTE-01", tipo: "TRANSFORMADOR_POTENCIA",
    fabricante: "ABB", modelo: "TR-45-10", numeroSerie: "SN-V2-035",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -90,
  }, usuarios.tecnico1.id);

  // Solo INSTAL, VENCIDA (jun-2026): override enDias(-9)
  const ac36 = await crearActivoConInstalacion({
    codigo: "QA-NOROESTE-01", tipo: "INTERRUPTOR_AUTOMATICO",
    fabricante: "Schneider", modelo: "SF6-45", numeroSerie: "SN-V2-036",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -400,
    fechaProximaInspeccionOverride: enDias(-9),
  }, usuarios.tecnico2.id);

  const ac37 = await crearActivoConInstalacion({
    codigo: "QB-NOROESTE-01", tipo: "SECCIONADOR",
    fabricante: "Hitachi", modelo: "SC-45", numeroSerie: "SN-V2-037",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -300,
  }, usuarios.admin.id);
  // MEDIUM: BAJA → DADO_DE_BAJA
  {
    let e = INI;
    e = await ot(ac37.id, e, "BAJA", {}, {
      descripcion: "Baja por corrosión severa: equipo retirado y desguazado",
      fechaIntervencion: enDias(-200), createdAt: enDias(-200), autorId: usuarios.admin.id,
    });
    await prisma.activo.update({ where: { id: ac37.id }, data: e });
  }

  const ac38 = await crearActivoConInstalacion({
    codigo: "F-NOROESTE-01", tipo: "PARARRAYOS",
    fabricante: "Siemens", modelo: "PR-45", numeroSerie: "SN-V2-038",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -200,
  }, usuarios.operario2.id);

  const ac39 = await crearActivoConInstalacion({
    codigo: "TT-NOROESTE-01", tipo: "TRANSFORMADOR_MEDIDA",
    fabricante: "Arteche", modelo: "TM-45", numeroSerie: "SN-V2-039",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -100,
  }, usuarios.operario1.id);

  const ac40 = await crearActivoConInstalacion({
    codigo: "C-NOROESTE-01", tipo: "BATERIA_CONDENSADORES",
    fabricante: "Schneider", modelo: "BC-45", numeroSerie: "SN-V2-040",
    subestacionId: subs.noroeste.id, diasDesdePuestaEnServicio: -70,
  }, usuarios.tecnico1.id);

  return {
    ac01, ac02, ac03, ac04, ac05, ac06, ac07, ac08, ac09, ac10,
    ac11, ac12, ac13, ac14, ac15, ac16, ac17, ac18, ac19, ac20,
    ac21, ac22, ac23, ac24, ac25, ac26, ac27, ac28, ac29, ac30,
    ac31, ac32, ac33, ac34, ac35, ac36, ac37, ac38, ac39, ac40,
  };
}

async function asociarEtiquetas(activos, etiquetas) {
  // Transformadores principales Norte: críticos para la red.
  await prisma.activo.update({
    where: { id: activos.ac01.id },
    data: { etiquetas: { connect: [{ id: etiquetas.critico.id }] } },
  });
  // T-NORTE-02: instalación reciente (-150d), cubre garantía + crítico.
  await prisma.activo.update({
    where: { id: activos.ac02.id },
    data: { etiquetas: { connect: [{ id: etiquetas.critico.id }, { id: etiquetas.garantia.id }] } },
  });
  // T-NORTE-03: avería activa en transformador crítico.
  await prisma.activo.update({
    where: { id: activos.ac03.id },
    data: { etiquetas: { connect: [{ id: etiquetas.critico.id }] } },
  });
  // F-NORTE-01: pararrayos Norte — revisión post-tormenta pendiente.
  await prisma.activo.update({
    where: { id: activos.ac07.id },
    data: { etiquetas: { connect: [{ id: etiquetas.postTormenta.id }] } },
  });
  // F-LEVANTE-01: ya reparado tras tormenta, etiqueta para seguimiento.
  await prisma.activo.update({
    where: { id: activos.ac14.id },
    data: { etiquetas: { connect: [{ id: etiquetas.postTormenta.id }] } },
  });
  // QA-COSTA-01: FUERA_DE_SERVICIO, candidato a baja si las pruebas fallan.
  await prisma.activo.update({
    where: { id: activos.ac18.id },
    data: { etiquetas: { connect: [{ id: etiquetas.pendienteBaja.id }] } },
  });
}

async function main() {
  console.log("🧹 Limpiando base de datos...");
  await limpiar();

  console.log("👥 Creando usuarios...");
  const usuarios = await crearUsuarios();

  console.log("🏭 Creando subestaciones...");
  const subs = await crearSubestaciones();

  console.log("🏷️  Creando etiquetas...");
  const etiquetas = await crearEtiquetas();

  console.log("⚡ Creando 40 activos con historiales derivados de aplicarTransicion()...");
  const activos = await crearActivos(usuarios, subs);

  console.log("🔗 Asociando etiquetas a activos...");
  await asociarEtiquetas(activos, etiquetas);

  const [nUsuarios, nSubs, nSubsActivas, nActivos, nEtiquetas, nOTs] = await Promise.all([
    prisma.usuario.count(),
    prisma.subestacion.count(),
    prisma.subestacion.count({ where: { activa: true } }),
    prisma.activo.count(),
    prisma.etiqueta.count(),
    prisma.ordenTrabajo.count(),
  ]);

  console.log("");
  console.log("✅ Seed V2 completado");
  console.log(`   ${nUsuarios} usuarios | ${nSubs} subestaciones (${nSubsActivas} activas) | ${nActivos} activos | ${nEtiquetas} etiquetas | ${nOTs} órdenes de trabajo`);
  console.log("");
  console.log("👤 Credenciales de prueba:");
  console.log("   ADMIN:    admin@gmao.com / admin123");
  console.log("   TECNICO:  tecnico@gmao.com / tecnico123");
  console.log("   TECNICO:  tecnico2@gmao.com / tecnico123");
  console.log("   OPERARIO: operario@gmao.com / operario123");
  console.log("   OPERARIO: operario2@gmao.com / operario123");
}

main()
  .catch((err) => {
    console.error("❌ Error en el seed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
