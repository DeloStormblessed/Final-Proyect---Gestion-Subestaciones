# Uso de IA en el proyecto

Este documento cubre las dos caras del uso de IA en el proyecto: la **IA como producto**
(el agente que el usuario final usa en la aplicación) y la **IA como herramienta de
desarrollo** (cómo se construyó el proyecto con asistencia de IA).

---

## 1. La IA en el producto

### Arquitectura del agente

El asistente es un **agente ReAct construido con LangGraph** servido por un microservicio
FastAPI (`ia-service/`), separado del backend de dominio (Node). El modelo es
`llama-3.3-70b-versatile` servido por **Groq**.

Decisión central de arquitectura: el agente **no accede a Postgres** para datos de
dominio. Sus tools llaman a la **API de Node reenviando el JWT del usuario que pregunta**.
Consecuencia: el agente responde con los permisos de ese usuario, no con los de la
máquina — la autorización del dominio vive en un único sitio (Node) y el agente no puede
saltársela. El JWT lo emite Node en el login (HS256) y FastAPI lo valida con el mismo
secreto: un solo sistema de auth para los dos backends.

### Las 6 tools

| Tool | Qué hace |
| --- | --- |
| `listar_subestaciones` | Lista las subestaciones del usuario |
| `listar_activos` | Filtra por ciclo de vida, disponibilidad, tipo, subestación, inspección vencida; modo `solo_contar` |
| `detalle_activo` | Ficha + historial de OTs por código o ID |
| `listar_ordenes_trabajo` | Filtra por tipo, activo y rango de fechas; modo `solo_contar` |
| `dashboard_kpis` | KPIs agregados del dashboard |
| `buscar_normativa` | Búsqueda semántica en la normativa indexada (RAG) |

### RAG con citación de fuentes

- **Corpus**: 7 documentos de normativa redactados para el dominio
  (`ia-service/docs/normativa/`): UNE-EN 13306, IEC 81346-2, ITC-RAT 23 (RD 337/2014),
  RD 614/2001, UNE-EN 60099-5, serie IEC 60076 y el procedimiento interno PM-01, cuyos
  intervalos de inspección coinciden con los que aplica el backend.
- **Indexación** (`ia-service/scripts/indexar_normativa.py`): troceado por encabezados
  markdown conservando el título de sección en el chunk (mejora medible del retrieval),
  embeddings multilingües locales con **fastembed** (sin API key) y persistencia en
  **ChromaDB**. La colección se hornea en el build de Docker: el contenedor arranca con
  el RAG listo, sin depender de red.
- **Citación**: cada fragmento recuperado va encabezado por su fuente
  (`[UNE-EN 13306:2018, ...]`) y el system prompt obliga a citarla en la respuesta
  (requisito del enunciado).

### Memoria conversacional

El historial persiste **en el servidor** (checkpointer de LangGraph sobre Postgres),
keyed por `conversation_id`. El frontend genera un id por sesión
(`{userId}-{uuid}`) y lo reenvía en cada turno: restaurar el id (p. ej. tras un F5)
restaura también el contexto del agente. Al cerrar sesión, el hilo se descarta en el
cliente.

### Control de coste y robustez

- Historial **recortado a un presupuesto de tokens** por turno (`trim_messages`,
  cortando siempre en un mensaje humano para no dejar tool-calls huérfanos).
- Tools con modo `solo_contar` (preguntas de recuento sin listar filas) y resolución
  código→ID **dentro** de la tool (evita un ciclo extra de LLM).
- System prompt compacto que limita el agente al ámbito del sistema: datos del GMAO y
  normativa; lo demás se rechaza en una frase sin invocar tools.
- **Telemetría por turno** en logs: llamadas al LLM, tool invocada con argumentos y
  tokens de entrada/salida. Con ella se redujo el coste de una consulta típica de ~11.8k
  a ~2.7k tokens de entrada.
- Manejo de errores: límite de recursión y captura de `GraphRecursionError` con respuesta
  degradada (el chat nunca devuelve un 500 por un bucle del agente).

---

## 2. La IA en el desarrollo

### Herramienta y metodología

Todo el desarrollo asistido se hizo con **Claude Code** como única herramienta de IA.
El método está documentado y versionado en el propio repo:

- **`CLAUDE.md` como constitución**: reglas duras no negociables (inmutabilidad de las
  OTs, dos servicios separados, soft delete, ESM+Vitest…), convenciones (dominio en
  español, comentarios que explican el porqué) y el fuera-de-alcance explícito. La IA
  trabaja dentro de ese marco y debe señalar — no resolver en silencio — cualquier
  conflicto con una decisión cerrada.
- **Plan antes de código**: cada pieza no trivial se propone como plan, se discute y se
  aprueba antes de tocar ficheros. Construcción por bloques cerrados, uno por sesión.
- **Tests como criterio de aceptación**: el backend mantiene 170 tests; ninguna pieza se
  da por terminada sin la suite en verde. Durante el rediseño V2 la regla fue explícita:
  reescribir la suite de transiciones ERA la tarea; cualquier otro rojo era señal de
  propagación inesperada y obligaba a parar.

### Qué decidió el humano y qué generó la IA

| Decisión / trabajo | Autor |
| --- | --- |
| Arquitectura (dos servicios, JWT compartido, agente vía API) | Humano |
| Modelo de dominio y máquina de estados de dos ejes (V2) | Humano (diseño), IA (implementación) |
| Reglas de negocio y alcance (qué NO construir) | Humano |
| Implementación, suites de tests, refactors, frontend | IA, con revisión línea a línea |
| Redacción del corpus de normativa para el RAG | IA, contrastada con las fuentes reales |

La convención del repo lo resume: **cada línea debe ser defendible** — los comentarios
explican el porqué de las decisiones no obvias precisamente para que el código generado
sea explicable por su autor humano.

### Un ejemplo concreto de iteración

El refactor del servicio IA es representativo del flujo de trabajo. Síntoma: el agente
gastaba ~11.8k tokens por consulta y, tras varios cambios, dejó de responder sobre la
base de datos. Con la telemetría de tokens se diagnosticó la cadena real de causas: las
tools leían campos del modelo V1 (`estado`) cuando la API ya devolvía V2
(`cicloVida`/`disponibilidad`); el recorte de historial recibía el state completo de
LangGraph donde esperaba una lista de mensajes; y el recorte podía partir un par
tool-call/tool-result, que Groq rechaza. Cada hipótesis se verificó contra logs antes de
tocar código, cada arreglo se propuso como plan, y el resultado (V2 en las tools,
`trim_messages` con `start_on="human"`, presupuesto de historial reducido) quedó
comentado en el código con su porqué.
