# Implementación Desk — Panel de sesiones CS

Repositorio de trabajo para el **Panel de sesiones CS** del portal Yurest. Aquí se
itera el panel con su **backend Node.js en local**; los cambios se copian luego al
proyecto principal ([Alexak98/Yurest](https://github.com/Alexak98/Yurest)), donde el
backend corre sobre **n8n**.

## Qué es el panel

Herramienta interna de Customer Success / Implementación con 3 vistas:

- **Panel de sesión** — carga las sesiones del implementador (Google Calendar),
  lee las notas de Gemini (Google Drive/Docs), genera un resumen de email con IA
  y lo guarda en Asana.
- **Vista cliente** — histórico de sesiones de un cliente (asistencia, duración,
  resúmenes, agendadas esta semana).
- **Dashboard** — proyectos activos del implementador con sesiones pendientes y
  agendadas.

## Backend: Node en local, n8n en producción

El front **detecta el entorno automáticamente** (en `panel-sesiones.html`):

| Entorno | Backend | Cómo enruta `/api/*` |
|---|---|---|
| **Local** (servido por `server.js`) | **Node.js** (este repo) | directo, mismo origen |
| **Producción** (`portal.yurest.es`) | **n8n** (webhooks) | reescrito a `WEBHOOK_BASE + /panel/...` |

> Trabajas en local **con Node como siempre**. Cuando el equipo de Yurest copia el
> archivo al portal, funciona contra **n8n sin tocar nada**. Tus mejoras de lógica
> se replican luego en los workflows de n8n.

## El archivo a trabajar

**`panel-sesiones.html`** es el front completo del panel (HTML + CSS + JS). Es lo
que se edita y lo que se copia de vuelta a Yurest.

El **backend Node** está en **`server.js`** (Express): expone los endpoints `/api/*`
y, además, sirve los ficheros estáticos del panel. Si cambias su lógica, el equipo
de Yurest la aplicará a los workflows de n8n.

Dependencias del portal (copiadas para que la página renderice; **no editar**):
`config.js`, `sidebar.js`, `theme.js`, `style.css`, `fonts.css`, `fonts/`,
`favicon.svg`, `login.html`.

## Puesta en marcha (local, Node)

```bash
npm install
cp .env.example .env                          # rellena ANTHROPIC_API_KEY, ASANA_TOKEN…
cp credentials.json.example credentials.json  # client_id/secret de Google OAuth
node server.js                                 # http://localhost:3000
```

Abre **`http://localhost:3000/panel-sesiones.html`** (el propio `server.js` lo sirve,
así `/api/*` va a Node en el mismo origen).

La primera vez, visita `http://localhost:3000/auth` para autorizar Google
(Calendar/Drive/Docs) y generar `token.json`.

### Sesión (la página exige login del portal)

`panel-sesiones.html` es una página del portal y pide sesión. Para previsualizar
rápido sin login, pega esto en la consola del navegador y recarga:

```js
localStorage.setItem('yurest_auth', JSON.stringify({v:2, ts:Date.now(), rol:'admin', nombre:'QA', user:'qa'}));
['sinasignar','a3','proformas'].forEach(k => sessionStorage.setItem('yurest_badge_v1_'+k, JSON.stringify({ts:Date.now(), value:0})));
```

(Para probar en local contra el n8n de producción en vez de Node:
`localStorage.setItem('panel_backend','n8n')`.)

## Backend n8n (referencia)

Las definiciones de los workflows que replican `server.js` en producción están en
`database/n8n-workflows/` (se importan en n8n; no se ejecutan desde aquí):

- `52-panel-sesiones-cs.json` — recent-sessions, notes, projects, tasks,
  summarize, asana-task.
- `53-panel-dashboards.json` — dashboard-general, cliente.

## Flujo de cambios

1. Trabaja sobre `panel-sesiones.html` (y `server.js` si cambia la lógica de backend).
2. El equipo de Yurest copia `panel-sesiones.html` de vuelta al portal y, si tocaste
   `server.js`, replica esos cambios en los workflows de n8n.

No commitees secretos: `.env`, `credentials.json`, `token*.json` están en `.gitignore`.
