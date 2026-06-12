"""
Tools de dominio: consultan la API de Node reenviando el JWT del usuario.
El JWT viaja en RunnableConfig (configurable["jwt_token"]) para no exponerlo
en los argumentos del tool, que el LLM podría manipular.

V2: el estado del activo tiene dos ejes (cicloVida + disponibilidad) en lugar
del campo único `estado` de V1. Las tools leen y filtran por ambos ejes.
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
    """Formatea el resultado de una OT: inspección o intervención, según el tipo."""
    if ot.get("resultado"):
        return f" (inspección: {ot['resultado']})"
    if ot.get("resultadoIntervencion"):
        return f" (desenlace: {ot['resultadoIntervencion']})"
    return ""


@tool
def listar_activos(
    ciclo_vida: str = "",
    disponibilidad: str = "",
    tipo: str = "",
    inspeccion_vencida: bool = False,
    limite: int = 10,
    config: RunnableConfig = None,
) -> str:
    """
    Lista los activos del sistema con filtros opcionales.
    - ciclo_vida: OPERATIVO | DADO_DE_BAJA
    - disponibilidad: EN_SERVICIO | AVERIADO | FUERA_DE_SERVICIO
      (solo tiene sentido para activos OPERATIVOS)
    - tipo: TRANSFORMADOR_POTENCIA | INTERRUPTOR_AUTOMATICO | SECCIONADOR |
            PARARRAYOS | TRANSFORMADOR_MEDIDA | BATERIA_CONDENSADORES
    - inspeccion_vencida: true para ver solo activos con inspección vencida
    - limite: cuántos activos devolver (por defecto 10, máximo 50); aumentar
              solo si la pregunta requiere un análisis exhaustivo de todos los activos
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    params = {"limite": min(limite, 50)}
    if ciclo_vida:
        params["cicloVida"] = ciclo_vida
    if disponibilidad:
        params["disponibilidad"] = disponibilidad
    if tipo:
        params["tipo"] = tipo
    if inspeccion_vencida:
        params["inspeccionVencida"] = "true"

    resultado = _get("/activos", jwt, params)
    if isinstance(resultado, str):
        return resultado

    datos = resultado.get("datos", [])
    if not datos:
        return "No se encontraron activos con esos filtros."

    pag = resultado.get("paginacion", {})
    lineas = [f"Total: {pag.get('total', len(datos))} activos\n"]
    for a in datos:
        insp = str(a.get("fechaProximaInspeccion", ""))[:10]
        sub = a.get("subestacion", {}).get("codigo", "")
        lineas.append(
            f"- {a.get('codigo', '?')} | {a.get('tipo', '?')} | Estado: {_estado_legible(a)} | "
            f"Próxima inspección: {insp} | Subestación: {sub}"
        )
    return "\n".join(lineas)


