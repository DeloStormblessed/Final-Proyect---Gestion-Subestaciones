"""
Tools de dominio: consultan la API de Node reenviando el JWT del usuario.
El JWT viaja en RunnableConfig (configurable["jwt_token"]) para no exponerlo
en los argumentos del tool, que el LLM podría manipular.

Diseño orientado a ahorrar tokens (los docstrings son los schemas que el LLM
recibe en CADA llamada, igual que el system prompt):
- El mapeo lenguaje→filtros derivado del schema Prisma vive AQUÍ, pegado al
  argumento que afecta, no duplicado en el prompt.
- Resoluciones código→id se hacen con llamadas HTTP internas: una petición
  HTTP extra es gratis comparada con un ciclo extra de LLM (~1.5k tokens).
- solo_contar evita listar filas cuando la pregunta es "¿cuántos?".
- Salida tabular con cabecera única, sin repetir etiquetas en cada fila.
"""

import httpx
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from config import settings


def _headers(jwt: str) -> dict:
    return {"Authorization": f"Bearer {jwt}"}


def _get(path: str, jwt: str, params: dict | None = None) -> dict | list | str:
    """GET síncrono a la API de Node. Devuelve el body o un mensaje de error."""
    try:
        url = f"{settings.node_api_url}{path}"
        r = httpx.get(url, headers=_headers(jwt), params=params or {}, timeout=10)
        if r.status_code == 200:
            return r.json()
        return f"Error {r.status_code}: {r.text[:200]}"
    except httpx.RequestError as e:
        return f"No se pudo conectar con el backend: {e}"


def _estado_legible(a: dict) -> str:
    """
    Colapsa los dos ejes V2 en una etiqueta legible para el modelo.
    Si el activo está DADO_DE_BAJA, la disponibilidad está congelada y no
    aporta información: mostrar solo la baja evita respuestas confusas.
    """
    if a.get("cicloVida") == "DADO_DE_BAJA":
        return "DADO_DE_BAJA"
    return a.get("disponibilidad", "DESCONOCIDO")


def _desenlace_ot(ot: dict) -> str:
    """Desenlace de una OT: resultado de inspección o de intervención, o '-'."""
    return ot.get("resultado") or ot.get("resultadoIntervencion") or "-"


def _resolver_subestacion_id(codigo: str, jwt: str) -> str | None:
    """Código de subestación → id interno (el API filtra por subestacionId)."""
    res = _get("/subestaciones", jwt, {"limite": 50})
    if isinstance(res, str):
        return None
    for s in res.get("datos", []):
        if s.get("codigo", "").upper() == codigo.upper():
            return s.get("id")
    return None


def _resolver_activo_id(codigo_o_id: str, jwt: str) -> str | None:
    """Código de activo → id interno (busqueda textual del API sobre codigo)."""
    res = _get("/activos", jwt, {"busqueda": codigo_o_id, "limite": 1})
    if isinstance(res, str):
        return None
    datos = res.get("datos", [])
    return datos[0].get("id") if datos else None


