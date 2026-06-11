require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();

// ── CORS ────────────────────────────────────────────────────
// En producción el front vive en el portal estático (otro origen) y llama a
// este servicio vía YurestConfig.PANEL_API_BASE → petición cross-origin. Sólo
// se permiten los orígenes conocidos del portal (más localhost para dev).
const ORIGENES_PERMITIDOS = [
  'https://portal.yurest.es',
  'https://alexak98.github.io',
  'http://localhost:8091',
  'http://127.0.0.1:8091',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGENES_PERMITIDOS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

const { ANTHROPIC_API_KEY, ASANA_TOKEN, ASANA_WORKSPACE, PORT, GOOGLE_REDIRECT_URI } = process.env;

// ── Google OAuth Setup ──────────────────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const YOUTUBE_TOKEN_PATH = path.join(__dirname, 'token-youtube.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

let oAuth2Client;
let oAuthYouTubeClient;

function buildOAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  return new google.auth.OAuth2(client_id, client_secret, GOOGLE_REDIRECT_URI);
}

function initOAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Falta credentials.json en la carpeta');
    return null;
  }
  oAuth2Client = buildOAuthClient();
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  }

  oAuthYouTubeClient = buildOAuthClient();
  if (fs.existsSync(YOUTUBE_TOKEN_PATH)) {
    oAuthYouTubeClient.setCredentials(JSON.parse(fs.readFileSync(YOUTUBE_TOKEN_PATH)));
  }
}
initOAuth();

