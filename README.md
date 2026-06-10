# Implementación Desk — Panel de sesiones CS

Repositorio de trabajo para el **Panel de sesiones CS** del portal Yurest. Aquí se
itera el panel de forma aislada; los cambios se copian luego al proyecto principal
([Alexak98/Yurest](https://github.com/Alexak98/Yurest)).

## Qué es el panel

Herramienta interna de Customer Success / Implementación con 3 vistas:

- **Panel de sesión** — carga las sesiones del implementador (Google Calendar),
  lee las notas de Gemini (Google Drive), genera un resumen de email con IA
  (OpenAI) y lo guarda en Asana.
- **Vista cliente** — histórico de sesiones de un cliente (asistencia, duración,
  resúmenes, agendadas esta semana).
- **Dashboard** — proyectos activos del implementador con sesiones pendientes y
  agendadas.

## El archivo a trabajar

> **`panel-sesiones.html`** es el único archivo del panel. Todo (HTML, CSS y JS de
> la página) vive ahí. **Es lo que hay que editar.**

El resto de ficheros son **dependencias del portal**, copiadas tal cual desde
Yurest sólo para poder previsualizar la página con su estilo y su login. **No los
edites** (si divergen, romperán la copia de vuelta):

- `config.js` · `sidebar.js` · `theme.js` — scripts del portal (auth, menú, tema).
- `style.css` · `fonts.css` · `fonts/` — estilos y fuente corporativa (Bw Modelica).
- `favicon.svg` · `login.html` — assets / pantalla de login.

## Backend (n8n)

El panel **no tiene servidor propio**: llama a webhooks de **n8n** bajo
`YurestConfig.WEBHOOK_BASE + '/panel/...'`. Las definiciones están versionadas en
`database/n8n-workflows/` como referencia (se importan en n8n, no se ejecutan
desde aquí):

- `52-panel-sesiones-cs.json` — recent-sessions, notes, projects, tasks,
  summarize (OpenAI), asana-task.
- `53-panel-dashboards.json` — dashboard-general, cliente.

Credenciales y OAuth (Google, Asana, OpenAI) viven en n8n; aquí no hay secretos.

## Previsualizar en local

1. Sirve la carpeta con cualquier servidor estático, p. ej.:
   ```bash
   python3 -m http.server 8000
   ```
2. Abre `http://localhost:8000/panel-sesiones.html`.
3. La página exige sesión. Dos opciones:
   - **Login real**: te redirige a `login.html`; entra con tu cuenta del portal.
   - **Sesión de prueba** (rápida, sin login) — pégalo en la consola del navegador
     y recarga:
     ```js
     localStorage.setItem('yurest_auth', JSON.stringify({v:2, ts:Date.now(), rol:'admin', nombre:'QA', user:'qa'}));
     ['sinasignar','a3','proformas'].forEach(k => sessionStorage.setItem('yurest_badge_v1_'+k, JSON.stringify({ts:Date.now(), value:0})));
     ```

El backend al que llama es el n8n de producción (`WEBHOOK_BASE` en `config.js`), así
que verás datos reales de Asana/Calendar.

## Flujo de cambios

1. Trabaja sobre `panel-sesiones.html` en este repo.
2. El equipo de Yurest copia el archivo (y, si cambian, los workflows de
   `database/n8n-workflows/`) de vuelta al repo principal.

No commitees secretos (.env, tokens, credentials.json). El `.gitignore` ya los cubre.