@tool
def detalle_activo(codigo_o_id: str, config: RunnableConfig = None) -> str:
    """
    Devuelve el detalle completo de un activo: datos técnicos, ciclo de vida,
    disponibilidad, subestación y las últimas órdenes de trabajo.
    Acepta el código del activo (ej: SE-NORTE-T1) o su ID.
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")

    # Primero buscamos por código en el listado, luego pedimos el detalle por ID
    busqueda = _get("/activos", jwt, {"busqueda": codigo_o_id, "limite": 5})
    if isinstance(busqueda, str):
        return busqueda

    datos = busqueda.get("datos", [])
    if not datos:
        return f"No se encontró ningún activo con código o ID '{codigo_o_id}'."

    activo_id = datos[0].get("id", "")
    detalle = _get(f"/activos/{activo_id}", jwt)
    if isinstance(detalle, str):
        return detalle

    a = detalle
    resultado = [
        f"**{a.get('codigo', '?')}** — {a.get('tipo', '?')}",
        f"Fabricante: {a.get('fabricante', '')} | Modelo: {a.get('modelo', '')}",
        f"Nº serie: {a.get('numeroSerie', '')}",
        f"Ciclo de vida: {a.get('cicloVida', '?')} | Disponibilidad: {a.get('disponibilidad', '?')}",
        f"Subestación: {a.get('subestacion', {}).get('codigo', '')}",
        f"En servicio desde: {str(a.get('fechaPuestaEnServicio', ''))[:10]}",
        f"Próxima inspección: {str(a.get('fechaProximaInspeccion', ''))[:10]}",
        "",
        "Últimas órdenes de trabajo:",
    ]
    for ot in a.get("ordenesTrabajo", [])[:5]:
        fecha = str(ot.get("fechaIntervencion", ""))[:10]
        resultado.append(
            f"  • [{fecha}] {ot.get('tipo', '?')}"
            + _desenlace_ot(ot)
            + f" — {ot.get('descripcion', '')[:80]}"
        )

    return "\n".join(resultado)


@tool
def listar_ordenes_trabajo(
    tipo: str = "",
    limite: int = 20,
    config: RunnableConfig = None,
) -> str:
    """
    Lista las órdenes de trabajo del sistema, las más recientes primero.
    - tipo: INSPECCION | PREVENTIVO | CORRECTIVO | INSTALACION | BAJA
    - limite: número máximo de resultados (por defecto 20)
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    params = {"limite": min(limite, 50)}
    if tipo:
        params["tipo"] = tipo

    resultado = _get("/ordenes-trabajo", jwt, params)
    if isinstance(resultado, str):
        return resultado

    datos = resultado.get("datos", [])
    if not datos:
        return "No se encontraron órdenes de trabajo con esos filtros."

    pag = resultado.get("paginacion", {})
    lineas = [f"Total: {pag.get('total', len(datos))} órdenes de trabajo\n"]
    for ot in datos:
        fecha = str(ot.get("fechaIntervencion", ""))[:10]
        codigo_activo = ot.get("activo", {}).get("codigo", "?")
        lineas.append(
            f"- [{fecha}] {ot.get('tipo', '?')}"
            + _desenlace_ot(ot)
            + f" | Activo: {codigo_activo} | {ot.get('descripcion', '')[:60]}"
        )
    return "\n".join(lineas)


@tool
def dashboard_kpis(config: RunnableConfig = None) -> str:
    """
    Devuelve el resumen ejecutivo del sistema: conteo de activos por estado,
    activos con inspección vencida, órdenes de trabajo de los últimos 30 días
    y los activos con inspección más atrasada.
    """
    jwt = (config or {}).get("configurable", {}).get("jwt_token", "")
    resultado = _get("/dashboard", jwt)
    if isinstance(resultado, str):
        return resultado

    d = resultado
    lineas = ["**Dashboard — Estado general del sistema**", ""]

    estados = d.get("activosPorEstado", {})
    lineas.append("Activos por estado:")
    for estado, count in estados.items():
        lineas.append(f"  {estado}: {count}")

    lineas.append(f"\nActivos con inspección vencida: {d.get('inspeccionesVencidas', 0)}")

    ots = d.get("otsUltimos30DiasPorTipo", {})
    if ots:
        lineas.append("\nÓrdenes de trabajo (últimos 30 días):")
        for tipo, count in ots.items():
            lineas.append(f"  {tipo}: {count}")

    top = d.get("topInspeccionesAtrasadas", [])
    if top:
        lineas.append("\nActivos con inspección más atrasada:")
        for a in top[:5]:
            insp = str(a.get("fechaProximaInspeccion", ""))[:10]
            retraso = a.get("diasDeRetraso", "?")
            sub = a.get("subestacion", {}).get("codigo", "")
            lineas.append(
                f"  • {a.get('codigo', '?')} ({a.get('tipo', '?')}, {sub}) — "
                f"vencía: {insp}, lleva {retraso} días de retraso"
            )

    return "\n".join(lineas)


# Lista exportable para el grafo
DOMAIN_TOOLS = [listar_activos, detalle_activo, listar_ordenes_trabajo, dashboard_kpis]