// ── Rutas de autenticación ───────────────────────────────────
app.get('/auth', (req, res) => {
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/auth-youtube', (req, res) => {
  const url = oAuthYouTubeClient.generateAuthUrl({
    access_type: 'offline',
    scope: YOUTUBE_SCOPES,
    prompt: 'consent select_account',
    state: 'youtube'
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const isYouTube = req.query.state === 'youtube';
    const client = isYouTube ? oAuthYouTubeClient : oAuth2Client;
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);
    fs.writeFileSync(isYouTube ? YOUTUBE_TOKEN_PATH : TOKEN_PATH, JSON.stringify(tokens));
    const tipo = isYouTube ? 'YouTube' : 'Google Drive/Calendar';
    res.send(`<h2>✅ ${tipo} conectado</h2><p>Puedes cerrar esta pestaña y volver al panel.</p><script>setTimeout(() => window.location.href = "/", 2000);</script>`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

app.get('/api/auth-status', (req, res) => {
  res.json({
    authenticated: fs.existsSync(TOKEN_PATH),
    youtube: fs.existsSync(YOUTUBE_TOKEN_PATH)
  });
});

// ── Listar últimas sesiones (docs de Gemini recientes) ───────
const CALENDARIOS_PERSONAS = {
  mario:  { calId: 'primary',                email: 'm.labrandero@yurest.com' },
  carlos: { calId: 'c.aparicio@yurest.com',  email: 'c.aparicio@yurest.com'   },
  hugo:   { calId: 'h.zalazar@yurest.com',   email: 'h.zalazar@yurest.com'    }
};

// Stopwords compartidas para matching difuso de nombres de cliente
const STOPWORDS_CLIENTES = new Set([
  'el','la','los','las','de','del','y','o','a','en','con','por','para','un','una','al','de la','del','de los','de las',
  'santa','santo','san','sant',
  'casa','bar','restaurant','restaurante','restaurantes','hotel','hoteles','grupo','grupos',
  'cocina','cocinas','catering','cafe','cafeteria','pizzeria','pizza','burger','burgers',
  'club','sociedad','sa','sl','slu','sas',
  'proyecto','cliente','formacion','sesion','reunion','llamada',
  'escalado','implementacion','seguimiento','onboarding','revision','revisar',
  'central','centrales'
]);

const normalizarTexto = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function palabrasSignificativasCliente(nombreCliente) {
  return normalizarTexto(nombreCliente).split(' ')
    .filter(p => p.length >= 4 && !STOPWORDS_CLIENTES.has(p));
}

function eventoCoincideConCliente(eventSummary, palabrasCliente) {
  if (!eventSummary || !palabrasCliente.length) return false;
  const normEvt = normalizarTexto(eventSummary);
  const coincidencias = palabrasCliente.filter(p => normEvt.includes(p)).length;
  // Si hay 1 palabra: 1 debe coincidir. Si hay 2+: requerimos al menos 1 (la distintiva)
  const minNecesarias = palabrasCliente.length === 1 ? 1 : Math.max(1, Math.ceil(palabrasCliente.length / 2));
  return coincidencias >= minNecesarias;
}

app.get('/api/recent-sessions', async (req, res) => {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const persona = (req.query.person || 'mario').toLowerCase();
    const cfg = CALENDARIOS_PERSONAS[persona];
    if (!cfg) return res.status(400).json({ error: 'Persona no válida' });
    const calendarioId = cfg.calId;
    const emailOrganizador = cfg.email;

    // 7 días laborales atrás
    const hoy = new Date();
    let diasLaborales = 0;
    const limite = new Date(hoy);
    while (diasLaborales < 7) {
      limite.setDate(limite.getDate() - 1);
      const dow = limite.getDay();
      if (dow !== 0 && dow !== 6) diasLaborales++;
    }
    limite.setHours(0, 0, 0, 0);
    const limiteISO = limite.toISOString();

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const sesionesMap = new Map();

    // Buscar TODOS los eventos del calendario de la persona seleccionada
    try {
      const eventos = await calendar.events.list({
        calendarId: calendarioId,
        timeMin: limiteISO,
        timeMax: hoy.toISOString(),
        singleEvents: true,
        maxResults: 250,
        orderBy: 'startTime'
      });
      for (const evt of eventos.data.items || []) {
        // Solo eventos organizados/creados por la persona
        const organizador = (evt.organizer?.email || '').toLowerCase();
        const creador = (evt.creator?.email || '').toLowerCase();
        if (organizador !== emailOrganizador && creador !== emailOrganizador) continue;
        // Filtrar eventos sin título o muy genéricos
        if (!evt.summary) continue;
        const titSummary = evt.summary.toLowerCase();
        if (/tareas indirectas|comida|out of office|fuera de oficina/.test(titSummary)) continue;

        const fechaObj = new Date(evt.start.dateTime || evt.start.date);
        const titulo = evt.summary
          .replace(/\s*-\s*Notas de Gemini\s*$/i, '')
          .replace(/\s*-\s*\d{4}\/\d{2}\/\d{2}[^-]*$/, '')
          .trim();
        const correosInvitados = (evt.attendees || []).map(a => a.displayName || a.email).filter(Boolean).join(', ');

        // ¿Tiene notas adjuntas?
        let docId = null;
        if (evt.attachments) {
          for (const att of evt.attachments) {
            if (att.title && /Notas de Gemini/i.test(att.title) && att.fileId) {
              docId = att.fileId;
              break;
            }
          }
        }

        // Clave única por evento
        const clave = docId || `evt_${evt.id}`;
        if (sesionesMap.has(clave)) continue;
        sesionesMap.set(clave, {
          id: clave,
          docId,
          name: titulo,
          titulo,
          correosInvitados,
          tieneNotas: !!docId,
          fechaObj,
          fecha: fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
        });
      }
    } catch (e) {
      console.log(`⚠️ Error accediendo calendario ${calendarioId}:`, e.message);
      return res.status(500).json({ error: `No se pudo acceder al calendario de ${persona}: ${e.message}` });
    }


    // Ordenar y deduplicar por título+fecha
    const todas = Array.from(sesionesMap.values()).sort((a, b) => b.fechaObj - a.fechaObj);
    const vistos = new Set();
    const sesiones = [];
    for (const s of todas) {
      const clave = `${s.titulo}__${s.fecha}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      sesiones.push({
        id: s.id, docId: s.docId, tieneNotas: s.tieneNotas,
        name: s.name, titulo: s.titulo, fecha: s.fecha,
        fechaISO: s.fechaObj.toISOString(),
        correosInvitados: s.correosInvitados
      });
    }

    const conNotas = sesiones.filter(s => s.tieneNotas).length;
    console.log(`📋 Sesiones de ${persona}: ${sesiones.length} (${conNotas} con notas, ${sesiones.length - conNotas} sin notas)`);
    res.json(sesiones);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helpers de extracción ─────────────────────────────────────
function extraerParticipantesDeDoc(texto) {
  if (!texto) return '';
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    let m = linea.match(/^(?:Participantes|Asistentes|Attendees)[:：]\s*(.+)$/i);
    if (m && m[1].trim().length > 0) return m[1].trim();

    if (/^(?:Participantes|Asistentes|Attendees)\s*[:：]?\s*$/i.test(linea)) {
      const nombres = [];
      for (let j = i + 1; j < lineas.length && j < i + 15; j++) {
        const l = lineas[j].trim();
        if (!l) break;
        const limpio = l.replace(/^[-•*]\s*/, '').trim();
        if (limpio && limpio.length < 100) nombres.push(limpio);
        else break;
      }
      if (nombres.length) return nombres.join(', ');
    }
  }
  return '';
}

function extraerNombresDeProximosPasos(texto) {
  if (!texto) return '';
  // Localizar sección "Próximos pasos" hasta el siguiente bloque típico / fin
  const idx = texto.search(/próximos pasos|proximos pasos|next steps|suggested next steps/i);
  if (idx === -1) return '';
  const inicio = texto.substring(idx);
  const cortado = inicio.split(/\n\s*(?:Detalles|Details|Información general|Información|Resumen|Summary|Temas|Topics|Revisa las notas|Cómo es la calidad)/i)[0];

  // Capturar todos los [Nombre] de la sección
  const matches = Array.from(cortado.matchAll(/\[([^\]]+)\]/g));
  const todosLosBrutos = matches.map(m => m[1]);
  console.log('🔍 Nombres en bruto encontrados:', JSON.stringify(todosLosBrutos));

  const mapa = new Map();
  for (const m of matches) {
    // Un corchete puede contener varios nombres separados por coma o punto y coma
    const partes = m[1].split(/[,;]/);
   for (const parte of partes) {
    let nombre = parte.trim();
    // Normalizar Unicode (NFC) — combinar tildes con su letra base
    nombre = nombre.normalize('NFC');
    // Normalizar espacios internos (incluido nbsp  , tabs, etc.)
    nombre = nombre.replace(/[\s ]+/g, ' ').trim();
    if (/^(the group|todos|all|el grupo)$/i.test(nombre)) continue;
    if (nombre.length > 60 || nombre.length < 2) continue;
    // Clave para dedup: lowercase + sin tildes + sin caracteres invisibles
    const clave = nombre.toLowerCase()
      .normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[​-‍﻿]/g, '');
    if (!mapa.has(clave)) mapa.set(clave, nombre);
   }
  }

  const nombres = Array.from(mapa.values()).join(', ');
  console.log('🔍 Nombres extraídos (dedupados):', nombres || '(ninguno)');
  return nombres;
}

function extraerDuracion(texto) {
  if (!texto) return 0;
  const t = texto.toLowerCase();
  let m = t.match(/(\d+)\s*h\s*(\d+)\s*m/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = t.match(/(\d+)\s*(?:h|hora|horas)\s+(\d+)\s*(?:min|minuto)/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = t.match(/(\d+)\s*(?:horas?)\b/);
  if (m) return parseInt(m[1]) * 60;
  m = t.match(/(\d+)\s*(?:minutos?|min)\b/);
  if (m) return parseInt(m[1]);
  return 0;
}

// ── Cargar notas de un doc específico ────────────────────────
app.get('/api/notes/:docId', async (req, res) => {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const docs = google.docs({ version: 'v1', auth: oAuth2Client });

    const fileInfo = await drive.files.get({
      fileId: req.params.docId,
      fields: 'id, name, modifiedTime'
    });
    const file = fileInfo.data;

    const doc = await docs.documents.get({ documentId: file.id });
    const contenido = extraerTexto(doc.data.body.content);

    // Eliminar el sufijo " - YYYY/MM/DD ... - Notas de Gemini" del nombre del doc
    const titulo = file.name
      .replace(/\s*-\s*Notas de Gemini\s*$/i, '')
      .replace(/\s*-\s*\d{4}\/\d{2}\/\d{2}[^-]*$/, '')
      .trim();
    const fechaDoc = new Date(file.modifiedTime);

    // Correos invitados: 1) del doc de Gemini, 2) fallback de calendarios accesibles
    let correosInvitados = extraerParticipantesDeDoc(contenido);

    if (!correosInvitados) {
      try {
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const desde = new Date(fechaDoc.getTime() - 4 * 60 * 60 * 1000);
        const hasta = new Date(fechaDoc.getTime() + 1 * 60 * 60 * 1000);

        const listaCalendarios = await calendar.calendarList.list();
        const calendarios = (listaCalendarios.data.items || []).map(c => c.id);

        for (const calId of calendarios) {
          try {
            const eventos = await calendar.events.list({
              calendarId: calId,
              timeMin: desde.toISOString(),
              timeMax: hasta.toISOString(),
              singleEvents: true
            });
            const evt = eventos.data.items.find(e => e.summary && e.summary.includes(titulo.substring(0, 15)));
            if (evt && evt.attendees) {
              correosInvitados = evt.attendees.map(a => a.displayName || a.email).join(', ');
              console.log('✅ Correos encontrados en calendario:', calId);
              break;
            }
          } catch (e) { /* ignorar calendario inaccesible */ }
        }
      } catch (e) { console.log('⚠️ Error listando calendarios:', e.message); }
    }

    const duracion = extraerDuracion(contenido);
    const participantes = extraerNombresDeProximosPasos(contenido);

    res.json({
      titulo,
      fecha: fechaDoc.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      correosInvitados,
      participantes,
      notas: contenido,
      docName: file.name,
      duracion
    });
  } catch (e) {
    console.error('❌ /api/notes error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

function extraerTexto(content) {
  let texto = '';
  for (const elem of content || []) {
    if (elem.paragraph) {
      for (const e of elem.paragraph.elements || []) {
        if (e.textRun) texto += e.textRun.content;
      }
    }
    if (elem.table) {
      for (const row of elem.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          texto += extraerTexto(cell.content);
        }
      }
    }
  }
  return texto;
}

// ── Proyectos del portfolio "Proyectos Mario" ────────────────
const PORTFOLIOS = {
  mario:  { gid: '1208210821231026', name: 'Proyectos Mario'  },
  hugo:   { gid: '1207904722398091', name: 'Proyectos Hugo'   },
  carlos: { gid: '1212391476899288', name: 'Proyectos Carlos' }
};

app.get('/api/portfolios', (req, res) => {
  res.json(Object.entries(PORTFOLIOS).map(([key, v]) => ({ key, name: v.name })));
});

app.get('/api/projects/:portfolioKey', async (req, res) => {
  try {
    const portfolio = PORTFOLIOS[req.params.portfolioKey];
    if (!portfolio) return res.status(404).json({ error: 'Portfolio no encontrado' });

    const url = `https://app.asana.com/api/1.0/portfolios/${portfolio.gid}/items?limit=100&opt_fields=name,gid`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } });
    const data = await r.json();
    const proyectos = (data.data || [])
      .map(p => ({ gid: p.gid, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(proyectos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tareas + subtareas de un proyecto ────────────────────────
app.get('/api/tasks/:projectGid', async (req, res) => {
  try {
    const url = `https://app.asana.com/api/1.0/projects/${req.params.projectGid}/tasks?opt_fields=name,gid,completed,num_subtasks&limit=100`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } });
    const data = await r.json();
    const tareas = (data.data || []).filter(t => !t.completed);

    const resultado = [];
    for (const t of tareas) {
      resultado.push({ gid: t.gid, name: t.name, esSubtarea: false });
      if (t.num_subtasks > 0) {
        const sr = await fetch(
          `https://app.asana.com/api/1.0/tasks/${t.gid}/subtasks?opt_fields=name,gid,completed&limit=100`,
          { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
        );
        const sd = await sr.json();
        (sd.data || []).filter(s => !s.completed).forEach(s => {
          resultado.push({
            gid: s.gid,
            name: '   ↳ ' + s.name,
            esSubtarea: true,
            parentName: t.name
          });
        });
      }
    }

    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/summarize', async (req, res) => {
  try {
        const { notas, titulo, fecha, participantes, correosInvitados } = req.body;
    const prompt = `Eres asistente de implementación de software hostelero (Yurest).
Genera el cuerpo de un email de resumen de sesión en español a partir de las notas proporcionadas.

DEBES RESPONDER ÚNICAMENTE CON UN JSON VÁLIDO con esta estructura exacta:

{
  "intro": "Frase introductoria breve y concreta sobre lo que se trabajó",
  "titulo": "${titulo}",
  "fecha": "${fecha}",
    "participantes": "${participantes}",
  "correos_invitados": "${correosInvitados || ''}",
  "objetivo": "Una frase clara con el objetivo principal de la sesión",
  "temas_discutidos": [
    {"titulo": "Nombre del tema", "descripcion": "Explicación técnica del punto trabajado"}
  ],
  "puntos_importantes": [
    {"titulo": "Título breve del acuerdo/decisión", "descripcion": "Detalle del acuerdo"}
  ],
  "tareas_pendientes": [
    {"titulo": "Título breve de la tarea", "descripcion": "Detalle de la acción pendiente SIN incluir nombre del responsable"}
  ],
    "proxima_sesion": "Tema, fecha y hora si se menciona. String vacío si no hay info",
  "duracion_minutos": 0
}
REGLAS:
- 3 a 7 elementos por sección máximo
- Sé concreto y técnico, usa nombres reales de módulos/productos
- No inventes información que no esté en las notas
- En tareas_pendientes NUNCA incluyas nombres de responsables, solo la acción
- Si una sección no tiene info, devuélvela como array vacío []
- DEVUELVE ÚNICAMENTE EL JSON, sin texto antes ni después, sin markdown
- Escapa correctamente las comillas dentro de strings (usa \\")
- duracion_minutos: extrae la duración exacta de la sesión si aparece en las notas (busca expresiones como "duración", "minutos", "horas", "duró", o el rango de inicio/fin). Devuelve solo el número en minutos. Si no aparece, devuelve 0.

NOTAS DE LA SESIÓN:
${notas}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);

    let texto = data.content[0].text.trim();
    const matchJson = texto.match(/\{[\s\S]*\}/);
    if (!matchJson) {
      console.error('Respuesta sin JSON:\n', texto);
      throw new Error('Claude no devolvió JSON válido');
    }

    let datos;
    try {
      datos = JSON.parse(matchJson[0]);
    } catch (parseErr) {
      console.error('JSON malformado:\n', matchJson[0]);
      throw new Error('JSON malformado: ' + parseErr.message);
    }

    console.log('✅ Resumen generado:',
      (datos.temas_discutidos || []).length, 'temas,',
      (datos.tareas_pendientes || []).length, 'tareas');

    res.json({ datos });
  } catch (e) {
    console.error('❌ /api/summarize error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const SHOW_FIELD_GID = '1211792508172622';
const SHOW_OPTIONS = {
  'Show': '1212358671286114',
  'No Show': '1211792508172623'
};

app.put('/api/asana-task/:taskGid', async (req, res) => {
  try {
    const { resumen, youtubeUrl, asistencia, duracion, fecha } = req.body;
    const taskGid = req.params.taskGid;

    const notas =
      `📹 Grabación: ${youtubeUrl || 'Pendiente'}\n` +
      `──────────────────────────────\n\n` +
      resumen;

    const fechaISO = parsearFechaES(fecha);

    // 1) Actualizar tarea (notas, fechas, campo Show)
        const payload = {
      data: {
        notes: notas,
        completed: true,
        custom_fields: {
          [SHOW_FIELD_GID]: SHOW_OPTIONS[asistencia]
        }
      }
    };
    if (fechaISO) {
      payload.data.start_on = fechaISO;
      payload.data.due_on = fechaISO;
    }

    console.log('\n──── Guardando en Asana ────');
    console.log('Task GID:', taskGid);

    const r = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ASANA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (data.errors) {
      console.log('Error actualización tarea:', JSON.stringify(data.errors));
      throw new Error(JSON.stringify(data.errors));
    }
    console.log('✅ Tarea actualizada');

    // 2) Crear entrada de tiempo (duración)
    const minutos = parseInt(duracion, 10) || 0;
    if (minutos > 0) {
      const tr = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/time_tracking_entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ASANA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            duration_minutes: minutos,
            entered_on: fechaISO || undefined
          }
        })
      });
      const td = await tr.json();
      if (td.errors) {
        console.log('⚠️ Error tiempo:', JSON.stringify(td.errors));
      } else {
        console.log('✅ Entrada de tiempo añadida:', minutos, 'min');
      }
    }

    console.log('────────────────────────────\n');
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error al guardar:', e.message);
    res.status(500).json({ error: e.message });
  }
});

function parsearFechaES(fechaStr) {
  if (!fechaStr) return null;
  const meses = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  const m = fechaStr.toLowerCase().match(/(\d{1,2}) de (\w+) de (\d{4})/);
  if (!m) return null;
  return meses[m[2]] ? `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}` : null;
}
// ── Subida a YouTube ────────────────────────────────────────
const CARPETA_PORTADAS = 'portadas youtube formaciones-1';

async function buscarCarpeta(drive, nombre) {
  const r = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${nombre.replace(/'/g, "\\'")}' and trashed=false`,
    pageSize: 5,
    fields: 'files(id, name)'
  });
  return r.data.files?.[0]?.id;
}

async function buscarPortadaCliente(drive, nombreCliente) {
  const carpetaId = await buscarCarpeta(drive, CARPETA_PORTADAS);
  if (!carpetaId) return null;
  const r = await drive.files.list({
    q: `'${carpetaId}' in parents and mimeType contains 'image/' and trashed=false`,
    pageSize: 200,
    fields: 'files(id, name, mimeType)'
  });
  const archivos = r.data.files || [];
  if (!archivos.length) return null;

  // Matching difuso: normalizar y comparar
  const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
  const clienteNorm = norm(nombreCliente);
  let mejor = null;
  let mejorScore = 0;
  for (const f of archivos) {
    const nombreNorm = norm(f.name.replace(/\.[^.]+$/, '')); // sin extensión
    let score = 0;
    if (nombreNorm === clienteNorm) score = 100;
    else if (nombreNorm.includes(clienteNorm)) score = 80;
    else if (clienteNorm.includes(nombreNorm) && nombreNorm.length >= 4) score = 70;
    else {
      // contar substring común más largo
      for (let len = Math.min(clienteNorm.length, nombreNorm.length); len >= 4; len--) {
        let match = false;
        for (let i = 0; i + len <= clienteNorm.length && !match; i++) {
          if (nombreNorm.includes(clienteNorm.substring(i, i + len))) { score = len * 5; match = true; }
        }
        if (match) break;
      }
    }
    if (score > mejorScore) { mejorScore = score; mejor = f; }
  }
  return mejorScore >= 20 ? mejor : null;
}

async function buscarGrabacionMeet(drive, titulo, fechaSesion) {
  // Probar varios nombres posibles de la carpeta
  const NOMBRES_CARPETA = ['Meet Recordings', 'Grabaciones de Meet', 'Grabaciones', 'Recordings'];
  let carpetaId = null;
  let carpetaNombre = null;
  for (const n of NOMBRES_CARPETA) {
    carpetaId = await buscarCarpeta(drive, n);
    if (carpetaId) { carpetaNombre = n; break; }
  }
  console.log('📁 Carpeta de grabaciones:', carpetaNombre || '(no encontrada — buscaré en todo Drive)');

  let archivos = [];

  if (carpetaId) {
    const r = await drive.files.list({
      q: `'${carpetaId}' in parents and mimeType contains 'video/' and trashed=false`,
      pageSize: 200,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, createdTime, mimeType, parents)'
    });
    archivos = r.data.files || [];
  }

  // Si no hay archivos o la carpeta no existe, buscar TODOS los videos recientes
  if (!archivos.length) {
    const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const r = await drive.files.list({
      q: `mimeType contains 'video/' and trashed=false and createdTime > '${desde}'`,
      pageSize: 200,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, createdTime, mimeType)'
    });
    archivos = r.data.files || [];
  }

  console.log(`🎥 ${archivos.length} vídeo(s) candidatos encontrados`);
  archivos.slice(0, 8).forEach(f => console.log('   -', f.name, '|', f.createdTime));

  if (!archivos.length) return null;

  // Matching por título + cercanía de fecha
  const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tituloNorm = norm(titulo);
  const palabrasTitulo = tituloNorm.split(' ').filter(p => p.length > 2);

  // Parsear fecha en español "10 de junio de 2026" → Date
  const fechaISOref = fechaSesion ? parsearFechaES(fechaSesion) : null;
  const fechaRef = fechaISOref ? new Date(fechaISOref).getTime() : Date.now();
  console.log('📅 Fecha de referencia:', fechaISOref || '(usando ahora)');

  const evaluados = [];
  for (const f of archivos) {
    const nombreNorm = norm(f.name);
    let coincidencias = 0;
    for (const p of palabrasTitulo) if (nombreNorm.includes(p)) coincidencias++;
    const ratioTitulo = palabrasTitulo.length ? coincidencias / palabrasTitulo.length : 0;
    const ts = new Date(f.createdTime).getTime();
    const horas = isFinite(ts) && isFinite(fechaRef) ? Math.abs((ts - fechaRef) / 3600000) : 0;
    const score = ratioTitulo * 100 - horas / 4;
    evaluados.push({ file: f, coincidencias, score });
  }
  evaluados.sort((a, b) => b.score - a.score);

  console.log('🏆 Top 5 candidatos por score:');
  evaluados.slice(0, 5).forEach((e, i) => {
    console.log(`   ${i+1}. [${e.score.toFixed(1)} pts | ${e.coincidencias} palabras] ${e.file.name}`);
  });

  console.log('🔑 Palabras buscadas del título:', palabrasTitulo.join(', '));

  const mejor = evaluados[0]?.file || null;
  const mejorCoinc = evaluados[0]?.coincidencias || 0;
  const minCoinc = palabrasTitulo.length <= 2 ? 1 : 2;
  return mejorCoinc >= minCoinc ? mejor : null;
}

app.post('/api/youtube-upload', async (req, res) => {
  try {
    if (!fs.existsSync(YOUTUBE_TOKEN_PATH)) {
      return res.status(401).json({ error: 'YouTube no conectado. Pulsa "Conectar YouTube" primero.' });
    }
    if (!fs.existsSync(TOKEN_PATH)) {
      return res.status(401).json({ error: 'Google no conectado.' });
    }
    const { titulo, nombreCliente, fechaSesion, notasDocId } = req.body;
    if (!titulo) return res.status(400).json({ error: 'Falta título' });

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const youtube = google.youtube({ version: 'v3', auth: oAuthYouTubeClient });

    console.log('\n──── Subida a YouTube ────');
    console.log('Título:', titulo);
    console.log('Cliente:', nombreCliente);
    console.log('Notas docId:', notasDocId);

    // 1) Buscar la grabación: prioridad al nombre del doc de notas (mismo nombre + "Recording")
    let grabacion = null;
    if (notasDocId) {
      try {
        const docInfo = await drive.files.get({
          fileId: notasDocId,
          fields: 'id, name, parents'
        });
        const nombreNotas = docInfo.data.name;
        // Nombre esperado: sustituir "Notas de Gemini" por "Recording"
        const nombreGrabacion = nombreNotas.replace(/Notas de Gemini\s*$/i, 'Recording');
        console.log('🔍 Buscando grabación con nombre:', nombreGrabacion);

        const r = await drive.files.list({
          q: `name='${nombreGrabacion.replace(/'/g, "\\'")}' and trashed=false`,
          pageSize: 5,
          fields: 'files(id, name, mimeType, parents)'
        });
        if (r.data.files?.length) grabacion = r.data.files[0];
      } catch (e) { console.log('⚠️ Error buscando por nombre exacto:', e.message); }
    }

    // Fallback: búsqueda difusa anterior
    if (!grabacion) {
      console.log('🔍 No se encontró por nombre exacto, usando búsqueda difusa...');
      grabacion = await buscarGrabacionMeet(drive, titulo, fechaSesion);
    }

    if (!grabacion) {
      throw new Error('No se encontró la grabación. Asegúrate de que Meet ya la haya subido a Drive.');
    }
    console.log('🎥 Grabación:', grabacion.name);

    // 2) Buscar la portada
    const portada = nombreCliente ? await buscarPortadaCliente(drive, nombreCliente) : null;
    if (portada) console.log('🖼️ Portada:', portada.name);
    else console.log('⚠️ No se encontró portada para:', nombreCliente);

    // 3) Stream de la grabación desde Drive → upload a YouTube
    const grabResp = await drive.files.get(
      { fileId: grabacion.id, alt: 'media' },
      { responseType: 'stream' }
    );

    console.log('⏳ Subiendo a YouTube...');
    const insertResp = await youtube.videos.insert({
      part: ['snippet', 'status'],
      notifySubscribers: false,
      requestBody: {
        snippet: { title: titulo, description: '', categoryId: '22' },
        status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false, madeForKids: false }
      },
      media: { body: grabResp.data }
    });
    const videoId = insertResp.data.id;
    const url = `https://youtu.be/${videoId}`;
    console.log('✅ Vídeo subido:', url);

    // 4) Subir portada (si la encontramos)
    if (portada) {
      try {
        const portadaResp = await drive.files.get(
          { fileId: portada.id, alt: 'media' },
          { responseType: 'stream' }
        );
        await youtube.thumbnails.set({
          videoId,
          media: { body: portadaResp.data }
        });
        console.log('✅ Portada asignada');
      } catch (e) {
        console.log('⚠️ Error subiendo portada:', e.message);
      }
    }

    console.log('────────────────────────────\n');
    res.json({
      url,
      videoId,
      grabacionNombre: grabacion.name,
      portadaNombre: portada?.name || null
    });
  } catch (e) {
    console.error('❌ /api/youtube-upload:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Dashboard semanal ────────────────────────────────────────
const PORTFOLIOS_DASHBOARD = {
  mario:  '1208210821231026',
  hugo:   '1207904722398091',
  carlos: '1212391476899288'
};

app.get('/api/dashboard', async (req, res) => {
  try {
    const impl = (req.query.implementador || '').toLowerCase();
    const portGid = PORTFOLIOS_DASHBOARD[impl];
    if (!portGid) return res.status(400).json({ error: 'Implementador no válido' });

    // Fecha de inicio de la semana (lunes)
    const hoy = new Date();
    const dow = hoy.getDay() || 7;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - dow + 1);
    lunes.setHours(0, 0, 0, 0);

    // Listar proyectos del portfolio
    const projResp = await fetch(
      `https://app.asana.com/api/1.0/portfolios/${portGid}/items?limit=100&opt_fields=name,gid`,
      { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
    );
    const projData = await projResp.json();
    const proyectos = (projData.data || []);

    let totalSesiones = 0, show = 0, noShow = 0, minutosTotales = 0;
    const porDia = [0, 0, 0, 0, 0];
    const clientesMap = new Map();

    console.log(`\n📊 Dashboard ${impl}: analizando ${proyectos.length} proyectos desde ${lunes.toISOString()}`);
    let tareasAnalizadas = 0, conShowField = 0;

    // Función para procesar una tarea (o subtarea)
    function procesarTarea(t, proyectoGid, proyectoNombre) {
      tareasAnalizadas++;
      const showField = (t.custom_fields || []).find(f => f.gid === SHOW_FIELD_GID);
      if (!showField || !showField.enum_value) return;
      conShowField++;
      const asistencia = showField.enum_value.name;
      const fechaRef = t.completed_at ? new Date(t.completed_at) : (t.due_on ? new Date(t.due_on) : null);
      if (!fechaRef || fechaRef < lunes) return;

      totalSesiones++;
      if (asistencia === 'Show') show++;
      else if (asistencia === 'No Show') noShow++;
      const minutos = t.actual_time_minutes || 0;
      minutosTotales += minutos;
      const diaIdx = (fechaRef.getDay() || 7) - 1;
      if (diaIdx >= 0 && diaIdx < 5) porDia[diaIdx]++;
      if (!clientesMap.has(proyectoGid)) clientesMap.set(proyectoGid, { nombre: proyectoNombre, sesiones: 0, minutos: 0 });
      const c = clientesMap.get(proyectoGid);
      c.sesiones++;
      c.minutos += minutos;
    }

    for (const p of proyectos) {
      const tasksResp = await fetch(
        `https://app.asana.com/api/1.0/projects/${p.gid}/tasks?opt_fields=name,gid,completed,completed_at,actual_time_minutes,custom_fields,due_on,num_subtasks&limit=100`,
        { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
      );
      const tasksData = await tasksResp.json();
      const topTasks = tasksData.data || [];

      for (const t of topTasks) {
        procesarTarea(t, p.gid, p.name);
        // Si tiene subtareas, las cargamos también
        if (t.num_subtasks) {
          try {
            const sr = await fetch(
              `https://app.asana.com/api/1.0/tasks/${t.gid}/subtasks?opt_fields=name,gid,completed,completed_at,actual_time_minutes,custom_fields,due_on&limit=100`,
              { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
            );
            const sd = await sr.json();
            for (const sub of sd.data || []) {
              procesarTarea(sub, p.gid, p.name);
            }
          } catch (e) { /* ignorar */ }
        }
      }
    }
    console.log(`📊 ${tareasAnalizadas} tareas analizadas, ${conShowField} con campo Show, ${totalSesiones} en rango (${show} Show, ${noShow} No Show)`);

    const topClientes = Array.from(clientesMap.values())
      .sort((a, b) => b.sesiones - a.sesiones || b.minutos - a.minutos)
      .slice(0, 5);

    res.json({
      totalSesiones, show, noShow, minutosTotales,
      clientesActivos: clientesMap.size,
      porDia,
      topClientes
    });
  } catch (e) {
    console.error('❌ /api/dashboard:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Vista cliente ───────────────────────────────────────────
app.get('/api/cliente/:projectGid', async (req, res) => {
  try {
    const gid = req.params.projectGid;
    // Rango de fechas (opcional)
    const desdeStr = req.query.desde;
    const hastaStr = req.query.hasta;
    const desde = desdeStr ? new Date(desdeStr + 'T00:00:00') : null;
    const hasta = hastaStr ? new Date(hastaStr + 'T23:59:59') : null;
    const projResp = await fetch(
      `https://app.asana.com/api/1.0/projects/${gid}?opt_fields=name`,
      { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
    );
    const projData = await projResp.json();
    const nombreCliente = projData.data?.name || 'Cliente';

    const ESTIMATED_TIME_GID = '1204618651223643';

    const tasksResp = await fetch(
      `https://app.asana.com/api/1.0/projects/${gid}/tasks?opt_fields=name,gid,completed,completed_at,actual_time_minutes,notes,custom_fields,due_on,num_subtasks&limit=100`,
      { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
    );
    const tasksData = await tasksResp.json();
    const tareasTop = tasksData.data || [];

    // Cargar subtareas de las que tienen
    const tareas = [...tareasTop];
    for (const t of tareasTop) {
      if (!t.num_subtasks) continue;
      try {
        const sr = await fetch(
          `https://app.asana.com/api/1.0/tasks/${t.gid}/subtasks?opt_fields=name,gid,completed,completed_at,actual_time_minutes,notes,custom_fields,due_on&limit=100`,
          { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
        );
        const sd = await sr.json();
        for (const sub of sd.data || []) {
          tareas.push({ ...sub, esSubtarea: true, parentName: t.name });
        }
      } catch (e) { /* ignorar */ }
    }

    const sesiones = [];
    const pendientes = [];
    let show = 0, noShow = 0, minutosTotales = 0;
    let countTop = 0, countSub = 0;

    console.log(`\n👥 Cliente "${nombreCliente}" — ${tareasTop.length} tareas top, ${tareas.length - tareasTop.length} subtareas`);

    for (const t of tareas) {
      const showField = (t.custom_fields || []).find(f => f.gid === SHOW_FIELD_GID);
      const asistencia = showField?.enum_value?.name;
      if (asistencia) {
        if (t.esSubtarea) countSub++; else countTop++;
      }
      if (asistencia) {
        // Es una sesión registrada
        const fechaRef = t.completed_at ? new Date(t.completed_at) : (t.due_on ? new Date(t.due_on) : null);
        // Filtrar por rango de fechas si se proporcionó
        if (desde && fechaRef && fechaRef < desde) continue;
        if (hasta && fechaRef && fechaRef > hasta) continue;
        const fechaCorta = fechaRef ? fechaRef.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase() : 'S/F';

        // Extraer URL de YouTube de las notas
        const notes = t.notes || '';
        const ytMatch = notes.match(/https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com)\/\S+/);
        const youtubeUrl = ytMatch ? ytMatch[0] : null;

        // Preview del resumen
        const inicio = notes.indexOf('\n\n');
        const resumen = inicio > -1 ? notes.substring(inicio + 2) : notes;
        const preview = resumen.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').substring(0, 180);

        // Obtener tiempo estimado
        const estField = (t.custom_fields || []).find(f => f.gid === ESTIMATED_TIME_GID);
        const estimado = estField?.number_value || 0;
        const fechaCompleta = fechaRef ? fechaRef.toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : 'Sin fecha';

        sesiones.push({
          titulo: t.esSubtarea ? `${t.parentName} ↳ ${t.name}` : t.name,
          fechaCorta,
          fechaCompleta,
          fechaRef: fechaRef ? fechaRef.getTime() : 0,
          asistencia,
          duracion: t.actual_time_minutes || 0,
          estimado,
          youtubeUrl,
          preview,
          resumenCompleto: notes,
          asanaUrl: `https://app.asana.com/0/${gid}/${t.gid}`
        });

        if (asistencia === 'Show') show++;
        else if (asistencia === 'No Show') noShow++;
        minutosTotales += t.actual_time_minutes || 0;
      } else if (!t.completed) {
        // Tarea pendiente: solo incluir si tiene tiempo estimado
        const estField = (t.custom_fields || []).find(f => f.gid === ESTIMATED_TIME_GID);
        if (estField && estField.number_value) {
          pendientes.push({
            name: t.esSubtarea ? `${t.parentName} ↳ ${t.name}` : t.name,
            gid: t.gid,
            estimado: estField.number_value
          });
        }
      }
    }

    sesiones.sort((a, b) => b.fechaRef - a.fechaRef);

    const totalSesiones = show + noShow;
    const showRate = totalSesiones ? Math.round((show / totalSesiones) * 100) : 0;

    console.log(`👥 Sesiones con Show field: ${countTop} top + ${countSub} sub = ${sesiones.length} total (en rango)`);

    // Progreso del proyecto:
    // - planificadas: tareas con tiempo estimado (con valor)
    // - ejecutadas: tareas finalizadas Y con tiempo real (con valor)
    let planificadas = 0;
    let ejecutadas = 0;
    for (const t of tareas) {
      const estField = (t.custom_fields || []).find(f => f.gid === ESTIMATED_TIME_GID);
      if (estField && estField.number_value > 0) planificadas++;
      if (t.completed && t.actual_time_minutes > 0) ejecutadas++;
    }

    // Sesiones agendadas esta semana en el calendario del implementador
    let agendadasEstaSemana = 0;
    const eventosAgendados = [];
    const impl = (req.query.implementador || '').toLowerCase();
    if (impl && CALENDARIOS_PERSONAS[impl] && fs.existsSync(TOKEN_PATH)) {
      try {
        const calId = CALENDARIOS_PERSONAS[impl].calId;
        const hoy = new Date();
        const dow = hoy.getDay() || 7;
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - dow + 1);
        lunes.setHours(0, 0, 0, 0);
        const finSemana = new Date(lunes);
        finSemana.setDate(lunes.getDate() + 7);

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const eventos = await calendar.events.list({
          calendarId: calId,
          timeMin: lunes.toISOString(),
          timeMax: finSemana.toISOString(),
          singleEvents: true,
          maxResults: 100,
          orderBy: 'startTime'
        });

        const palabrasCliente = palabrasSignificativasCliente(nombreCliente);
        if (!palabrasCliente.length) {
          console.log(`⚠️ Cliente "${nombreCliente}" sin palabras significativas para matching`);
        }

        for (const evt of eventos.data.items || []) {
          if (!evt.summary) continue;
          if (eventoCoincideConCliente(evt.summary, palabrasCliente)) {
            agendadasEstaSemana++;
            eventosAgendados.push({
              titulo: evt.summary,
              fecha: new Date(evt.start.dateTime || evt.start.date).toLocaleString('es-ES', {
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })
            });
          }
        }
        console.log(`📅 Cliente "${nombreCliente}" — palabras buscadas: [${palabrasCliente.join(', ')}] → ${agendadasEstaSemana} eventos`);
      } catch (e) { console.log('⚠️ Error agendadas:', e.message); }
    }

    res.json({
      nombre: nombreCliente,
      totalTareas: planificadas,
      completadas: ejecutadas,
      totalSesiones,
      minutosTotales,
      showRate,
      sesiones,
      pendientes,
      agendadasEstaSemana,
      eventosAgendados
    });
  } catch (e) {
    console.error('❌ /api/cliente:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Dashboard general por implementador ─────────────────────
app.get('/api/dashboard-general', async (req, res) => {
  try {
    const impl = (req.query.implementador || '').toLowerCase();
    const cfg = CALENDARIOS_PERSONAS[impl];
    const portGid = PORTFOLIOS_DASHBOARD[impl];
    if (!cfg || !portGid) return res.status(400).json({ error: 'Implementador no válido' });
    if (!fs.existsSync(TOKEN_PATH)) return res.status(401).json({ error: 'No autenticado en Google' });

    // 1) Proyectos del portfolio (filtrando finalizados)
    const projResp = await fetch(
      `https://app.asana.com/api/1.0/portfolios/${portGid}/items?limit=100&opt_fields=name,gid,current_status.color`,
      { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
    );
    const projData = await projResp.json();
    const proyectos = (projData.data || []).filter(p => p.current_status?.color !== 'complete');

    // 2) Eventos del calendario para esta semana (lun-dom)
    const hoy = new Date();
    const dow = hoy.getDay() || 7;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - dow + 1);
    lunes.setHours(0, 0, 0, 0);
    const finSemana = new Date(lunes);
    finSemana.setDate(lunes.getDate() + 7);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    let eventosSemana = [];
    try {
      const r = await calendar.events.list({
        calendarId: cfg.calId,
        timeMin: lunes.toISOString(),
        timeMax: finSemana.toISOString(),
        singleEvents: true,
        maxResults: 200,
        orderBy: 'startTime'
      });
      eventosSemana = r.data.items || [];
    } catch (e) { console.log('⚠️ Error calendar:', e.message); }

    // 3) Para cada proyecto: contar pendientes + emparejar agendadas
    const ESTIMATED_TIME_GID = '1204618651223643';

    const resultados = await Promise.all(proyectos.map(async p => {
      const pendientesList = [];
      try {
        const tasksResp = await fetch(
          `https://app.asana.com/api/1.0/projects/${p.gid}/tasks?opt_fields=name,completed,custom_fields,num_subtasks&limit=100`,
          { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
        );
        const tasksData = await tasksResp.json();
        for (const t of tasksData.data || []) {
          const est = (t.custom_fields || []).find(f => f.gid === ESTIMATED_TIME_GID);
          if (!t.completed && est && est.number_value > 0) {
            pendientesList.push({ name: t.name, estimado: est.number_value });
          }
          if (t.num_subtasks) {
            try {
              const sr = await fetch(
                `https://app.asana.com/api/1.0/tasks/${t.gid}/subtasks?opt_fields=name,completed,custom_fields&limit=100`,
                { headers: { Authorization: `Bearer ${ASANA_TOKEN}` } }
              );
              const sd = await sr.json();
              for (const sub of sd.data || []) {
                const sest = (sub.custom_fields || []).find(f => f.gid === ESTIMATED_TIME_GID);
                if (!sub.completed && sest && sest.number_value > 0) {
                  pendientesList.push({ name: `${t.name} ↳ ${sub.name}`, estimado: sest.number_value });
                }
              }
            } catch (e) { /* ignorar */ }
          }
        }
      } catch (e) { console.log(`⚠️ Tasks ${p.name}:`, e.message); }

      // Match agendadas (con detalle)
      const palabrasCliente = palabrasSignificativasCliente(p.name);
      const agendadasList = [];
      for (const evt of eventosSemana) {
        if (!evt.summary) continue;
        if (eventoCoincideConCliente(evt.summary, palabrasCliente)) {
          agendadasList.push({
            titulo: evt.summary,
            fecha: new Date(evt.start.dateTime || evt.start.date).toLocaleString('es-ES', {
              weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })
          });
        }
      }

      return {
        gid: p.gid,
        name: p.name,
        pendientes: pendientesList.length,
        agendadas: agendadasList.length,
        pendientesList,
        agendadasList
      };
    }));

    // Ordenar: primero los que tienen agendadas, luego por pendientes desc
    resultados.sort((a, b) => (b.agendadas + b.pendientes) - (a.agendadas + a.pendientes));

    const totalAgendadas = resultados.reduce((s, r) => s + r.agendadas, 0);
    const totalPendientes = resultados.reduce((s, r) => s + r.pendientes, 0);
    console.log(`📊 Dashboard general ${impl}: ${resultados.length} proyectos activos, ${totalPendientes} pendientes, ${totalAgendadas} agendadas`);

    res.json({
      proyectos: resultados,
      totalProyectos: resultados.length,
      totalPendientes,
      totalAgendadas
    });
  } catch (e) {
    console.error('❌ /api/dashboard-general:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Panel Yurest corriendo en http://localhost:${PORT}\n`);
});