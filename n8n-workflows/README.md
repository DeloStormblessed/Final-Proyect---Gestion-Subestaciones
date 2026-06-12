# Workflows de n8n

## `gmao-alertas-mantenimiento.json`

Workflow de notificaciones de mantenimiento. Cubre los tres requisitos del enunciado:
workflow activo conectado a la API (webhook disparado desde Node), lógica condicional
(nodo Switch) y export JSON en el repo.

```
Node (lib/webhook.js)  ──POST──▶  Webhook GMAO  ──▶  Switch por `evento`
                                                       ├─ ot.averia_detectada ─▶ Telegram 🔴 alerta avería
                                                       └─ ot.correctivo       ─▶ Telegram 🛠️ aviso correctivo
```

El backend dispara el webhook (asíncrono, best-effort, tras el commit) cuando:
- se registra una **INSPECCION** con resultado **NO_CONFORME** → `evento: "ot.averia_detectada"`
- se registra una OT **CORRECTIVO** → `evento: "ot.correctivo"`

## Puesta en marcha (n8n Cloud + Telegram)

1. **Bot de Telegram**: habla con [@BotFather](https://t.me/BotFather) → `/newbot` →
   guarda el **token**. Abre un chat con tu bot y envíale un mensaje cualquiera.
2. **chat_id**: visita `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia
   `message.chat.id` de la respuesta.
3. **n8n Cloud**: crea el workflow importando este JSON
   (*Workflow → Import from File*).
4. **Credencial**: en n8n, *Credentials → Add → Telegram API*, pega el token y
   nómbrala `Telegram GMAO`. Asígnala a los dos nodos de Telegram si no quedó
   enlazada al importar.
5. En ambos nodos de Telegram, sustituye `PON_AQUI_TU_CHAT_ID` por tu chat_id.
6. **Activa** el workflow (toggle Active) y copia la **Production URL** del nodo
   Webhook (`https://<tu-instancia>.app.n8n.cloud/webhook/gmao-averias`).
7. En el backend Node, pon esa URL en la variable de entorno `WEBHOOK_URL`
   (`.env` en local; panel de variables en el deploy). `WEBHOOK_URL` vacía = el
   backend no notifica (modo desarrollo): no rompe nada.

## Probar sin tocar la base de datos

Simula el POST que envía Node (la Production URL solo responde con el workflow activo;
para la Test URL pulsa antes "Listen for test event" en n8n):

```bash
curl -X POST "https://<tu-instancia>.app.n8n.cloud/webhook/gmao-averias" \
  -H "Content-Type: application/json" \
  -d '{
    "evento": "ot.averia_detectada",
    "timestamp": "2026-06-12T10:00:00.000Z",
    "datos": {
      "activo": { "codigo": "T-NORTE-01", "tipo": "TRANSFORMADOR_POTENCIA",
                  "disponibilidadAnterior": "EN_SERVICIO", "disponibilidadNueva": "AVERIADO" },
      "subestacion": { "codigo": "SE-NORTE-220", "nombre": "Subestación Norte 220kV" },
      "ordenTrabajo": { "descripcion": "Fuga de aceite detectada en inspección visual" }
    }
  }'
```

Prueba end-to-end real: registra desde el frontend una inspección con resultado
NO CONFORME sobre cualquier activo → debe llegar el mensaje 🔴 al Telegram.

## Decisiones de diseño

- **n8n fuera del camino del chat** (regla del proyecto): este workflow solo recibe
  eventos de dominio de Node; el agente IA no pasa por aquí.
- **El token de Telegram NO está en este JSON**: vive como credencial dentro de n8n.
  El export solo la referencia por nombre — se puede versionar sin fugas.
- El webhook de Node es best-effort con timeout de 5s (`backend/lib/webhook.js`):
  si n8n cae, la OT se registra igual; la notificación no es parte de la transacción.