@tool
def listar_subestaciones(config: RunnableConfig = None) -> str:
    """
    Lista las subestaciones del sistema: código, nombre, ubicación, tensión
    nominal (kV) y si están activas. Usar SIEMPRE esta herramienta para
    preguntas sobre subestaciones (no deducirlas desde los activos).
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    resultado = _get("/subestaciones", jwt, {"limite": 50})
    if isinstance(resultado, str):
        return resultado

    datos = resultado.get("datos", [])
    if not datos:
        return "No hay subestaciones registradas en el sistema."

    pag = resultado.get("paginacion", {})
    lineas = [
        f"Total: {pag.get('total', len(datos))} subestaciones.",
        "codigo | nombre | ubicacion | tension | estado",
    ]
    for s in datos:
        estado = "activa" if s.get("activa") else "inactiva"
        lineas.append(
            f"{s.get('codigo', '?')} | {s.get('nombre', '')} | {s.get('ubicacion', '')} | "
            f"{s.get('tensionNominal', '?')} kV | {estado}"
        )
    return "\n".join(lineas)


@tool
def listar_activos(
    ciclo_vida: str = "",
    disponibilidad: str = "",
    tipo: str = "",
    subestacion: str = "",
    inspeccion_vencida: bool = False,
    solo_contar: bool = False,
    limite: int = 10,
    config: RunnableConfig = None,
) -> str:
    """
    Lista o cuenta los activos del sistema. Filtros (todos opcionales):
    - ciclo_vida: OPERATIVO | DADO_DE_BAJA. "Dados de baja" es ciclo_vida,
      NO una disponibilidad.
    - disponibilidad: EN_SERVICIO | AVERIADO | FUERA_DE_SERVICIO. "Averiado" →
      AVERIADO; "en descargo" o "fuera de servicio" → FUERA_DE_SERVICIO.
    - tipo: TRANSFORMADOR_POTENCIA | INTERRUPTOR_AUTOMATICO | SECCIONADOR |
      PARARRAYOS | TRANSFORMADOR_MEDIDA | BATERIA_CONDENSADORES
    - subestacion: código de subestación (ej: SE-NORTE-220) para ver solo sus activos.
    - inspeccion_vencida: true → solo activos con la inspección vencida/atrasada.
    - solo_contar: true → devuelve SOLO el total, sin filas (para "¿cuántos…?").
    - limite: filas a devolver (defecto 10, máximo 50).
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    params = {"limite": 1 if solo_contar else min(limite, 50)}
    if ciclo_vida:
        params["cicloVida"] = ciclo_vida
    if disponibilidad:
        params["disponibilidad"] = disponibilidad
    if tipo:
        params["tipo"] = tipo
    if inspeccion_vencida:
        params["inspeccionVencida"] = "true"
    if subestacion:
        sub_id = _resolver_subestacion_id(subestacion, jwt)
        if not sub_id:
            return f"No existe ninguna subestación con código '{subestacion}'."
        params["subestacionId"] = sub_id

    resultado = _get("/activos", jwt, params)
    if isinstance(resultado, str):
        return resultado

    datos = resultado.get("datos", [])
    total = resultado.get("paginacion", {}).get("total", len(datos))

    if solo_contar:
        return f"Total: {total} activos con esos filtros."
    if not datos:
        return "No se encontraron activos con esos filtros."

    lineas = [
        f"Total: {total} activos.",
        "codigo | tipo | estado | proxima_inspeccion | subestacion",
    ]
    for a in datos:
        insp = str(a.get("fechaProximaInspeccion", ""))[:10]
        sub = a.get("subestacion", {}).get("codigo", "")
        lineas.append(
            f"{a.get('codigo', '?')} | {a.get('tipo', '?')} | {_estado_legible(a)} | "
            f"{insp} | {sub}"
        )
    return "\n".join(lineas)


