# GMAO Subestaciones — Asistente de Mantenimiento

Aplicación fullstack para la gestión de activos de subestaciones eléctricas con un agente de IA integrado como parte central del producto. Construida como proyecto final del bootcamp sobre el Mini-GMAO de la fase 1.

---
## Enlace al despliegue

https://final-proyect-gestion-subestaciones.vercel.app/

---
## Estructura del repositorio

```
gestion-subestaciones/
├── frontend/          # React + Vite → Vercel
├── backend/           # GMAO Node (dominio, auth, OTs) → Railway
├── ia-service/        # FastAPI + LangGraph (agente IA) → Railway
├── n8n-workflows/     # Workflows exportados como JSON
├── docker-compose.yml # Postgres + Node + Python en local
└── README.md
```

---

## Arquitectura

Dos servicios de backend independientes que no se fusionan:

| Servicio | Tecnología | Responsabilidad |
| --- | --- | --- |
| `backend/` | Node + Express + Prisma | Fuente de verdad del dominio: auth, activos, OTs, subestaciones, máquina de estados, dashboard. Emite los JWT. |
| `ia-service/` | FastAPI + LangGraph | Agente IA, RAG con normativa, endpoints de chat. Valida el JWT de Node; lee el dominio vía API de Node, nunca directo a Postgres. |
| `frontend/` | React 18 + Vite + React Router v6 | CRUD contra Node; chat contra FastAPI. |

**JWT compartido**: Node firma el token en el login (`HS256`, `JWT_SECRET`). FastAPI lo valida con el mismo secreto. Un solo sistema de autenticación para los dos backends.

---

## Modelo de estado del activo — V2 (dos ejes)

El estado de un activo son **dos ejes independientes**, no un enum único:

| Eje | Valores | Notas |
| --- | --- | --- |
| `cicloVida` | `OPERATIVO` · `DADO_DE_BAJA` | La baja es terminal e irreversible. |
| `disponibilidad` | `EN_SERVICIO` · `AVERIADO` · `FUERA_DE_SERVICIO` | Solo relevante si `cicloVida = OPERATIVO`. |

Qué mueve cada tipo de OT:

| Tipo OT | Mueve | Resultado requerido |
| --- | --- | --- |
| `INSTALACION` | Crea el activo en OPERATIVO / EN_SERVICIO (atómico) | — |
| `INSPECCION` | Solo `disponibilidad` | `CONFORME` · `NO_CONFORME` |
| `PREVENTIVO` | Solo `disponibilidad` | `OPERATIVO` · `DEFECTUOSO` · `EN_DESCARGO` |
| `CORRECTIVO` | Solo `disponibilidad` | `OPERATIVO` · `DEFECTUOSO` · `EN_DESCARGO` |
| `BAJA` | `cicloVida` → DADO_DE_BAJA (terminal) | — |

Reglas de rechazo (422): OT sobre activo `DADO_DE_BAJA`; `PREVENTIVO` sobre activo `AVERIADO`.

La máquina de estados pura vive en `backend/lib/transiciones.js`. El frontend recompone los dos ejes en un único estado visual con `derivarEstado()` (`frontend/src/lib/estadoVisual.js`).

---

## Funcionalidades

| Página | Ruta | Acceso |
| --- | --- | --- |
| Login | `/login` | Público |
| Registro | `/registro` | Público |
| Dashboard | `/dashboard` | Autenticado |
| Activos | `/activos` | Autenticado |
| Detalle de activo | `/activos/:id` | Autenticado |
| Órdenes de trabajo | `/ordenes-trabajo` | Autenticado |
| Asistente IA | `/chat` | Autenticado |

**Dashboard** — KPIs en tiempo real: activos por estado, inspecciones vencidas, OTs de los últimos 30 días por tipo, últimas órdenes registradas.

**Activos** — Listado con filtros (subestación, tipo de elemento, activos dados de baja). Creación y edición de activos (TECNICO/ADMIN). Código de activo como enlace directo a la ficha.

**Ficha de activo** — Cabecera con datos del equipo y estado visual derivado. Historial completo de OTs en orden cronológico inverso (solo lectura; las OTs son inmutables).

**Órdenes de trabajo** — Listado global con filtros por tipo, subestación y rango de fechas. Registro de nueva OT con selección de activo, tipo, resultado y descripción.

**Asistente IA** — Chat con agente LangGraph con memoria conversacional persistente entre turnos. El agente combina RAG sobre normativa de mantenimiento (UNE-EN 13306) y consulta en tiempo real al estado de los activos vía API de Node. Las respuestas que usan normativa citan sus fuentes.

---

## Cuentas de acceso (seed)

| Email | Contraseña | Rol | Permisos |
| --- | --- | --- | --- |
| admin@gmao.com | admin123 | ADMIN | Acceso total: activos, OTs (todos los tipos), subestaciones, usuarios |
| tecnico@gmao.com | tecnico123 | TECNICO | Activos y OTs (todos los tipos), sin gestión de usuarios ni subestaciones |
| tecnico2@gmao.com | tecnico123 | TECNICO | Igual que tecnico |
| operario@gmao.com | operario123 | OPERARIO | Solo lectura + registrar inspecciones (`INSPECCION`) |
| operario2@gmao.com | operario123 | OPERARIO | Igual que operario |

---

## Variables de entorno

### `backend/.env`
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=3000
```

### `ia-service/.env`
```
DATABASE_URL=postgresql://...   # mismo Postgres, tablas propias del agente
NODE_API_URL=http://localhost:3000
JWT_SECRET=...                  # mismo secreto que Node para validar el token
OPENAI_API_KEY=...
```

### `frontend/.env`
```
VITE_NODE_API_URL=http://localhost:3000
VITE_IA_API_URL=http://localhost:8000
```