@tool
def detalle_activo(codigo_o_id: str, config: RunnableConfig = None) -> str:
    """
    Detalle completo de UN activo: datos técnicos, ciclo de vida, disponibilidad,
    subestación y sus últimas órdenes de trabajo.
    Acepta el código del activo (ej: T-NORTE-01) o su ID.
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")

    activo_id = _resolver_activo_id(codigo_o_id, jwt)
    if not activo_id:
        return f"No se encontró ningún activo con código o ID '{codigo_o_id}'."

    detalle = _get(f"/activos/{activo_id}", jwt)
    if isinstance(detalle, str):
        return detalle

    a = detalle
    resultado = [
        f"{a.get('codigo', '?')} — {a.get('tipo', '?')}",
        f"Fabricante: {a.get('fabricante', '')} | Modelo: {a.get('modelo', '')} | "
        f"Nº serie: {a.get('numeroSerie', '')}",
        f"Ciclo de vida: {a.get('cicloVida', '?')} | "
        f"Disponibilidad: {a.get('disponibilidad', '?')}",
        f"Subestación: {a.get('subestacion', {}).get('codigo', '')}",
        f"En servicio desde: {str(a.get('fechaPuestaEnServicio', ''))[:10]} | "
        f"Próxima inspección: {str(a.get('fechaProximaInspeccion', ''))[:10]}",
        "",
        "Últimas OTs: fecha | tipo | desenlace | descripcion",
    ]
    for ot in a.get("ordenesTrabajo", [])[:5]:
        fecha = str(ot.get("fechaIntervencion", ""))[:10]
        resultado.append(
            f"{fecha} | {ot.get('tipo', '?')} | {_desenlace_ot(ot)} | "
            f"{ot.get('descripcion', '')[:80]}"
        )

    return "\n".join(resultado)


@tool
def listar_ordenes_trabajo(
    tipo: str = "",
    activo: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    solo_contar: bool = False,
    limite: int = 10,
    config: RunnableConfig = None,
) -> str:
    """
    Lista o cuenta órdenes de trabajo (OTs), las más recientes primero.
    Filtros (todos opcionales):
    - tipo: INSPECCION | PREVENTIVO | CORRECTIVO | INSTALACION | BAJA.
      "Revisión/mantenimiento programado" → PREVENTIVO; "reparación/avería" → CORRECTIVO.
    - activo: código del activo (ej: T-NORTE-01) para ver solo sus OTs.
    - fecha_desde / fecha_hasta: rango de fecha de intervención, formato YYYY-MM-DD.
    - solo_contar: true → devuelve SOLO el total, sin filas (para "¿cuántas…?").
    - limite: filas a devolver (defecto 10, máximo 50).
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    params = {"limite": 1 if solo_contar else min(limite, 50)}
    if tipo:
        params["tipo"] = tipo
    if fecha_desde:
        params["fechaDesde"] = fecha_desde
    if fecha_hasta:
        params["fechaHasta"] = fecha_hasta
    if activo:
        activo_id = _resolver_activo_id(activo, jwt)
        if not activo_id:
            return f"No se encontró ningún activo con código '{activo}'."
        params["activoId"] = activo_id

    resultado = _get("/ordenes-trabajo", jwt, params)
    if isinstance(resultado, str):
        return resultado

    datos = resultado.get("datos", [])
    total = resultado.get("paginacion", {}).get("total", len(datos))

    if solo_contar:
        return f"Total: {total} órdenes de trabajo con esos filtros."
    if not datos:
        return "No se encontraron órdenes de trabajo con esos filtros."

    lineas = [
        f"Total: {total} órdenes de trabajo.",
        "fecha | tipo | desenlace | activo | descripcion",
    ]
    for ot in datos:
        fecha = str(ot.get("fechaIntervencion", ""))[:10]
        codigo_activo = ot.get("activo", {}).get("codigo", "?")
        lineas.append(
            f"{fecha} | {ot.get('tipo', '?')} | {_desenlace_ot(ot)} | "
            f"{codigo_activo} | {ot.get('descripcion', '')[:60]}"
        )
    return "\n".join(lineas)


@tool
def dashboard_kpis(config: RunnableConfig = None) -> str:
    """
    Resumen ejecutivo del sistema en una sola llamada: activos por estado,
    cuántos tienen la inspección vencida, OTs de los últimos 30 días por tipo
    y los activos con la inspección más atrasada. Preferir esta herramienta
    para preguntas globales o de resumen.
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    resultado = _get("/dashboard", jwt)
    if isinstance(resultado, str):
        return resultado

    d = resultado
    lineas = ["Dashboard — estado general", ""]

    estados = d.get("activosPorEstado", {})
    lineas.append("Activos por estado:")
    for estado, count in estados.items():
        lineas.append(f"  {estado}: {count}")

    lineas.append(f"\nActivos con inspección vencida: {d.get('inspeccionesVencidas', 0)}")

    ots = d.get("otsUltimos30DiasPorTipo", {})
    if ots:
        lineas.append("\nOTs últimos 30 días:")
        for tipo, count in ots.items():
            lineas.append(f"  {tipo}: {count}")

    top = d.get("topInspeccionesAtrasadas", [])
    if top:
        lineas.append("\nInspecciones más atrasadas: codigo | tipo | subestacion | vencia | dias_retraso")
        for a in top[:5]:
            insp = str(a.get("fechaProximaInspeccion", ""))[:10]
            lineas.append(
                f"  {a.get('codigo', '?')} | {a.get('tipo', '?')} | "
                f"{a.get('subestacion', {}).get('codigo', '')} | {insp} | {a.get('diasDeRetraso', '?')}"
            )

    return "\n".join(lineas)


# Lista exportable para el grafo
DOMAIN_TOOLS = [
    listar_subestaciones,
    listar_activos,
    detalle_activo,
    listar_ordenes_trabajo,
    dashboard_kpis,
]
