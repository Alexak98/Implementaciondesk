// ============================================================
//  CONFIGURACIÓN CENTRAL — Yurest Portal
//  Única fuente de verdad para endpoints, constantes y helpers
//  de sesión/autenticación compartidos entre todas las páginas.
//  ------------------------------------------------------------
//  ESTADO (Fase 2.a — Ruta A módulos ES):
//    Algunas utilidades autocontenidas (escHtml/escAttr/escJsInAttr,
//    formatDate, generarId, PERMISOS_DISPONIBLES, WEBHOOK_BASE,
//    ENDPOINTS) están REPLICADAS en /js/lib/*.js como módulos ES
//    nativos para que páginas nuevas las puedan importar con
//    `<script type="module">`.
//
//    Si tocas una de esas funciones, sincroniza también el archivo
//    de /js/lib/ correspondiente. La duplicación se eliminará en la
//    Fase 2.b cuando convirtamos config.js a module wrapper y
//    migremos los 28 HTMLs a `<script type="module">`.
// ============================================================

// ──────────────────────────────────────────────────────────────
//  Typedefs JSDoc — sirven a VSCode/Cursor para autocompletar y
//  detectar errores en TODOS los HTMLs que cargan config.js, sin
//  necesidad de TypeScript ni paso de compilación. Si añades un
//  campo a la sesión, actualízalo aquí también.
// ──────────────────────────────────────────────────────────────

/**
 * Identificador de página, p.ej. "clientes", "lista", "informe-tickets".
 * Coincide con `id` en PERMISOS_DISPONIBLES y con la entrada en sidebar.js.
 * @typedef {string} PageId
 */

/**
 * Rol del usuario en el portal. 'admin' equivale a "todos los permisos".
 * @typedef {'admin'|'user'} RolUsuario
 */

/**
 * Permisos del usuario. Tres listas independientes de PageIds — un
 * usuario puede tener LECTURA pero no ESCRITURA sobre la misma página.
 * Tras la migración 2026-04-30_03_permisos_granulares.sql este es el
 * único shape válido en BD; el viejo array plano `["clientes", ...]` ya
 * no existe.
 * @typedef {Object} Permisos
 * @property {PageId[]} read   IDs de páginas con permiso de lectura
 * @property {PageId[]} write  IDs de páginas con permiso de escritura
 * @property {PageId[]} delete IDs de páginas con permiso de borrado
 */

/**
 * Sesión persistida en localStorage bajo la clave `yurest_auth`.
 * @typedef {Object} Session
 * @property {string|null}    id                  PK numérico del usuario
 * @property {string}         user                Username
 * @property {string|null}    user_id             Alias compatibilidad
 * @property {string}         nombre              Nombre completo (saludo)
 * @property {string}         email               Email del usuario
 * @property {RolUsuario}     rol                 Rol asignado
 * @property {Permisos}       permisos            Permisos granulares (read/write/delete)
 * @property {string|null}    sessions_revoked_at ISO-8601 si admin revocó
 * @property {string}         token               Token de sesión (o "authenticated")
 * @property {string}         basicAuth           Header Basic auth pre-codificado
 */

/**
 * Datos de contacto técnico de fabricante / soporte.
 * @typedef {Object} ContactoSoporte
 * @property {string} [nombre]
 * @property {string} [email]
 * @property {string} [telefono]
 * @property {string} [web]
 */

(function (global) {
    'use strict';

    // ──────────────────────────────────────────────────────────
    //  DATOS DEL EMISOR (Yurest) — fiscales y bancarios
    // ──────────────────────────────────────────────────────────
    // Fuente única de verdad para nombre, NIF, domicilio fiscal, contacto
    // y cuenta de cobro. Lo usan: generación de proformas y futuras
    // facturas, plantillas PDF (presupuestos / configurador / ofertas) y
    // mandatos SEPA. Si cambian, sincronizar aquí — antes vivían
    // copiados en presupuestos.html y solicitud.html.
    //
    // IBAN/BIC del certificado de titularidad BBVA emitido el 2025-11-06.
    const EMISOR = {
        nombre:    'Yurest Solutions, S.L.',
        nif:       'B40597437',
        direccion: 'Calle Transits, 6',
        cp:        '46002',
        poblacion: 'Valencia',
        provincia: 'Valencia',
        pais:      'España',
        email:     'hola@yurest.com',
        web:       'www.yurest.com',
        // Datos bancarios para cobros (proformas / facturas)
        banco:     'BBVA',
        iban:      'ES8901822339610201642813',
        bic:       'BBVAESMMXXX',
    };

    // ──────────────────────────────────────────────────────────
    //  BASE URLS — y modo de backend (n8n vs Laravel)
    // ──────────────────────────────────────────────────────────
    const WEBHOOK_BASE = 'https://n8n-soporte.data.yurest.dev/webhook';

    /**
     * URL base del backend Laravel local. En cuanto haya dominio público
     * (api-dev.yurest.dev / api.yurest.dev), se cambia aquí o se inyecta
     * por env. Sin slash final.
     */
    const API_BASE = (function () {
        // Permite override por hostname para que prod (GitHub Pages) y
        // local (php -S 127.0.0.1:8090) apunten distinto sin tocar el código.
        if (typeof location === 'undefined') {
            return 'http://localhost/api';
        }
        const host = location.hostname;
        // Producción: GitHub Pages.
        // CUANDO ESTÉ DESPLEGADO el backend Laravel real, sustituye la URL
        // de abajo por la del Forge prod (ej. 'https://api.yurest.com/api').
        // Hasta entonces, el flag yurest_backend='laravel' contra GitHub Pages
        // intentará llamar a localhost (que solo existe en máquinas de devs);
        // los usuarios normales seguirán contra n8n por defecto.
        if (host === 'portal.yurest.es' || host === 'alexak98.github.io') {
            return 'https://api.yurest.com/api'; // ← cambiar al dominio real cuando esté
        }
        // Dev local
        return 'http://localhost/api';
    })();

    /**
     * URL base del PANEL DE SESIONES CS (servicio Node 'panel' importado).
     * Es un Express autónomo con estado (OAuth Google/YouTube, Asana, Claude)
     * que NO vive en n8n ni en Laravel; el front (panel-sesiones.html) lo
     * llama por aquí. Sin slash final — los paths del panel ya empiezan por
     * '/api/...' y '/auth'.
     *
     * Cuando el servicio esté desplegado, sustituye la URL de producción por
     * el dominio real (p. ej. 'https://panel-api.yurest.es'). Hasta entonces
     * solo funciona en local contra http://localhost:3000.
     */
    const PANEL_API_BASE = (function () {
        if (typeof location === 'undefined') return 'http://localhost:3000';
        const host = location.hostname;
        if (host === 'portal.yurest.es' || host === 'alexak98.github.io') {
            return 'https://panel-api.yurest.es'; // ← cambiar al dominio real cuando esté desplegado
        }
        return 'http://localhost:3000';
    })();

    /**
     * Modo de backend: 'n8n' (default, legacy) o 'laravel' (nuevo).
     * Se controla con localStorage.yurest_backend para poder alternar
     * desde la consola del browser sin tocar código:
     *   localStorage.setItem('yurest_backend', 'laravel')
     *   localStorage.setItem('yurest_backend', 'n8n')
     */
    function getBackendMode() {
        try {
            const v = localStorage.getItem('yurest_backend');
            return v === 'laravel' ? 'laravel' : 'n8n';
        } catch (_) {
            return 'n8n';
        }
    }

    /**
     * Mapa endpoint legacy n8n → endpoint Laravel. Solo lista los que
     * ya tienen equivalente implementado en backend/. Si una URL no
     * está aquí, apiFetch la deja tal cual y la petición sigue contra
     * n8n aunque el modo esté en 'laravel' (degradación segura).
     *
     * @type {Record<string, string>}
     */
    const LARAVEL_ROUTES = {
        // Auth + listado fichas comparten UUID en n8n con métodos distintos.
        // Resolvemos según método cuando hace falta (key "<path>|<METHOD>"),
        // si no, key sin sufijo cubre todos los métodos.
        '018f3362-7969-4c49-9088-c78e4446c77f|POST': 'auth/login',
        '018f3362-7969-4c49-9088-c78e4446c77f|GET': 'fichas',
        // Fichas
        '57e04029-bae4-4124-8c43-c535e831a147': 'fichas',
        '5a304fcd-ae1d-49e6-92d1-c5a5e007bbfd': 'fichas',
        'fa16b994-5af1-4368-ba6b-592e633937c3': 'fichas?estado=rellenado',
        // Solicitudes
        'b0629324-e611-47d4-835f-3ac9bcd4dc9b': 'solicitudes',
        '1757fdcc-7fa7-4cb9-93b9-eb8118adaa1e': 'solicitudes',
        '6da4274f-5a6d-4981-a92a-f9d7eb734144': 'solicitudes/responder',
        // Eliminar
        'a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d': 'eliminar',
        // Bajas
        '84f094b2-9e55-448f-8ad9-f28721841873': 'bajas',
        '73ce8d34-9980-4c65-bd82-c0767f1483cf': 'bajas',
        '95d5ed5d-1139-45b9-88c2-3066bc49e45b': 'eliminar',
        // Distribución
        '6d3ed726-c86a-4b86-a2ae-7f07da9630a5': 'distribucion',
        // Slugs (los que ya eran legibles en n8n se mantienen idénticos)
        'proyectos': 'proyectos',
        'proyectos/tarea': 'proyectos/{id}/tareas',
        'proyectos/tarea/mover': 'proyectos/{id}/tareas/mover',
        'proyectos/anotaciones': 'proyectos/{id}/anotaciones',
        'proyectos/historial': 'proyectos/{id}/historial',
        'historial': 'historial',
        'asana/tasks': 'asana/tasks',
        'asana/task/stories': 'asana/tasks/{id}/stories',
        'calendar/event': 'calendar/events',
        'ficha/notificar-completa': 'fichas/{id}/notificar-completa',
        'yurest-grabado-a3': 'proyectos/{id}/grabado-a3',
        'promociones': 'promociones',
        'hardware/pedidos': 'hardware/pedidos',
        'hardware/stock': 'hardware/stock',
        'presupuestos': 'presupuestos',
        'notif-integraciones/config': 'notif-integraciones/config',
        'notif-integraciones/grupos': 'notif-integraciones/grupos',
        'notif-integraciones/historial': 'notif-integraciones/historial',
        'escalados': 'escalados',
        'cs-estado': 'cs/estado',
        'zendesk/tickets-heatmap': 'zendesk/heatmap',
        'zendesk/tickets-heatmap-ia': 'zendesk/heatmap/ia',
        'zendesk/resumen-semanal': 'zendesk/resumen?periodo=semana',
        'zendesk/resumen-mensual': 'zendesk/resumen?periodo=mes',
        'auth/login': 'auth/login',
        'auth/usuarios': 'usuarios',
        'auth/verify': 'auth/me',
    };

    /**
     * Reescribe una URL n8n a su equivalente Laravel cuando el modo está
     * activo. Solo reemplaza el dominio + path conocido; el query string
     * se preserva. Si no hay mapping → devuelve la URL original (degradación).
     *
     * Para paths con semántica distinta según método HTTP (ej. mismo UUID
     * usado para POST login y GET listar), busca primero la key con
     * sufijo "|METHOD"; si no existe cae a la key sin sufijo.
     *
     * @param {string} url
     * @param {string} [method] HTTP method (default 'GET')
     */
    function rewriteForLaravel(url, method) {
        if (typeof url !== 'string') return url;
        if (getBackendMode() !== 'laravel') return url;
        if (!url.startsWith(WEBHOOK_BASE + '/')) return url;
        const tail = url.slice(WEBHOOK_BASE.length + 1);
        // Separar path ↔ query
        const qIdx = tail.indexOf('?');
        const pathRaw = qIdx === -1 ? tail : tail.slice(0, qIdx);
        const query = qIdx === -1 ? '' : tail.slice(qIdx);
        const m = String(method || 'GET').toUpperCase();
        // 1) Mapping específico por método (path|METHOD)
        // 2) Mapping genérico por path
        const mapped = LARAVEL_ROUTES[pathRaw + '|' + m] || LARAVEL_ROUTES[pathRaw];
        if (!mapped) return url; // sin equivalente → seguimos en n8n
        // Si el mapping ya trae query (ej: 'fichas?estado=rellenado') y
        // el caller también añade query, las concatenamos con &.
        if (query && mapped.includes('?')) {
            return API_BASE + '/' + mapped + '&' + query.slice(1);
        }
        return API_BASE + '/' + mapped + query;
    }

    // ──────────────────────────────────────────────────────────
    //  ENDPOINTS — agrupados por dominio
    // ──────────────────────────────────────────────────────────
    const ENDPOINTS = {
        // Autenticación y listado general
        login:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,
        altas:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,

        // Fichas
        guardarFicha:         `${WEBHOOK_BASE}/57e04029-bae4-4124-8c43-c535e831a147`,
        completarFicha:       `${WEBHOOK_BASE}/5a304fcd-ae1d-49e6-92d1-c5a5e007bbfd`,
        eliminarFicha:        `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,
        // Upload de adjuntos al bucket Storage (workflow 35). Recibe
        // { nombre, tipo, data (data URL base64), ficha_id? } y devuelve
        // { storage_path, signed_url, size }. Ver migración
        // 2026-05-25_03_storage_adjuntos.sql.
        subirAdjuntoFicha:    `${WEBHOOK_BASE}/fichas-adjuntos-upload`,

        // Envío y vista pública de oferta. POST oferta-enviar-comercial
        // recibe { oferta_id, portal_base_url } y dispara email al cliente
        // con link a oferta.html?t=<token>, pero seleccionando la credencial
        // SMTP/Gmail del comercial dueño de la oferta (workflow 37) — el
        // remitente real (firma, dominio de envío) es el del comercial, no
        // la cuenta soporte genérica. Fallback a soporte si el comercial no
        // tiene credencial asignada. La ruta antigua /oferta-enviar (workflow
        // 36) sigue activa como fallback de compatibilidad. GET oferta-publica
        // sigue en workflow 36. Ver migración 2026-05-25_04_ofertas_access_token.sql.
        enviarOfertaAlCliente: `${WEBHOOK_BASE}/oferta-enviar-comercial`,
        ofertaPublica:         `${WEBHOOK_BASE}/oferta-publica`,

        // Solicitudes
        crearSolicitud:       `${WEBHOOK_BASE}/b0629324-e611-47d4-835f-3ac9bcd4dc9b`,
        listaSolicitudes:     `${WEBHOOK_BASE}/1757fdcc-7fa7-4cb9-93b9-eb8118adaa1e`,
        // Workflow 38: el comercial pre-rellena el formulario del cliente
        // (todos los campos menos SEPA) desde el listado de solicitudes
        // para que el cliente solo tenga que firmar el SEPA al abrir el link.
        // Recibe { access_token, datos_parciales } y hace merge JSONB
        // sobre solicitudes.datos respetando los campos SEPA ya presentes.
        prellenarSolicitud:   `${WEBHOOK_BASE}/solicitud-prellenar-cliente`,
        listaRellenado:       `${WEBHOOK_BASE}/fa16b994-5af1-4368-ba6b-592e633937c3`,
        eliminarSolicitud:    `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,

        // Drive
        getDrive:             `${WEBHOOK_BASE}/2010bb2b-72e9-4bae-afb1-d5a937c59009`,
        docsSubidos:          `${WEBHOOK_BASE}/bdef8517-9b76-4640-8f82-d940fd0ab96b`,

        // Bajas
        bajas:                `${WEBHOOK_BASE}/84f094b2-9e55-448f-8ad9-f28721841873`,
        bajaCliente:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaLocal:            `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaModulos:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaEditar:           `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaBorrar:           `${WEBHOOK_BASE}/95d5ed5d-1139-45b9-88c2-3066bc49e45b`,

        // Distribución
        guardarDist:          `${WEBHOOK_BASE}/6d3ed726-c86a-4b86-a2ae-7f07da9630a5`,

        // Gestor de proyectos
        proyectos:            `${WEBHOOK_BASE}/proyectos`,
        proyectosTarea:       `${WEBHOOK_BASE}/proyectos/tarea`,
        proyectosTareaMover:  `${WEBHOOK_BASE}/proyectos/tarea/mover`,

        // Integraciones externas
        asanaTasks:           `${WEBHOOK_BASE}/asana/tasks`,
        asanaStories:         `${WEBHOOK_BASE}/asana/task/stories`,
        calendar:             `${WEBHOOK_BASE}/calendar/event`,

        // Formulario público (cliente rellena desde email)
        responderSolicitud:   `${WEBHOOK_BASE}/6da4274f-5a6d-4981-a92a-f9d7eb734144`,

        // Notificación cuando el comercial completa la ficha → dispara
        // email Drive al cliente + tarea Asana + email integraciones
        // (workflow 19). Antes vivían en el workflow 11 al recibir la
        // solicitud, ahora se difieren hasta que la ficha está lista.
        notificarFichaCompleta: `${WEBHOOK_BASE}/ficha/notificar-completa`,

        // Promociones (Customer Success): tandas de implementación con
        // 16 plazas (8 mañana + 8 tarde). El front lee vía /promociones
        // una vista con la ocupación ya calculada.
        promociones:          `${WEBHOOK_BASE}/promociones`,

        // Pedidos de hardware por proyecto — ciclo solicitada → proforma →
        // pago → lista_envío. Se consume desde proyecto.Hardware (crear),
        // contabilidad.Proformas (adjuntar PDF / confirmar) y soporte
        // Hardware envíos (ver proforma lista).
        hardwarePedidos:      `${WEBHOOK_BASE}/hardware/pedidos`,

        // Stock de hardware (departamento Soporte): catálogo de artículos
        // con stock actual, mínimo para alertas, precios y movimientos
        // (entradas / salidas / ajustes). Acciones: create, update,
        // archivar, reactivar, movimiento.
        hardwareStock:        `${WEBHOOK_BASE}/hardware/stock`,

        // Presupuestos (departamento Producto): desarrollos a medida por
        // cliente, con quién paga, estado de aprobación y de entrega.
        // Reemplaza el Excel que usaba Producto.
        presupuestos:         `${WEBHOOK_BASE}/presupuestos`,

        // Importador desde Asana: lista las tareas de la sección
        // "Pendiente de presupuesto" (gid 1210961912211323 del proyecto
        // Back Clientes) y permite generar presupuestos a partir de la
        // descripción + custom fields de cada tarea. POST con
        // { action: 'import'|'refresh', asana_gid }. Workflow n8n en
        // database/n8n-workflows/31-presupuestos-asana.json.
        presupuestosAsana:    `${WEBHOOK_BASE}/presupuestos-asana`,

        // Adjuntar el PDF del presupuesto generado a la tarea de Asana
        // de origen. El front genera el PDF con html2pdf, lo codifica a
        // base64 y lo POSTea aquí; n8n lo sube como attachment via
        // multipart a /tasks/{gid}/attachments. Workflow n8n en
        // database/n8n-workflows/32-presupuestos-asana-attach.json.
        presupuestosAsanaAttach: `${WEBHOOK_BASE}/presupuestos-asana-attach`,

        // Ofertas (departamento Comercial): ofertas generadas por el
        // configurador. Listado GET con filtros; GET con ?id=<uuid>
        // devuelve una sola. POST con `action` (create/update/archivar/
        // reactivar/cambiar_estado/vincular_ficha). Workflow n8n en
        // database/n8n-workflows/30-ofertas.json.
        ofertas:              `${WEBHOOK_BASE}/ofertas`,

        // Contabilidad
        grabadoA3:            `${WEBHOOK_BASE}/yurest-grabado-a3`,
        // Clientes A3 — lectura de Azure SQL (yurestazure / Info_PowerBI) a
        // través del workflow 39. Devuelve { ok, total, columnas, rows,
        // generated_at } para que clientes-a3.html pinte una tabla genérica
        // con auto-detección de columnas. La query del workflow se ajusta
        // en n8n; la página no envía SQL.
        clientesA3:           `${WEBHOOK_BASE}/contabilidad/clientes-a3`,

        // Notificaciones automáticas Integraciones
        notifIntConfig:       `${WEBHOOK_BASE}/notif-integraciones/config`,
        notifIntGrupos:       `${WEBHOOK_BASE}/notif-integraciones/grupos`,
        notifIntHistorial:    `${WEBHOOK_BASE}/notif-integraciones/historial`,

        // Auth y gestión de usuarios
        authLogin:            `${WEBHOOK_BASE}/auth/login`,
        authUsuarios:         `${WEBHOOK_BASE}/auth/usuarios`,
        authVerify:           `${WEBHOOK_BASE}/auth/verify`,

        // HighLevel (Customer Success) — listado de contactos del CRM.
        // El workflow 40-highlevel.json acepta ?limit (1-500), ?cursor
        // (searchAfter "ts,id" para encadenar páginas), ?q (búsqueda de
        // texto en toda la cuenta), ?tag y ?origen (filtros exactos server
        // -side, combinables entre sí y con q). Las credenciales (LOCATION_ID
        // + TOKEN) viven solo en n8n. contacto-notas devuelve las notas del
        // CRM de un contacto bajo demanda: { notas: [...], total }; tags
        // devuelve el catálogo de tags del location para poblar el filtro.
        highlevelContactos:     `${WEBHOOK_BASE}/highlevel/contactos`,
        highlevelContactoNotas: `${WEBHOOK_BASE}/highlevel/contacto-notas`,
        highlevelTags:          `${WEBHOOK_BASE}/highlevel/tags`,

        // HighLevel · Clientes ganados (Comercial / Contabilidad) — lee el
        // snapshot Supabase highlevel_clientes_snapshot (workflow 49 reader):
        // oportunidades ganadas de los 3 pipelines de venta enriquecidas con
        // contacto y business (tipo_de_cliente / id_bbdd / cif). Respuesta
        // idéntica a clientesA3: { ok, total, columnas, rows, generated_at }.
        // El snapshot lo refresca el workflow 50 (cron 6:30 UTC + endpoint
        // refresh on-demand; responde al instante y sincroniza ~2-4 min).
        highlevelClientesGanados: `${WEBHOOK_BASE}/highlevel/clientes-ganados`,
        highlevelClientesRefresh: `${WEBHOOK_BASE}/highlevel/clientes/refresh`,

        // Clientes Yurest vivos en producto SIN oportunidad ganada en HighLevel
        // (workflow 51). Devuelve { ok, total, total_prod, total_hl, refreshed_at,
        // clientes: [...prod_clientes_snapshot...] }. Match por prod_id↔id_bbdd
        // con fallback a CIF normalizado, mismo criterio que WF49.
        prodSinCrm:             `${WEBHOOK_BASE}/highlevel/prod-sin-crm`,

        // Historial de acciones (audit log por ficha)
        historial:            `${WEBHOOK_BASE}/historial`,

        // Historial de acciones por proyecto (timeline del gestor)
        proyectoHistorial:    `${WEBHOOK_BASE}/proyectos/historial`,

        // Mapa de calor de tickets Zendesk: GET con ?from=YYYY-MM-DD&to=YYYY-MM-DD.
        // Devuelve los tickets creados en el rango (esperamos created_at o,
        // pre-agregado, una matriz [day_of_week 0-6][hour 0-23] con counts).
        zendeskTicketsHeatmap: `${WEBHOOK_BASE}/zendesk/tickets-heatmap`,

        // Misma página que el heatmap normal pero INVERTIDA: solo
        // tickets que aún están en el agente IA de Zendesk (asunto
        // "Conversation with"). Sirve para medir cobertura del bot.
        zendeskTicketsHeatmapIA: `${WEBHOOK_BASE}/zendesk/tickets-heatmap-ia`,

        // Escalados de clientes (departamento Comercial): ampliaciones
        // contractuales sobre clientes existentes (módulos nuevos o nuevos
        // locales). GET lista los registros, POST crea uno nuevo en estado
        // 'pendiente'. La aplicación real sobre fichas/locales/sepa la hace
        // un workflow n8n cuando el escalado se confirma.
        escalados:            `${WEBHOOK_BASE}/escalados`,

        // Customer Success Kanban: POST para mover un cliente entre
        // columnas del seguimiento (en_implementacion → post_primer_mes →
        // …). Actualiza fichas_alta.cs_estado y registra en
        // cs_estado_historial. El listado de clientes con su cs_estado se
        // sirve desde el endpoint `altas` (workflow 04 ya devuelve la columna).
        csEstado:             `${WEBHOOK_BASE}/cs-estado`,

        // Resumen semanal de incidencias (Soporte): coge tickets Zendesk
        // de la semana, los manda a ChatGPT con tipo/entorno/módulo y
        // devuelve un resumen ejecutivo + top stats + lista bruta.
        // Acepta `?week=actual|anterior` o `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
        zendeskResumenSemanal: `${WEBHOOK_BASE}/zendesk/resumen-semanal`,

        // Resumen MENSUAL (workflow 29). Análisis profundo: top clientes
        // con módulos predominantes, distribución diaria, por estado,
        // patrones, recomendaciones, riesgos de churn. Modelo gpt-4o
        // (no mini) por la profundidad. Cache por (anio, mes) en
        // tabla resumenes_mensuales con UPSERT. Acepta `?refresh=1`.
        zendeskResumenMensual: `${WEBHOOK_BASE}/zendesk/resumen-mensual`,

        // ── Asociación cliente ↔ Zendesk org (clientes.html → Ver → Tickets) ──
        //
        // El flujo es de 3 pasos:
        //   1. zendeskOrgs (workflow 41) — lista todas las organizaciones
        //      de Zendesk con filtro server-side por nombre/external_id/
        //      details/notes. La UI del modal "Asociar" la usa para
        //      poblar el buscador.
        //   2. clienteZendeskLink (workflow 42) — PATCH fichas_alta
        //      seteando zendesk_org_id (o NULL para desvincular). Devuelve
        //      409 si esa org ya está asociada a otro cliente (UNIQUE
        //      parcial en la migración 2026-06-08_01).
        //   3. zendeskTicketsCliente (workflow 43) — devuelve los tickets
        //      de la org asociada en una ventana temporal (default 180d).
        //      La pestaña Tickets del modal de cliente la llama al abrirse.
        //
        // El mismo patrón se replicará luego para Asana (Desarrollos) y
        // la futura plataforma de Formación.
        zendeskOrgs:           `${WEBHOOK_BASE}/zendesk/orgs`,
        clienteZendeskLink:    `${WEBHOOK_BASE}/cliente/zendesk-link`,
        zendeskTicketsCliente: `${WEBHOOK_BASE}/zendesk/tickets-cliente`,

        // ── Pestaña Formación · proyecto de Asana asociado al cliente ──
        //
        // Patrón análogo al de Zendesk pero más simple — sólo 2 endpoints
        // porque no hay buscador (el CS pega la URL del proyecto a mano):
        //
        //   · clienteAsanaFormacionLink (workflow 44) — POST con
        //     {cliente_id, asana_url}; el backend extrae el GID de la URL
        //     (acepta classic /0/<gid>/ y new /1/.../project/<gid>/),
        //     verifica que el proyecto existe en Asana y, si sí, PATCH
        //     fichas_alta.asana_formacion_gid = <gid>. Devuelve el nombre
        //     del proyecto + permalink para mostrarlos en la cabecera.
        //     Pasar asana_url:null DESVINCULA.
        //
        //   · asanaFormacionTasks (workflow 45) — GET con ?project_gid=
        //     devuelve { project, counts:{done,pending,total}, tasks:[...] }
        //     leyendo /projects/<gid> y /projects/<gid>/tasks.
        //
        // Para Desarrollos (Asana) replicaremos esto con su propia
        // columna `asana_desarrollos_gid` cuando toque.
        clienteAsanaFormacionLink: `${WEBHOOK_BASE}/cliente/asana-formacion-link`,
        asanaFormacionTasks:       `${WEBHOOK_BASE}/asana/formacion-tasks`,

        // ── Yurest Prod — snapshot de uso del producto (cacheado en Supabase) ──
        //
        // Lectura instantánea desde la tabla `prod_clientes_snapshot` de
        // Supabase, que se rellena periódicamente con el resultado de la
        // query pesada al MySQL de producción del producto Yurest.
        //
        //   · prodClientes       (workflow 47): GET — lee el snapshot
        //     cacheado. Respuesta: { ok, total, refreshed_at, clientes:[…] }.
        //     refreshed_at indica cuándo se generó el snapshot actual; el
        //     front lo pinta como "última actualización hace Xh".
        //
        //   · prodClientesRefresh (workflow 48): POST a demanda — ejecuta
        //     la query MySQL y reescribe la tabla. También tiene cron
        //     diario a las 6am UTC. Respuesta: { ok, count, refreshed_at }.
        //     El botón Refrescar del front lo llama. Tarda 5-15s.
        //
        // Antes (V1): el GET tiraba la query MySQL en cada apertura → 5-15s
        // de latencia y carga sobre prod. Migración 2026-06-09_01 +
        // refactor de workflows resuelve esto.
        prodClientes:              `${WEBHOOK_BASE}/prod/clientes`,
        prodClientesRefresh:       `${WEBHOOK_BASE}/prod/clientes/refresh`,

        // Lista las secciones de un proyecto de Asana. Lo usa el front en la
        // pestaña Formación SÓLO cuando tipo_implementacion='grupal': el CS
        // pega la URL del proyecto, el front llama a este endpoint y muestra
        // un dropdown para que escoja qué sección representa al cliente.
        // Para implementación individual no se llama — basta con guardar el
        // project_gid.
        asanaProjectSections:      `${WEBHOOK_BASE}/asana/project-sections`
    };

    // Permisos disponibles (IDs de página). Debe coincidir con el CHECK de la
    // tabla usuarios en la migración 2026-04-21_01_usuarios.sql.
    const PERMISOS_DISPONIBLES = [
        { id: 'ventas',          label: 'Ventas',                  grupo: 'Informes'         },
        { id: 'distribucion',    label: 'Implementadores',         grupo: 'Informes'         },
        { id: 'informe_tickets',    label: 'Mapa de calor de tickets',     grupo: 'Informes'        },
        { id: 'informe_tickets_ia', label: 'Mapa de calor — Agente IA',    grupo: 'Informes'        },
        { id: 'lista',         label: 'Fichas de cliente',    grupo: 'Comercial'        },
        { id: 'escalados',     label: 'Escalados de clientes', grupo: 'Comercial'       },
        { id: 'configurador',  label: 'Configurador de oferta', grupo: 'Comercial'       },
        { id: 'ofertas',       label: 'Ofertas generadas',      grupo: 'Comercial'       },
        { id: 'sinasignar',    label: 'Sin asignar',          grupo: 'Implementación'   },
        { id: 'proyectos',     label: 'Proyectos',            grupo: 'Implementación'   },
        { id: 'panel_sesiones', label: 'Panel de sesiones CS', grupo: 'Implementación'  },
        { id: 'contabilidad',  label: 'Grabar en A3',         grupo: 'Contabilidad'     },
        { id: 'clientes_a3',   label: 'Clientes A3',          grupo: 'Contabilidad'     },
        { id: 'proformas',     label: 'Pagos de proformas',     grupo: 'Contabilidad'   },
        { id: 'clientes',      label: 'Clientes',             grupo: 'Customer Success' },
        { id: 'estado_clientes_yurest', label: 'Estado clientes Yurest', grupo: 'Customer Success' },
        { id: 'cs_kanban',     label: 'Kanban CS',             grupo: 'Customer Success' },
        { id: 'bajas',         label: 'Bajas',                grupo: 'Customer Success' },
        { id: 'promociones',   label: 'Promociones',          grupo: 'Customer Success' },
        { id: 'highlevel',           label: 'HighLevel · Contactos',       grupo: 'Customer Success' },
        { id: 'highlevel_clientes',  label: 'HighLevel · Clientes ganados',grupo: 'Customer Success' },
        { id: 'huerfanos_prod',      label: 'Clientes Yurest sin CRM',     grupo: 'Customer Success' },
        { id: 'presupuestos',  label: 'Presupuestos',         grupo: 'Producto'         },
        { id: 'integraciones', label: 'Integraciones',        grupo: 'Soporte'          },
        { id: 'hardware',      label: 'Hardware envíos',      grupo: 'Soporte'          },
        { id: 'stock',         label: 'Stock hardware',       grupo: 'Soporte'          },
        { id: 'resumen_semanal',             label: 'Resumen semanal',                grupo: 'Soporte' },
        { id: 'resumen_mensual',             label: 'Resumen mensual',                grupo: 'Soporte' },
        { id: 'documentacion_integraciones', label: 'Documentación de integraciones', grupo: 'Soporte' },
        { id: 'admin',         label: 'Administración',       grupo: 'Admin'            },
        { id: 'docs',          label: 'Documentación',        grupo: 'Otros'            }
    ];

    // ──────────────────────────────────────────────────────────
    //  CONSTANTES
    // ──────────────────────────────────────────────────────────
    const SESSION_KEY = 'yurest_auth';
    // Siempre persistimos en localStorage para que la sesión sea visible
    // en todas las pestañas. El flag `persistent` sólo controla el TTL:
    //   - marcado:    30 días
    //   - sin marcar:  8 horas
    // (Antes la sesión efímera vivía en sessionStorage, lo que obligaba
    // a re-loguearse al abrir una pestaña nueva — sessionStorage no se
    // comparte entre pestañas.)
    const SESSION_TTL_MS      = 8  * 60 * 60 * 1000;       // 8 horas
    const SESSION_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000;  // 30 días
    const LAST_USER_KEY = 'yurest_last_user';
    // Bump cuando cambie el shape del payload de sesión. Sesiones con una
    // versión distinta se descartan al recargar (evita que alguien con sesión
    // vieja sin `rol`/`permisos` vea el portal con permisos vacíos).
    const SESSION_VERSION = 2;

    // Catálogo maestro de hardware. Espejo del HARDWARE_CATALOGO de
    // js-gestor/data.js (que se usa al pedir una proforma desde el
    // gestor de proyectos). Lo replicamos aquí para que cualquier
    // página del portal pueda leerlo sin tener que cargar el bundle
    // pesado de js-gestor.
    //
    // ⚠️ Si actualizas uno, actualiza el otro — son fuente única
    // pero viven en dos sitios por compatibilidad de carga.
    const HARDWARE_CATALOGO = [
        {
            grupo: 'Etiquetas',
            icon:  '🏷️',
            items: [
                { id: 'etq_s',  nombre: 'Etiqueta S (sencilla)',  formato: '57×32 mm · 2000 uds/rollo',  precio: 12.25, unidad: 'rollo' },
                { id: 'etq_m',  nombre: 'Etiqueta M (avanzada)',  formato: '57×58 mm · 1000 uds/rollo',  precio: 9.20,  unidad: 'rollo' },
                { id: 'etq_l',  nombre: 'Etiqueta L (completa)',  formato: '60×120 mm · 500 uds/rollo',  precio: 8.90,  unidad: 'rollo' },
                { id: 'etq_xl', nombre: 'Etiqueta XL (completa)', formato: '100×100 mm · 800 uds/rollo', precio: 13.90, unidad: 'rollo' }
            ]
        },
        {
            grupo: 'Hardware',
            icon:  '💻',
            items: [
                { id: 'imp_zebra_zd',    nombre: 'Impresora Zebra ZD',                  precio: 300 },
                { id: 'kds_pcp_215',     nombre: 'Pantalla KDS PCP-215',                formato: '21.5" Windows',           precio: 665 },
                { id: 'lector_hwvoy',    nombre: 'Lector Honeywell Voyager XP 1472G',   precio: 300 },
                { id: 'zebra_tc22',      nombre: 'Zebra TC22',                          formato: 'ordenador móvil Android', precio: 650 },
                { id: 'tablet_a9',       nombre: 'Tablet Samsung Tab A9+',              formato: '11"',                     precio: 250 },
                { id: 'bascula_gram_30', nombre: 'Báscula Gram WiFi – hasta 30 kg',     precio: 625 },
                { id: 'bascula_gram_150',nombre: 'Báscula Gram WiFi – hasta 150 kg',    precio: 775 },
                { id: 'dobbox_s1',       nombre: 'Sensor temperatura/humedad doBBox S1',precio: 158 },
                { id: 'dobbox_g15',      nombre: 'Receptor WiFi doBBox G15',            precio: 98  }
            ]
        },
        {
            grupo: 'Soportes y Fundas',
            icon:  '🖇️',
            items: [
                { id: 'sop_tab_ext',   nombre: 'Soporte tablet extensible y rotatorio',           precio: 50 },
                { id: 'sop_tab_reg',   nombre: 'Soporte tablet sencillo regulable',                precio: 30 },
                { id: 'sop_tab_pared', nombre: 'Soporte tablet fijo de pared (aluminio)',         precio: 70 },
                { id: 'sop_kds_movil', nombre: 'Soporte KDS VESA móvil de pared',                 precio: 35 },
                { id: 'sop_kds_fijo',  nombre: 'Soporte KDS VESA fijo de pared',                  precio: 20 },
                { id: 'sop_kds_ancl',  nombre: 'Soporte KDS VESA con anclaje a mesa',             precio: 50 },
                { id: 'sop_kds_mesa',  nombre: 'Soporte KDS VESA de mesa (sin anclaje)',          precio: 50 },
                { id: 'funda_antic',   nombre: 'Funda anticaída con soporte giratorio y correas', precio: 34 }
            ]
        }
        // Nota: el grupo "Envío" del catálogo de data.js se excluye aquí
        // porque "Gastos de envío" no es un dispositivo que se inventaríe
        // en stock — es un cargo de proforma.
    ];

    const IMPLEMENTADORES = [
        'Carlos Aparicio',
        'Mario Labrandero',
        'Hugo Zalazar',
        'Rino Luigi'
    ];

    // ──────────────────────────────────────────────────────────
    //  SESIÓN — helpers de autenticación
    // ──────────────────────────────────────────────────────────
    /**
     * Devuelve la sesión activa desde localStorage. Si encontramos una
     * sesión vieja en sessionStorage (creada antes del fix multi-pestaña),
     * la migramos a localStorage para que sea visible en otras pestañas.
     * Devuelve null si no hay sesión, si la versión es antigua, si está
     * caducada o si la BD ha registrado un sessions_revoked_at posterior
     * al login.
     * @returns {Session|null}
     */
    function getSession() {
        try {
            const rawL = localStorage.getItem(SESSION_KEY);
            const rawS = sessionStorage.getItem(SESSION_KEY);
            let sessionL = null, sessionS = null;
            try { sessionL = rawL ? JSON.parse(rawL) : null; } catch (_) {}
            try { sessionS = rawS ? JSON.parse(rawS) : null; } catch (_) {}

            // Migración: si sólo había sesión en sessionStorage (esquema
            // antiguo), la promovemos a localStorage y limpiamos.
            if (sessionS && !sessionL) {
                try { localStorage.setItem(SESSION_KEY, rawS); } catch (_) {}
                try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
            }

            const candidates = [sessionS, sessionL].filter(x => x && x.ts);
            if (candidates.length === 0) return null;
            const s = candidates.sort((a, b) => b.ts - a.ts)[0];

            if (s.v !== SESSION_VERSION) {
                // Sesión con shape antiguo → descartamos en AMBOS stores
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
                return null;
            }

            const ttl = s.persistent ? SESSION_TTL_LONG_MS : SESSION_TTL_MS;
            if (Date.now() - s.ts > ttl) {
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return s;
        } catch (_) {
            return null;
        }
    }

    /**
     * Guarda la sesión en localStorage para que esté disponible en todas
     * las pestañas. El flag `data.persistent` controla el TTL (30 días vs
     * 8 horas, ver getSession). Añade automáticamente `ts` (timestamp) y
     * `v` (SESSION_VERSION).
     * @param {Session & {persistent?: boolean, username?: string}} data
     * @returns {void}
     */
    function setSession(data) {
        const payload = { ...data, ts: Date.now(), v: SESSION_VERSION };
        const raw = JSON.stringify(payload);
        localStorage.setItem(SESSION_KEY, raw);
        // Limpiamos cualquier sesión en sessionStorage del esquema viejo.
        sessionStorage.removeItem(SESSION_KEY);
        // Recordar el último username para pre-rellenar el login la próxima
        // vez, aunque NO se marque "Recordar sesión". Sólo guardamos el
        // nombre, nunca la contraseña.
        if (data && (data.username || data.user)) {
            try { localStorage.setItem(LAST_USER_KEY, String(data.username || data.user)); } catch (_) {}
        }
    }

    function clearSession() {
        // Borramos la sesión en ambas ubicaciones. Mantenemos el
        // LAST_USER_KEY intencionalmente para que al volver a entrar el
        // username aparezca pre-rellenado — si el usuario quiere olvidarlo,
        // puede limpiarlo a mano desde el formulario de login.
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('yurest_fichas');
    }

    // Devuelve el último username usado para login (o '' si no hay).
    function getLastUser() {
        try { return localStorage.getItem(LAST_USER_KEY) || ''; } catch (_) { return ''; }
    }
    function forgetLastUser() {
        try { localStorage.removeItem(LAST_USER_KEY); } catch (_) {}
    }

    /**
     * Verifica que haya sesión activa. Si se pasa `permisoRequerido` (el ID
     * de la página actual), además comprueba que el usuario tiene acceso —
     * si no lo tiene, lo redirige a home en vez de a login.
     *
     * Además (asíncrono, sin bloquear): valida contra el backend que la
     * sesión no haya sido revocada por un admin. Si `sessions_revoked_at`
     * es más reciente que el snapshot de la sesión, o el usuario está
     * desactivado/borrado, forzamos logout.
     * @param {PageId} [permisoRequerido] PageId requerido para entrar
     * @returns {boolean} true si pasa todas las comprobaciones síncronas
     */
    function requireAuth(permisoRequerido) {
        const s = getSession();
        if (!s) {
            window.location.replace('login.html');
            return false;
        }
        if (permisoRequerido && !tienePermiso(permisoRequerido)) {
            try { sessionStorage.setItem('yurest_permiso_denegado', permisoRequerido); } catch (_) {}
            window.location.replace('index.html');
            return false;
        }
        // Validación diferida (no bloqueante): corre en background
        _validateSessionFresh();
        return true;
    }

    // Stringify estable de permisos para comparar dos snapshots sin que
    // un orden distinto en read/write/delete provoque un update falso
    // en `_validateSessionFresh`. Espera el shape granular
    //   { read: [...], write: [...], delete: [...] }
    // Cualquier otro tipo se normaliza a 'null'.
    function _stableStringifyPerms(p) {
        if (p == null || typeof p !== 'object') return 'null';
        const keys = Object.keys(p).sort();
        const norm = {};
        for (const k of keys) {
            const v = p[k];
            norm[k] = Array.isArray(v) ? [...v].map(String).sort() : v;
        }
        return JSON.stringify(norm);
    }

    // Llama al endpoint /auth/verify para ver si la sesión fue revocada por
    // un admin (cambio de permisos, rol, desactivación o borrado). Si sí,
    // forzamos logout con un aviso. Silencioso si el endpoint falla (red
    // caída, etc.) — no queremos que un fallo transitorio cierre sesiones.
    async function _validateSessionFresh() {
        const s = getSession();
        if (!s || !s.id) return;
        try {
            const rawUrl = `${ENDPOINTS.authVerify}?userId=${encodeURIComponent(s.id)}`;
            // Reescribir a Laravel si el flag está activo. Sin esto el verify
            // periódico golpea n8n con un token Sanctum que n8n no entiende
            // y devuelve "usuario no encontrado" → falsamente nos saca al login.
            const url = rewriteForLaravel(rawUrl, 'GET');
            const res = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
            if (!res.ok) return;  // fallo transitorio: no invalidamos
            const data = await res.json().catch(() => null);
            if (!data) return;

            // Si el backend dice que el usuario no es válido (borrado,
            // desactivado) → forzar logout.
            if (data.ok === false) {
                clearSession();
                try { sessionStorage.setItem('yurest_sesion_revocada', '1'); } catch (_) {}
                window.location.replace('login.html');
                return;
            }

            // Comparar sessions_revoked_at: si el servidor tiene uno más
            // reciente que el snapshot de la sesión, el admin cambió algo.
            const srvTs = data.sessions_revoked_at ? new Date(data.sessions_revoked_at).getTime() : 0;
            const locTs = s.sessions_revoked_at ? new Date(s.sessions_revoked_at).getTime() : 0;
            if (srvTs > locTs) {
                clearSession();
                try { sessionStorage.setItem('yurest_sesion_revocada', '1'); } catch (_) {}
                window.location.replace('login.html');
                return;
            }

            // Si no hubo revocación pero los permisos o el rol cambiaron,
            // actualizamos el snapshot en la sesión en silencio para que la
            // UI refleje los cambios en la próxima carga. Esperamos el
            // shape granular `{read, write, delete}` desde la migración
            // 2026-04-30_03; cualquier otro valor se normaliza al objeto
            // vacío equivalente para no romper.
            let permisosNuevos = data.permisos;
            if (permisosNuevos == null || typeof permisosNuevos !== 'object' || Array.isArray(permisosNuevos)) {
                permisosNuevos = { read: [], write: [], delete: [] };
            }
            const permisosIguales = _stableStringifyPerms(s.permisos) === _stableStringifyPerms(permisosNuevos);
            if (data.rol !== s.rol || !permisosIguales) {
                setSession({ ...s, rol: data.rol, permisos: permisosNuevos });
            }
        } catch (_) {
            // Red caída u otro fallo: no hacemos nada
        }
    }

    // ──────────────────────────────────────────────────────────
    //  PERMISOS — shape único `{read, write, delete}` desde la
    //  migración 2026-04-30_03_permisos_granulares.sql. El array
    //  plano legacy (`["clientes","lista"]`) ya no existe en BD.
    //
    //  Cada lista contiene PageIds independientes — un usuario
    //  puede tener LECTURA pero no ESCRITURA sobre la misma página.
    //
    //  Helpers expuestos:
    //    · getPermisos()      — array plano de PageIds con CUALQUIER acceso.
    //    · tienePermiso(id)   — TRUE si está en read/write/delete.
    //                           Equivale a "puede ENTRAR a la página".
    //    · puedeLeer(id)      — TRUE si está en read.
    //    · puedeEscribir(id)  — TRUE si está en write.
    //    · puedeBorrar(id)    — TRUE si está en delete.
    //
    //  Admin (rol='admin') tiene siempre TRUE en todas.
    // ──────────────────────────────────────────────────────────

    // Helper interno: extrae los permisos del usuario actual y los
    // expone como Sets para lookup O(1). Tolerante a `permisos` null
    // o con un shape inesperado: devuelve sets vacíos en lugar de
    // crashear.
    function _normalizarPermisosUsuario(s) {
        const out = { read: new Set(), write: new Set(), delete: new Set(), todos: new Set() };
        if (!s) return out;
        if (s.rol === 'admin') {
            // Admin: marcamos todos los PageIds disponibles en las 3 sets.
            PERMISOS_DISPONIBLES.forEach(p => {
                out.read.add(p.id);
                out.write.add(p.id);
                out.delete.add(p.id);
                out.todos.add(p.id);
            });
            return out;
        }
        const p = s.permisos;
        if (p && typeof p === 'object' && !Array.isArray(p)) {
            (p.read   || []).forEach(id => { out.read.add(String(id));   out.todos.add(String(id)); });
            (p.write  || []).forEach(id => { out.write.add(String(id));  out.todos.add(String(id)); });
            (p.delete || []).forEach(id => { out.delete.add(String(id)); out.todos.add(String(id)); });
        }
        return out;
    }

    /**
     * Devuelve la lista de PageIds a los que el usuario tiene CUALQUIER
     * tipo de acceso (read OR write OR delete). Útil para filtrar el
     * sidebar / dashboard. Para admin devuelve todos los PageIds disponibles.
     * @returns {PageId[]}
     */
    function getPermisos() {
        const s = getSession();
        if (!s) return [];
        return [...(_normalizarPermisosUsuario(s).todos)];
    }

    /**
     * TRUE si el usuario tiene CUALQUIER tipo de acceso a esa página
     * (equivale a "puede entrar"). Para chequear permiso fino usar
     * puedeLeer / puedeEscribir / puedeBorrar.
     * @param {PageId} pageId
     * @returns {boolean}
     */
    function tienePermiso(pageId) {
        if (!pageId) return false;
        const s = getSession();
        if (!s) return false;
        if (s.rol === 'admin') return true;
        return _normalizarPermisosUsuario(s).todos.has(String(pageId));
    }

    /**
     * TRUE si el usuario tiene permiso de LECTURA sobre la página.
     * Admin siempre TRUE.
     * @param {PageId} pageId
     * @returns {boolean}
     */
    function puedeLeer(pageId) {
        if (!pageId) return false;
        const s = getSession();
        if (!s) return false;
        if (s.rol === 'admin') return true;
        return _normalizarPermisosUsuario(s).read.has(String(pageId));
    }

    /**
     * TRUE si el usuario tiene permiso de ESCRITURA (crear / editar) sobre
     * la página. Admin siempre TRUE.
     * @param {PageId} pageId
     * @returns {boolean}
     */
    function puedeEscribir(pageId) {
        if (!pageId) return false;
        const s = getSession();
        if (!s) return false;
        if (s.rol === 'admin') return true;
        return _normalizarPermisosUsuario(s).write.has(String(pageId));
    }

    /**
     * TRUE si el usuario tiene permiso de BORRADO sobre la página.
     * Admin siempre TRUE.
     * @param {PageId} pageId
     * @returns {boolean}
     */
    function puedeBorrar(pageId) {
        if (!pageId) return false;
        const s = getSession();
        if (!s) return false;
        if (s.rol === 'admin') return true;
        return _normalizarPermisosUsuario(s).delete.has(String(pageId));
    }

    /**
     * TRUE si el usuario actual tiene rol 'admin'.
     * @returns {boolean}
     */
    function esAdmin() {
        const s = getSession();
        return !!(s && s.rol === 'admin');
    }

    /**
     * Datos del usuario activo o null si no hay sesión. Útil para mostrar
     * en UI (saludo, header). Devuelve los permisos sin normalizar — para
     * chequear acceso usar tienePermiso/puedeLeer/puedeEscribir/puedeBorrar.
     * @returns {{id:string|null,username:string,nombre:string,email:string,rol:RolUsuario,permisos:Permisos}|null}
     */
    function getUsuario() {
        const s = getSession();
        if (!s) return null;
        return {
            id:       s.id || null,
            username: s.user || s.username || '',
            nombre:   s.nombre || s.user || '',
            email:    s.email || '',
            rol:      s.rol || 'user',
            // permisos granulares { read, write, delete } tal cual los emitió la BD
            permisos: s.permisos
        };
    }

    /**
     * Headers HTTP para llamadas al backend. Incluye Content-Type JSON +
     * Basic auth con las credenciales compartidas n8n. Mezcla extras al
     * final para permitir override.
     * @param {Record<string,string>} [extra] Headers adicionales / overrides
     * @returns {Record<string,string>}
     */
    function getAuthHeaders(extra) {
        const s = getSession();
        const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
        // En modo Laravel siempre añadimos Accept para que la API devuelva
        // JSON aunque el endpoint dispare un error de validación o auth.
        if (getBackendMode() === 'laravel') {
            headers['Accept'] = 'application/json';
            // Bearer token Sanctum; cae a Basic si aún no hay token (login).
            if (s && s.token && s.token !== 'authenticated') {
                headers['Authorization'] = 'Bearer ' + s.token;
                return headers;
            }
        }
        if (s && s.basicAuth) headers['Authorization'] = 'Basic ' + s.basicAuth;
        return headers;
    }

    // Indicador global de peticiones en curso. Se inyecta una sola vez
    // en cualquier página que use apiFetch y se muestra/oculta según el
    // contador de fetches activos. No requiere markup en cada HTML.
    let _inflightCount = 0;
    function _ensureInflightEl() {
        if (typeof document === 'undefined') return null;
        let el = document.getElementById('yurest-inflight');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'yurest-inflight';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = [
            'position:fixed', 'right:18px', 'bottom:18px', 'z-index:9999',
            'display:none', 'align-items:center', 'gap:8px',
            'padding:8px 14px', 'border-radius:999px',
            'background:rgba(15,23,42,.92)', 'color:#fff',
            // Fuente corporativa Bw Modelica (cargada vía fonts.css/style.css);
            // si por algún motivo no estuviera disponible, los fallbacks system
            // mantienen legibilidad sin romper layout.
            "font:600 12px 'Bw Modelica SS01', 'Bw Modelica', system-ui, -apple-system, sans-serif",
            'letter-spacing:.02em',
            'box-shadow:0 6px 18px rgba(15,23,42,.18)',
            'pointer-events:none', 'transition:opacity .18s'
        ].join(';');
        el.innerHTML =
            '<span style="display:inline-block;width:14px;height:14px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:yurest-spin .7s linear infinite"></span>' +
            '<span id="yurest-inflight-txt">Cargando…</span>';
        // Inyectamos la animación una vez.
        if (!document.getElementById('yurest-inflight-style')) {
            const st = document.createElement('style');
            st.id = 'yurest-inflight-style';
            st.textContent = '@keyframes yurest-spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(st);
        }
        const attach = () => { if (document.body) document.body.appendChild(el); };
        if (document.body) attach();
        else document.addEventListener('DOMContentLoaded', attach, { once: true });
        return el;
    }
    function _bumpInflight(delta) {
        _inflightCount = Math.max(0, _inflightCount + delta);
        const el = _ensureInflightEl();
        if (!el) return;
        if (_inflightCount > 0) {
            const txt = document.getElementById('yurest-inflight-txt');
            if (txt) txt.textContent = _inflightCount === 1
                ? 'Cargando…'
                : 'Cargando · ' + _inflightCount + ' peticiones';
            el.style.display = 'inline-flex';
            el.style.opacity = '1';
        } else {
            el.style.opacity = '0';
            // Pequeño delay antes de ocultar para evitar parpadeos al
            // encadenar peticiones rápidas.
            setTimeout(() => { if (_inflightCount === 0) el.style.display = 'none'; }, 180);
        }
    }

    // Fetch con:
    //   · manejo automático de 401/403 → redirige a login,
    //   · contador global de peticiones en vuelo (indicador "Cargando…"),
    //   · deduplicación de GETs idénticos en vuelo (varios consumidores
    //     piden la misma URL y se hace UNA sola llamada de red),
    //   · timeout duro de 30s para que el indicador no se quede colgado
    //     si n8n tarda eternamente.
    const _inflightGet = new Map(); // url → Promise<Response>
    const FETCH_TIMEOUT_MS = 30000;

    function _abortAfter(ms) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
        return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
    }

    async function _doFetchTracked(url, opts) {
        _bumpInflight(+1);
        // Timeout efectivo: opts.timeoutMs si el caller lo especifica, si no
        // el default de 30s. Útil para endpoints lentos (p.ej. HighLevel
        // paginado, descargas de PDFs grandes) que pueden tardar minutos.
        const timeoutMs = (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0)
            ? opts.timeoutMs
            : FETCH_TIMEOUT_MS;
        const t = _abortAfter(timeoutMs);
        // No pisamos un AbortSignal pasado por el caller — si lo pasó, lo
        // respetamos; si no, usamos el nuestro de timeout.
        const finalOpts = { ...opts, signal: opts.signal || t.signal };
        // timeoutMs no es una opción nativa de fetch — la quitamos antes
        // de pasar a window.fetch (evita warning en algunos browsers).
        delete finalOpts.timeoutMs;
        try {
            const res = await fetch(url, finalOpts);
            if (res.status === 401 || res.status === 403) {
                clearSession();
                window.location.replace('login.html');
                throw new Error('Sesión expirada');
            }
            return res;
        } catch (err) {
            // Mensaje legible para timeout (DOMException de AbortError).
            if (err && (err.name === 'AbortError' || /timeout/i.test(String(err.message || '')))) {
                throw new Error('La petición tardó más de ' + (timeoutMs / 1000) + 's y se canceló');
            }
            throw err;
        } finally {
            t.cancel();
            _bumpInflight(-1);
        }
    }

    async function apiFetch(url, options) {
        const opts = { ...(options || {}) };
        opts.headers = { ...getAuthHeaders(), ...(opts.headers || {}) };
        const method = String(opts.method || 'GET').toUpperCase();
        // Reescribe la URL al backend Laravel si el modo está activo y
        // hay mapping. Pasa el método para resolver paths multi-método.
        // Las URLs sin mapping siguen tal cual (degradación a n8n).
        url = rewriteForLaravel(url, method);

        // Solo deduplicamos GETs (los POST/PATCH son acciones, no idempotentes
        // a nivel de respuesta). Si llega un GET con AbortSignal propio del
        // caller no podemos compartir promesa, así que tampoco se dedupe.
        if (method !== 'GET' || opts.signal) {
            return _doFetchTracked(url, opts);
        }

        const key = method + ' ' + url;
        if (_inflightGet.has(key)) {
            // Hay una petición idéntica en vuelo — devolvemos un clon de su
            // Response para que cada consumidor pueda leer el body con
            // .json()/.text() de forma independiente.
            return _inflightGet.get(key).then(r => r.clone());
        }
        const p = _doFetchTracked(url, opts);
        _inflightGet.set(key, p);
        // Liberar la entrada al terminar (éxito o fallo) para que un fetch
        // posterior vuelva a hit a red.
        p.finally(() => { _inflightGet.delete(key); });
        return p.then(r => r.clone());
    }

    function cerrarSesion() {
        // Pedimos confirmación — varios usuarios reportaron clicks accidentales
        // sobre el botón del sidebar tras venir del menú. confirm() nativo
        // basta porque la acción no requiere fricción extra (solo evitar
        // los falsos positivos por dedazo).
        if (!window.confirm('¿Cerrar sesión?')) return;
        clearSession();
        window.location.replace('login.html');
    }

    // ──────────────────────────────────────────────────────────
    //  UTILIDADES COMUNES
    // ──────────────────────────────────────────────────────────

    /**
     * Formatea una fecha para los listados de UI con un par de modos
     * estandarizados — antes cada página tenía su propio toLocaleDateString
     * con opciones distintas (mezcla de "23 abr 2026" y "23/04/2026" y
     * "Sábado, 23 de abril..."), lo que rompía la consistencia visual de
     * las tablas. Ahora todo el portal pasa por aquí.
     *
     * Devuelve '—' si la entrada es null/undefined/'' o no parsea como
     * fecha válida — el listado nunca debería pintar "Invalid Date".
     *
     * @param {Date|string|number|null|undefined} v Valor a formatear
     * @param {'short'|'numeric'|'datetime'|'long'} [modo] Modo de salida
     *   - 'short'    → "23 abr 2026"           (default — listados generales)
     *   - 'numeric'  → "23/04/2026"            (tablas densas)
     *   - 'datetime' → "23 abr 2026, 13:45"    (auditoría, timestamps)
     *   - 'long'     → "sábado, 23 de abril de 2026"  (encabezados)
     * @returns {string}
     */
    function formatDate(v, modo) {
        if (v == null || v === '') return '—';
        const d = (v instanceof Date) ? v : new Date(v);
        if (isNaN(d.getTime())) return '—';
        const m = modo || 'short';
        if (m === 'numeric') {
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        if (m === 'datetime') {
            return d.toLocaleString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        if (m === 'long') {
            return d.toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
        }
        // 'short' (default)
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    /**
     * Escapa texto para insertar como contenido HTML. Seguro frente a XSS.
     * Convierte null/undefined a string vacío.
     * @param {*} text
     * @returns {string}
     */
    function escHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escapa texto para un atributo HTML entrecomillado con ". Seguro frente a XSS.
    function escAttr(text) {
        return escHtml(text);
    }

    // Escapa un string para ser inyectado DENTRO de un literal JavaScript
    // entrecomillado con ' dentro de un atributo HTML (p.ej. onclick="foo('...')")
    // No es la opción preferida — mejor usar addEventListener — pero evita romper
    // cuando no queda más remedio.
    function escJsInAttr(text) {
        return String(text == null ? '' : text)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, '\\x27')
            .replace(/"/g, '&quot;')
            .replace(/</g, '\\x3c')
            .replace(/>/g, '\\x3e')
            .replace(/&/g, '&amp;')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    // Genera un ID único usando crypto.randomUUID cuando está disponible
    function generarId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback razonable
        return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Devuelve la URL pública base del portal, incluyendo el path-prefix del
     * deploy (en GitHub Pages el portal vive bajo `/Yurest/`, no en la raíz).
     * Sin esta función, los workflows que envían links al cliente
     * (oferta-enviar-comercial, fichas, etc.) ensamblan URLs tipo
     * `https://alexak98.github.io/oferta.html?t=...` — 404 garantizado porque
     * el host es user-pages pero el proyecto vive bajo `/Yurest/`.
     *
     * Ejemplos:
     *   · https://alexak98.github.io/Yurest/ofertas.html  → https://alexak98.github.io/Yurest
     *   · https://alexak98.github.io/Yurest/              → https://alexak98.github.io/Yurest
     *   · http://localhost:8091/ofertas.html              → http://localhost:8091
     *
     * @returns {string} URL absoluta sin slash final.
     */
    function getPortalBaseUrl() {
        try {
            const origin = window.location.origin;
            // Elimina el último segmento (filename con extensión, p.ej.
            // 'ofertas.html'). Conserva el resto del path como prefijo.
            const dir = window.location.pathname.replace(/[^/]+$/, '');
            return (origin + dir).replace(/\/$/, '');
        } catch (_) {
            return 'https://portal.yurest.es';
        }
    }

    // ──────────────────────────────────────────────────────────
    //  FORMATO EUROS — Intl.NumberFormat cacheado (REPLICADO en
    //  js/lib/format.js; mantener AMBOS sincronizados hasta la
    //  Fase 2.b). Reutilizar la instancia es ~5-10× más rápido
    //  que construir las opciones en cada llamada.
    // ──────────────────────────────────────────────────────────
    const _EUR_2 = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const _EUR_0 = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0
    });
    const _EUR_AUTO = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 2
    });
    const _NUM_2 = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const _NUM_AUTO = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 0, maximumFractionDigits: 2
    });

    // opts.decimales: 0 (sin decimales), 2 (default), 'auto' (0-2 sin
    // ceros sobrantes). opts.conSimbolo: false omite el ' €'.
    function formatEur(v, opts) {
        if (v == null || v === '') return '—';
        const n = typeof v === 'number' ? v : parseFloat(v);
        if (!isFinite(n)) return '—';
        const dec = opts && opts.decimales;
        const conSimbolo = !opts || opts.conSimbolo !== false;
        if (!conSimbolo) return dec === 'auto' ? _NUM_AUTO.format(n) : _NUM_2.format(n);
        if (dec === 0)      return _EUR_0.format(n);
        if (dec === 'auto') return _EUR_AUTO.format(n);
        return _EUR_2.format(n);
    }

    function parseEur(v) {
        if (v == null || v === '') return NaN;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/[€\s]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
        const n = parseFloat(s);
        return isFinite(n) ? n : NaN;
    }

    // ──────────────────────────────────────────────────────────
    //  VALIDADORES (REPLICADOS en js/lib/validators.js)
    //  Antes vivían 3 copias casi idénticas en index.html (2170-
    //  2305), solicitud.html (876-893) y sinasignar.html. Una
    //  sola fuente; los call-sites pueden migrar progresivamente
    //  via YurestConfig.validators.esCIFValido(v).
    // ──────────────────────────────────────────────────────────
    const _DNI_LETRAS    = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const _CIF_LETRAS    = 'JABCDEFGHI';
    const _CIF_SOLO_LETRA = 'KPQRSNW';

    function esDNIValido(v) {
        v = (v || '').toUpperCase().trim();
        if (!/^[0-9]{8}[A-Z]$/.test(v)) return false;
        const num = parseInt(v.slice(0, 8), 10);
        return v[8] === _DNI_LETRAS[num % 23];
    }
    function esNIEValido(v) {
        v = (v || '').toUpperCase().trim();
        if (!/^[XYZ][0-9]{7}[A-Z]$/.test(v)) return false;
        const primer = { X: '0', Y: '1', Z: '2' }[v[0]];
        const num = parseInt(primer + v.slice(1, 8), 10);
        return v[8] === _DNI_LETRAS[num % 23];
    }
    function esCIFEmpresaValido(v) {
        v = (v || '').toUpperCase().trim();
        if (!/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(v)) return false;
        const digits = v.slice(1, 8);
        let sumaPar = 0, sumaImpar = 0;
        for (let i = 0; i < 7; i++) {
            const n = parseInt(digits[i], 10);
            if (i % 2 === 0) {
                const doble = n * 2;
                sumaImpar += Math.floor(doble / 10) + (doble % 10);
            } else {
                sumaPar += n;
            }
        }
        const unidad = (10 - ((sumaPar + sumaImpar) % 10)) % 10;
        const letraControl = _CIF_LETRAS[unidad];
        const control = v[8];
        if (_CIF_SOLO_LETRA.indexOf(v[0]) !== -1) return control === letraControl;
        return control === String(unidad) || control === letraControl;
    }
    function esCIFValido(v) {
        return esCIFEmpresaValido(v) || esDNIValido(v) || esNIEValido(v);
    }
    function esIBANValido(v) {
        v = (v || '').toUpperCase().replace(/\s+/g, '');
        if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false;
        const reordenado = v.slice(4) + v.slice(0, 4);
        let acc = '';
        for (const c of reordenado) {
            acc += /[0-9]/.test(c) ? c : (c.charCodeAt(0) - 55).toString();
        }
        let rem = 0;
        for (let i = 0; i < acc.length; i += 7) {
            rem = parseInt(String(rem) + acc.substr(i, 7), 10) % 97;
        }
        return rem === 1;
    }
    function esEmailValido(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
    function esTelefonoValido(v) {
        return !v || /^[+\d\s().-]{6,20}$/.test(v);
    }
    function esCPValido(v) {
        return !v || /^[0-9]{5}$/.test(String(v).trim());
    }
    const validators = {
        esCIFValido, esCIFEmpresaValido, esDNIValido, esNIEValido,
        esIBANValido, esEmailValido, esTelefonoValido, esCPValido
    };

    // ──────────────────────────────────────────────────────────
    //  ACCESIBILIDAD DE MODALES
    // ──────────────────────────────────────────────────────────
    // Los proyectos usan la convención:
    //   <div class="modal-overlay" id="..."> <div class="modal"> ... </div> </div>
    // Esta función:
    //   - pone role="dialog" + aria-modal="true" en el .modal interno,
    //   - marca aria-hidden en el resto de la página para screen readers,
    //   - mueve el foco al primer elemento focusable del modal,
    //   - recuerda el elemento que tenía el foco antes, para devolvérselo al cerrar,
    //   - atrapa Tab dentro del modal mientras esté abierto.
    //
    // Las llamadas a `abrirModal/cerrarModal` ya existentes en el código del proyecto
    // deben delegar aquí. Para no romper nada, exponemos los helpers como opt-in.

    let _previousFocus = null;
    let _trapListener = null;

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // a11yAbrirModal(overlayId, modalId?)
    //   overlayId — id del fondo (.modal-overlay). Si modalId no se pasa,
    //               busca .modal/[role="dialog"] DENTRO del overlay.
    //   modalId   — id del contenedor del modal cuando vive como hermano
    //               del overlay (patrón usado en escalados.html y otras
    //               páginas donde el aside.modal flota a top-level).
    function a11yAbrirModal(overlayId, modalId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const modal = (modalId && document.getElementById(modalId))
                   || overlay.querySelector('.modal, [role="dialog"]')
                   || overlay;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        // Marcar aria-hidden en el resto de la página, EXCEPTO el overlay
        // y el modal real (que puede vivir como hermano del overlay, no
        // dentro). Si lo escondemos, los lectores no leerán nada.
        document.querySelectorAll('body > *').forEach(el => {
            if (el === overlay || el === modal) return;
            if (el.contains(overlay) || el.contains(modal)) return;
            el.setAttribute('data-a11y-hidden-before', el.getAttribute('aria-hidden') || '');
            el.setAttribute('aria-hidden', 'true');
        });
        _previousFocus = document.activeElement;
        // Foco al primer elemento focusable. Ignoramos readonly/aria-hidden.
        const focusables = [...modal.querySelectorAll(FOCUSABLE)].filter(el =>
            !el.hasAttribute('readonly') &&
            el.offsetParent !== null &&
            el.getAttribute('aria-hidden') !== 'true'
        );
        if (focusables.length) {
            const preferred = focusables.find(el =>
                (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
            ) || focusables[0];
            setTimeout(() => preferred.focus(), 20);
        }
        // Trap de Tab
        _trapListener = (e) => {
            if (e.key !== 'Tab') return;
            const items = [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };
        document.addEventListener('keydown', _trapListener);
    }

    function a11yCerrarModal(overlayId) {
        const overlay = overlayId ? document.getElementById(overlayId) : null;
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
        // Restaurar aria-hidden previo del resto de la página
        document.querySelectorAll('[data-a11y-hidden-before]').forEach(el => {
            const prev = el.getAttribute('data-a11y-hidden-before');
            if (prev) el.setAttribute('aria-hidden', prev);
            else el.removeAttribute('aria-hidden');
            el.removeAttribute('data-a11y-hidden-before');
        });
        if (_trapListener) {
            document.removeEventListener('keydown', _trapListener);
            _trapListener = null;
        }
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            setTimeout(() => _previousFocus.focus(), 10);
        }
        _previousFocus = null;
    }

    // ──────────────────────────────────────────────────────────
    //  MODAL — apertura/cierre uniforme (REPLICADO en js/lib/modal.js)
    // ──────────────────────────────────────────────────────────
    // Antes vivían 8-10 abrirModal/cerrarModal por página con
    // variaciones en clase visible ('active' vs 'open'), cierre
    // con Esc y click en backdrop. Ahora una sola API:
    //   YurestConfig.modal.open('mi-overlay', { closeOnBackdrop: true });
    //   YurestConfig.modal.close('mi-overlay');
    // Default openClass = 'open' — el modal canónico de style.css estiliza
    // .modal-overlay.open. Páginas legacy con CSS local que aún use .active
    // pueden pasar { openClass: 'active' } explícito.
    const _modalCleanups = new Map();
    function _modalOpen(overlayId, opts) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const o = opts || {};
        const openClass = o.openClass || 'open';
        const prev = _modalCleanups.get(overlayId);
        if (prev) prev();
        overlay.classList.add(openClass);
        a11yAbrirModal(overlayId, o.modalId);
        const handlers = [];
        if (o.closeOnBackdrop !== false) {
            const onBd = (e) => { if (e.target === overlay) _modalClose(overlayId, { openClass }); };
            overlay.addEventListener('click', onBd);
            handlers.push(() => overlay.removeEventListener('click', onBd));
        }
        if (o.closeOnEsc !== false) {
            const onEsc = (e) => {
                if (e.key === 'Escape' && overlay.classList.contains(openClass)) {
                    _modalClose(overlayId, { openClass });
                }
            };
            document.addEventListener('keydown', onEsc);
            handlers.push(() => document.removeEventListener('keydown', onEsc));
        }
        _modalCleanups.set(overlayId, () => {
            handlers.forEach(fn => { try { fn(); } catch (_) {} });
            _modalCleanups.delete(overlayId);
            if (typeof o.onClose === 'function') { try { o.onClose(); } catch (_) {} }
        });
    }
    function _modalClose(overlayId, opts) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const openClass = (opts && opts.openClass) || 'open';
        overlay.classList.remove(openClass);
        a11yCerrarModal(overlayId);
        const cleanup = _modalCleanups.get(overlayId);
        if (cleanup) cleanup();
    }
    function _modalCloseAll() {
        for (const id of [..._modalCleanups.keys()]) _modalClose(id);
    }
    const modal = { open: _modalOpen, close: _modalClose, closeAll: _modalCloseAll };

    // ──────────────────────────────────────────────────────────
    //  DATATABLE — render seguro y eficiente de filas (REPLICADO
    //  en js/lib/datatable.js). Sustituye al patrón
    //  `tbody.innerHTML = items.map(…).join('')`. Auto-escape +
    //  DocumentFragment (un solo reflow) + empty state declarativo.
    // ──────────────────────────────────────────────────────────
    function renderTable(opts) {
        const tbody = opts && opts.tbody;
        if (!tbody) return tbody;
        const rows = Array.isArray(opts.rows) ? opts.rows : [];
        const columns = opts.columns || [];
        const escape = opts.escape || escHtml;
        if (rows.length === 0) {
            if (opts.empty != null) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.className = opts.emptyClassName || 'dt-empty';
                td.setAttribute('colspan', String(Math.max(columns.length, 1)));
                td.textContent = String(opts.empty);
                tr.appendChild(td);
                tbody.replaceChildren(tr);
            } else {
                tbody.replaceChildren();
            }
            return tbody;
        }
        const frag = document.createDocumentFragment();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const tr = document.createElement('tr');
            if (opts.rowClassName) tr.className = opts.rowClassName;
            if (opts.rowAttrs) {
                const a = opts.rowAttrs(row, i) || {};
                for (const k in a) tr.setAttribute(k, String(a[k]));
            }
            for (let c = 0; c < columns.length; c++) {
                const col = columns[c];
                const td = document.createElement('td');
                if (col.className) td.className = col.className;
                if (col.attrs) {
                    for (const k in col.attrs) td.setAttribute(k, String(col.attrs[k]));
                }
                let val;
                if (typeof col.render === 'function') val = col.render(row, i);
                else if (col.field) val = row[col.field];
                else val = '';
                if (col.html) {
                    td.innerHTML = val == null ? '' : String(val);
                } else {
                    td.textContent = (val == null || val === '') ? '—' : String(val);
                }
                tr.appendChild(td);
            }
            frag.appendChild(tr);
        }
        tbody.replaceChildren(frag);
        return tbody;
    }

    // ──────────────────────────────────────────────────────────
    //  CONFIRM DELETE — helper reusable
    // ──────────────────────────────────────────────────────────
    // Sustituye al window.confirm() (feo, sin estilo, no a11y) por un
    // diálogo modal accesible y consistente con el resto del portal.
    //
    // Uso:
    //   if (await YurestConfig.confirmDelete({
    //       titulo: 'Eliminar usuario',
    //       mensaje: '¿Seguro que quieres eliminar a ' + nombre + '?',
    //       confirmTexto: 'Eliminar'
    //   })) {
    //       // proceder con la acción destructiva
    //   }
    //
    // Opciones:
    //   titulo        — string corto (ej. "Eliminar usuario")
    //   mensaje       — string descriptivo. Soporta saltos de línea con \n
    //                   (CSS white-space:pre-line en .yurest-confirm-msg).
    //   confirmTexto  — texto del botón principal (default "Eliminar")
    //   cancelTexto   — texto del botón gris (default "Cancelar")
    //   variant       — 'danger' (rojo, default) para acciones destructivas
    //                   o 'primary' (coral de marca) para acciones positivas
    //                   como enviar/guardar/confirmar. La función mantiene
    //                   el nombre 'confirmDelete' por compatibilidad con
    //                   sitios que ya la llaman, pero ahora cubre ambos casos.
    //   requireText   — si lo pasas, el usuario tiene que TIPEARLO antes
    //                   de poder pulsar el botón principal. Útil para
    //                   acciones muy destructivas (borrar cliente con N proyectos).
    //
    // Devuelve: Promise<boolean> — true si confirmó, false si canceló o
    // pulsó Escape.
    function confirmDelete(opts) {
        opts = opts || {};
        const titulo  = opts.titulo  || '¿Confirmar?';
        const mensaje = opts.mensaje || 'Esta acción no se puede deshacer.';
        const confirmTexto = opts.confirmTexto || 'Eliminar';
        const cancelTexto  = opts.cancelTexto  || 'Cancelar';
        const requireText  = opts.requireText  || null;
        const variant      = (opts.variant === 'primary') ? 'primary' : 'danger';

        return new Promise(resolve => {
            // Inyectamos un overlay efímero (se elimina al cerrar). No
            // colisiona con otros modales porque vive como hijo directo
            // del body con id único.
            const id = 'yurest-confirm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            const overlay = document.createElement('div');
            overlay.id = id;
            overlay.className = 'yurest-confirm-overlay';
            overlay.innerHTML = `
                <div class="yurest-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-m">
                    <h3 id="${id}-t" class="yurest-confirm-title">${escHtml(titulo)}</h3>
                    <p id="${id}-m" class="yurest-confirm-msg">${escHtml(mensaje)}</p>
                    ${requireText ? `
                        <p class="yurest-confirm-hint">Para confirmar, escribe <strong>${escHtml(requireText)}</strong>:</p>
                        <input type="text" class="yurest-confirm-input" id="${id}-i" autocomplete="off" />
                    ` : ''}
                    <div class="yurest-confirm-actions">
                        <button type="button" class="yurest-confirm-btn cancel" data-action="cancel">${escHtml(cancelTexto)}</button>
                        <button type="button" class="yurest-confirm-btn ${variant}" data-action="confirm" ${requireText ? 'disabled' : ''}>${escHtml(confirmTexto)}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const cleanup = (val) => {
                document.removeEventListener('keydown', escListener);
                a11yCerrarModal(id);
                overlay.remove();
                resolve(val);
            };
            const escListener = (e) => {
                if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
            };
            document.addEventListener('keydown', escListener);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                if (btn.dataset.action === 'cancel') cleanup(false);
                else if (btn.dataset.action === 'confirm' && !btn.disabled) cleanup(true);
            });

            if (requireText) {
                const input = overlay.querySelector('#' + id + '-i');
                const okBtn = overlay.querySelector('[data-action="confirm"]');
                input.addEventListener('input', () => {
                    okBtn.disabled = (input.value.trim() !== requireText);
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !okBtn.disabled) cleanup(true);
                });
            }

            // Pintamos overlay visible en el siguiente frame para activar
            // la transición CSS (de opacity 0 a 1).
            requestAnimationFrame(() => overlay.classList.add('open'));
            // a11y: foco trap + aria-hidden al resto de la página.
            a11yAbrirModal(id);
        });
    }

    // Inyectamos los estilos del confirmDelete una sola vez. Vive aquí
    // para no exigir cambios en cada página que lo use.
    function _injectConfirmDeleteStyles() {
        if (document.getElementById('yurest-confirm-style')) return;
        const st = document.createElement('style');
        st.id = 'yurest-confirm-style';
        st.textContent = `
            .yurest-confirm-overlay {
                position: fixed; inset: 0;
                background: rgba(15,23,42,0.55);
                z-index: 9000;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
                opacity: 0; transition: opacity .18s;
            }
            .yurest-confirm-overlay.open { opacity: 1; }
            .yurest-confirm-modal {
                background: #fff;
                border-radius: var(--radius-lg, 14px);
                box-shadow: var(--shadow-xl, 0 25px 60px rgba(15,23,42,.20));
                max-width: 440px; width: 100%;
                padding: 22px 24px;
                font-family: var(--font-sans);
            }
            .yurest-confirm-title {
                font-size: 1.05rem; font-weight: 800; color: var(--text, #1e293b);
                margin: 0 0 8px;
            }
            .yurest-confirm-msg {
                font-size: 0.9rem; color: var(--text-muted, #5a6b7e);
                margin: 0 0 16px; line-height: 1.45;
                /* white-space:pre-line para que los \n del caller se rendericen
                   como saltos visuales, sin permitir HTML (el contenido ya va
                   por escHtml). Permite pasar "Línea 1\n\nLínea 2" como mensaje. */
                white-space: pre-line;
            }
            .yurest-confirm-hint {
                font-size: 0.8rem; color: var(--text-muted, #5a6b7e);
                margin: 4px 0 6px;
            }
            .yurest-confirm-input {
                width: 100%;
                padding: 9px 12px;
                font-family: var(--font-sans);
                font-size: 0.9rem;
                border: 1.5px solid var(--border, #e8e8e8);
                border-radius: var(--radius-md, 10px);
                background: #fff;
                margin-bottom: 14px;
                color: var(--text, #1e293b);
            }
            .yurest-confirm-input:focus {
                outline: none;
                border-color: #dc2626;
                box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
            }
            .yurest-confirm-actions {
                display: flex; gap: 8px; justify-content: flex-end;
            }
            .yurest-confirm-btn {
                padding: 9px 18px;
                font-family: var(--font-sans);
                font-size: 0.85rem; font-weight: 600;
                border-radius: var(--radius-md, 10px);
                cursor: pointer;
                border: 1.5px solid transparent;
                transition: background .15s, border-color .15s;
            }
            .yurest-confirm-btn.cancel {
                background: #fff; color: var(--text-muted, #475569);
                border-color: var(--border, #e2e8f0);
            }
            .yurest-confirm-btn.cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
            .yurest-confirm-btn.danger {
                background: #dc2626; color: #fff;
                border-color: #dc2626;
            }
            .yurest-confirm-btn.danger:hover:not(:disabled) { background: #b91c1c; border-color: #b91c1c; }
            .yurest-confirm-btn.danger:disabled { opacity: 0.45; cursor: not-allowed; }
            /* Variant 'primary' — coral de marca para acciones positivas
               (enviar oferta, confirmar guardado, etc.). Mismo layout que
               danger; sólo cambia la paleta. */
            .yurest-confirm-btn.primary {
                background: #fc5858; color: #fff;
                border-color: #fc5858;
            }
            .yurest-confirm-btn.primary:hover:not(:disabled) { background: #e94545; border-color: #e94545; }
            .yurest-confirm-btn.primary:disabled { opacity: 0.45; cursor: not-allowed; }
        `;
        document.head.appendChild(st);
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _injectConfirmDeleteStyles, { once: true });
        } else {
            _injectConfirmDeleteStyles();
        }
    }

    // ──────────────────────────────────────────────────────────
    //  TOAST CENTRAL — sustituye alert() nativos en todo el portal
    // ──────────────────────────────────────────────────────────
    // Pintamos un host fijo en la esquina inferior derecha y apilamos
    // toasts. Cada uno se desvanece a los `ms` ms (default 3500). Los de
    // tipo 'error' duran 5500 por defecto. Llamada típica:
    //     YurestConfig.toast('Pedido enviado', 'success');
    //     YurestConfig.toast('No se pudo conectar', 'error');
    function _injectToastStyles() {
        if (document.getElementById('yurest-toast-style')) return;
        const st = document.createElement('style');
        st.id = 'yurest-toast-style';
        st.textContent = `
            #yurest-toast-host {
                position: fixed; right: 16px; bottom: 16px; z-index: 100000;
                display: flex; flex-direction: column; gap: 8px;
                pointer-events: none;
                font-family: var(--font-sans, 'Bw Modelica SS01', 'Bw Modelica', system-ui, sans-serif);
            }
            .yurest-toast {
                pointer-events: auto;
                min-width: 240px; max-width: 380px;
                padding: 11px 14px;
                border-radius: 10px;
                font-size: 13px; line-height: 1.4;
                color: #0f172a; background: #fff;
                border: 1.5px solid #e2e8f0;
                box-shadow: 0 6px 24px rgba(15, 23, 42, .12);
                opacity: 0; transform: translateY(8px);
                transition: opacity .2s ease, transform .2s ease;
                display: flex; align-items: center; gap: 10px;
            }
            .yurest-toast.show { opacity: 1; transform: translateY(0); }
            .yurest-toast.success { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
            .yurest-toast.error   { border-color: #fecaca; background: #fff5f5; color: #b91c1c; }
            .yurest-toast.warning { border-color: #fde68a; background: #fffbeb; color: #92400e; }
            .yurest-toast__icon  { font-weight: 700; font-size: 1rem; flex-shrink: 0; line-height: 1; }
        `;
        document.head.appendChild(st);
    }
    // Iconos por defecto cuando el caller pasa `tipo` pero no `opts.icon`.
    const _TOAST_DEFAULT_ICONS = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
    /**
     * Muestra un toast efímero. Compatible con la firma anterior
     * `toast(msg, tipo, ms)` — el 4º argumento es nuevo y opcional.
     *
     * @param {string} msg
     * @param {'success'|'warning'|'error'|'info'} [tipo]
     * @param {number} [ms] — duración en ms; default 3500 (5500 si error)
     * @param {{icon?: string|false}} [opts]
     *   - icon: emoji/símbolo a la izquierda. Si se omite y `tipo` es
     *     success/warning/error/info, se usa el icono por defecto.
     *     Pasa `false` para suprimirlo. Pasa cualquier string para custom.
     */
    // ──────────────────────────────────────────────────────────
    //  EMPTY STATE — markup canónico
    // ──────────────────────────────────────────────────────────
    // Sustituye al patrón disperso de `_placeholderHtml`, `<div class="empty">`,
    // `cl-tab-placeholder`, `kb-empty`, `tk-empty`, etc. — todos pintaban
    // lo mismo (icono + título + descripción + CTA opcional) con CSS
    // diferente.
    //
    // Devuelve un string HTML (no inserta — el caller hace innerHTML).
    // El estilo lo proporciona la clase global `.empty-state` declarada en
    // style.css (padding 56px, border dashed, color muted). El alias
    // legacy `.empty` sigue funcionando idéntico.
    //
    // Uso:
    //   panel.innerHTML = YurestConfig.emptyStateHtml({
    //     icon: '📭',
    //     title: 'Sin resultados',
    //     description: 'Prueba a ajustar los filtros.',
    //     ctaLabel: 'Ver vista global',  // opcional
    //     ctaHref:  'escalados.html'      // opcional
    //   });
    //
    // Tipos de icono:
    //   · string  → se renderiza tal cual (emoji o texto)
    //   · false   → sin icono
    //   · omitido → fallback 'ℹ️'
    // ──────────────────────────────────────────────────────────
    //  PAGE HEADER — auto-render canónico
    // ──────────────────────────────────────────────────────────
    // Hasta ahora cada HTML tenía ~10 líneas de markup duplicado para el
    // page-header (botón hamburguesa + logo favicon + h1 del título). Si
    // el día de mañana cambia el logo, el icono del menú o la altura, hay
    // que editar 30 archivos.
    //
    // Patrón nuevo (declarativo, sin JS extra en cada HTML):
    //
    //   <header class="page-header" data-title="Customer Success — Clientes"></header>
    //
    // Este módulo escanea el DOM al cargar, busca cualquier elemento
    // .page-header con data-title y le inyecta el markup canónico. El
    // botón hamburguesa solo aparece si existe `openSidebar` en scope
    // (i.e. la página carga sidebar.js).
    //
    // Imperativo (para casos avanzados): YurestConfig.renderHeader(el, opts).
    function renderHeader(el, opts) {
        if (!el) return;
        opts = opts || {};
        const title    = String(opts.title    != null ? opts.title    : (el.getAttribute('data-title')    || ''));
        const subtitle = String(opts.subtitle != null ? opts.subtitle : (el.getAttribute('data-subtitle') || ''));
        const hasMenu  = (typeof window !== 'undefined' && typeof window.openSidebar === 'function');
        const menuBtn  = hasMenu
            ? '<button class="btn-menu" onclick="openSidebar()" title="Menú" aria-label="Abrir menú lateral">'
              + '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
              + '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
              + '</svg></button>'
            : '';
        const sub = subtitle ? `<span class="page-subtitle">${escHtml(subtitle)}</span>` : '';
        el.innerHTML = menuBtn
            + '<img class="brand-logo" src="favicon.svg" alt="Yurest">'
            + `<h1>${escHtml(title)}</h1>`
            + sub;
    }
    function _autoRenderHeaders() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.page-header[data-title]').forEach(el => {
            // Sólo auto-renderiza si está vacío (no pisa cabeceras custom que
            // alguna página haya pintado a mano).
            if (!el.children.length) renderHeader(el);
        });
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _autoRenderHeaders, { once: true });
        } else {
            _autoRenderHeaders();
        }
    }

    // ──────────────────────────────────────────────────────────
    //  SIDEBAR — open/close globales
    // ──────────────────────────────────────────────────────────
    // Hasta ahora cada HTML declaraba inline `function openSidebar()` y
    // `closeSidebar()` — 28 archivos con el mismo cuerpo. Si una página
    // nueva olvidaba declararlas, el botón hamburguesa no aparecía y el
    // usuario quedaba atrapado en la página (ya pasó con clientes-a3.html).
    // Las dejamos aquí como globales para que cualquier página que cargue
    // config.js + tenga los elementos `#sidebar` y `#sidebar-overlay`
    // funcione sin código extra.
    //
    // Idempotente: si una página declara su propia openSidebar (a nivel
    // de script, lo cual la convierte en global), Window las mantiene
    // como están y este bloque no las pisa.
    if (typeof window !== 'undefined') {
        if (typeof window.openSidebar !== 'function') {
            window.openSidebar = function () {
                const sb = document.getElementById('sidebar');
                const ov = document.getElementById('sidebar-overlay');
                if (sb) sb.classList.add('open');
                if (ov) ov.classList.add('open');
            };
        }
        if (typeof window.closeSidebar !== 'function') {
            window.closeSidebar = function () {
                const sb = document.getElementById('sidebar');
                const ov = document.getElementById('sidebar-overlay');
                if (sb) sb.classList.remove('open');
                if (ov) ov.classList.remove('open');
            };
        }
        // Tecla Escape cierra el sidebar — patrón ya presente en algunos
        // HTMLs, lo centralizamos aquí. Solo se registra una vez por
        // tab gracias al guard de flag en window.
        if (!window.__yurestSidebarEscBound) {
            window.__yurestSidebarEscBound = true;
            if (typeof document !== 'undefined') {
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && typeof window.closeSidebar === 'function') {
                        window.closeSidebar();
                    }
                });
            }
        }
    }

    function emptyStateHtml(opts) {
        opts = opts || {};
        const icon = (opts.icon === false || opts.icon === null)
            ? ''
            : `<div class="empty-state-icon">${escHtml(String(opts.icon != null ? opts.icon : 'ℹ️'))}</div>`;
        const title = opts.title
            ? `<h3>${escHtml(String(opts.title))}</h3>`
            : '';
        const desc = opts.description
            ? `<p>${escHtml(String(opts.description))}</p>`
            : '';
        const cta = (opts.ctaHref && opts.ctaLabel)
            ? `<a href="${escHtml(String(opts.ctaHref))}" class="empty-state-cta">${escHtml(String(opts.ctaLabel))} →</a>`
            : '';
        return `<div class="empty-state">${icon}${title}${desc}${cta}</div>`;
    }

    function toast(msg, tipo, ms, opts) {
        if (typeof document === 'undefined') return;
        _injectToastStyles();
        let host = document.getElementById('yurest-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'yurest-toast-host';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = 'yurest-toast' + (tipo ? ' ' + tipo : '');
        // Icono: explícito > default por tipo > ninguno
        const iconOpt = opts ? opts.icon : undefined;
        const icon = iconOpt === false ? null
                   : (typeof iconOpt === 'string' ? iconOpt : (tipo && _TOAST_DEFAULT_ICONS[tipo]) || null);
        if (icon) {
            const i = document.createElement('span');
            i.className = 'yurest-toast__icon';
            i.textContent = icon;
            el.appendChild(i);
        }
        const text = document.createElement('span');
        text.textContent = String(msg == null ? '' : msg);
        el.appendChild(text);
        host.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        const dur = typeof ms === 'number' ? ms : (tipo === 'error' ? 5500 : 3500);
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 220);
        }, dur);
    }

    // ──────────────────────────────────────────────────────────
    //  CACHÉ TTL DE BADGES (reduce egress de Supabase)
    // ──────────────────────────────────────────────────────────
    // actualizarBadgeX y los counters de notifications.js se llaman en
    // cada navegación, golpeando /altas, /proyectos y /hardware/pedidos
    // hasta 7 veces por carga. Con TTL en sessionStorage el badge se
    // mantiene fresco y la red solo se golpea ~1 vez/minuto por cuenta.
    // Tras una acción que cambia estado (grabar A3, mover proyecto…) el
    // caller puede invocar YurestNotifications.invalidate() para forzar
    // refetch en la próxima lectura.
    const BADGE_CACHE_PREFIX = 'yurest_badge_v1_';
    const BADGE_CACHE_TTL_MS = 60 * 1000;

    function _badgeCacheGet(key) {
        try {
            const raw = sessionStorage.getItem(BADGE_CACHE_PREFIX + key);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj.ts !== 'number') return null;
            if (Date.now() - obj.ts > BADGE_CACHE_TTL_MS) return null;
            return obj.value;
        } catch (_) { return null; }
    }
    function _badgeCacheSet(key, value) {
        try {
            sessionStorage.setItem(BADGE_CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), value }));
        } catch (_) { /* quota llena: no crítico */ }
    }
    function _badgeCacheInvalidateAll() {
        try {
            const toRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.indexOf(BADGE_CACHE_PREFIX) === 0) toRemove.push(k);
            }
            toRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (_) {}
    }

    // ──────────────────────────────────────────────────────────
    //  BADGE "GRABAR EN A3" — pendientes de Contabilidad
    // ──────────────────────────────────────────────────────────
    // Cuenta fichas con mandato SEPA firmado pendientes de grabar en A3.
    // Se llama desde sidebar.js tras renderizar el menú.
    async function actualizarBadgeA3() {
        try {
            const badge = document.getElementById('badge-a3');
            if (!badge) return;
            const cached = _badgeCacheGet('a3');
            if (cached !== null) {
                badge.textContent = cached > 0 ? cached : '';
                if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
                return;
            }
            const res = await apiFetch(ENDPOINTS.altas, { method: 'GET' });
            if (!res.ok) return;
            const data = await res.json();
            const lista = Array.isArray(data) ? data
                : Array.isArray(data.clientes) ? data.clientes
                : Array.isArray(data.data) ? data.data : [];
            // sepa_mandato puede venir como: objeto (legacy single-mandate),
            // array (multi-mandate moderno) o string JSON de cualquiera de
            // los dos. Antes solo mirábamos sepa.firma_base64 sobre el objeto
            // raíz, así que las fichas multi-mandato (arrays) no contaban y
            // el badge quedaba en 0 aunque hubiera pendientes reales. Ahora
            // normalizamos siempre a array y contamos la ficha si AL MENOS
            // un mandato tiene firma_base64 — mismo criterio que usa la tabla
            // de contabilidad.html para decidir si la ficha aparece o no.
            const count = lista.filter(f => {
                if (f.grabado_a3) return false;
                const sepaRaw = f.sepa_mandato || f.SEPA;
                if (!sepaRaw) return false;
                let sepa = sepaRaw;
                if (typeof sepa === 'string') {
                    try { sepa = JSON.parse(sepa); } catch (_) { return false; }
                }
                const mandatos = Array.isArray(sepa) ? sepa : [sepa];
                return mandatos.some(m => m && m.firma_base64);
            }).length;
            _badgeCacheSet('a3', count);
            badge.textContent = count > 0 ? count : '';
            if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
        } catch (_) { /* silencioso */ }
    }

    // ──────────────────────────────────────────────────────────
    // Cuenta pedidos de hardware que requieren acción de Contabilidad:
    //   solicitada           → falta emitir la proforma
    //   pendiente_confirmar  → cliente ya pagó, falta confirmar
    // Mismo criterio que el badge local de proformas.html (línea 295) para
    // que el número coincida estés donde estés.
    async function actualizarBadgeProformas() {
        try {
            const badge = document.getElementById('badge-proformas');
            if (!badge) return;
            const cached = _badgeCacheGet('proformas');
            if (cached !== null) {
                badge.textContent = cached > 0 ? cached : '';
                if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
                return;
            }
            const ep = ENDPOINTS.hardwarePedidos;
            if (!ep) return;
            const url = ep + (ep.includes('?') ? '&' : '?') + 'slim=1&_=' + Date.now();
            const res = await apiFetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
            if (!res.ok) return;
            const txt = await res.text();
            if (!txt) { _badgeCacheSet('proformas', 0); badge.textContent = ''; return; }
            const data = JSON.parse(txt);
            const pedidos = Array.isArray(data.pedidos) ? data.pedidos
                          : Array.isArray(data) ? data : [];
            const count = pedidos.filter(p => p && (p.estado === 'solicitada' || p.estado === 'pendiente_confirmar')).length;
            _badgeCacheSet('proformas', count);
            badge.textContent = count > 0 ? count : '';
            if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
        } catch (_) { /* silencioso */ }
    }

    // ──────────────────────────────────────────────────────────
    //  TOMBSTONES LOCALES DE FICHAS BORRADAS
    // ──────────────────────────────────────────────────────────
    // Cuando borramos una ficha con el workflow 10 (soft-delete por
    // deleted_at), a veces hay una ventana entre que la BD confirma el
    // UPDATE y PostgREST refresca su snapshot → el endpoint /altas
    // vuelve a devolverla momentáneamente. Consecuencia visible: el
    // badge "Sin asignar" se queda en 1 aunque la ficha ya no existe en
    // la vista actual. Para blindarlo, guardamos localmente los IDs
    // borrados y los filtramos en todos los consumers de /altas hasta
    // que la BD deje de enviarlos.
    //
    // Mismo patrón que STORAGE_KEY_ELIMINADOS usa el gestor de proyectos.
    const STORAGE_KEY_FICHAS_TOMBSTONE = 'yurest_fichas_eliminadas_v1';

    function _leerTombstonesFichas() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_FICHAS_TOMBSTONE);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch (_) { return new Set(); }
    }
    function marcarFichaEliminada(id) {
        if (!id) return;
        const set = _leerTombstonesFichas();
        set.add(String(id));
        try { localStorage.setItem(STORAGE_KEY_FICHAS_TOMBSTONE, JSON.stringify([...set])); }
        catch (_) { /* quota: no crítico */ }
    }
    // Filtra un array de fichas crudas de /altas retirando las que están
    // en el tombstone. El tombstone NO se auto-purga — si el backend
    // vuelve a devolver la ficha es síntoma de que el soft-delete falló
    // en BD, y auto-purgar ocultaría el problema sin resolverlo. El
    // tombstone solo se limpia al ejecutar YurestConfig.limpiarTombstonesFichas()
    // manualmente desde la consola.
    function aplicarTombstonesFichas(rawFichas) {
        const tomb = _leerTombstonesFichas();
        if (tomb.size === 0) return rawFichas || [];
        return (rawFichas || []).filter(f => !tomb.has(String(f.id || f.ID || '')));
    }
    function limpiarTombstonesFichas() {
        try { localStorage.removeItem(STORAGE_KEY_FICHAS_TOMBSTONE); return true; }
        catch (_) { return false; }
    }

    // Diagnóstico: devuelve en consola la lista de fichas que el badge
    // cuenta como "sin asignar" con toda la info útil (id, nombre, estado,
    // deleted_at). Úsalo así desde la consola del navegador:
    //    await YurestConfig.debugSinAsignar();
    // Si ves fichas con deleted_at=null que crees haber borrado, el
    // soft-delete no se aplicó en BD y hay que revisar el workflow 10.
    async function debugSinAsignar() {
        const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
        const urlAltas = ENDPOINTS.altas + (ENDPOINTS.altas.includes('?') ? '&' : '?') + '_=' + Date.now();
        const urlProy  = ENDPOINTS.proyectos + (ENDPOINTS.proyectos.includes('?') ? '&' : '?') + '_=' + Date.now();
        const [resAltas, resProy] = await Promise.all([
            apiFetch(urlAltas, { method: 'GET', headers }),
            apiFetch(urlProy,  { method: 'GET', headers }).catch(() => null)
        ]);
        if (!resAltas || !resAltas.ok) { console.error('[debug] /altas HTTP', resAltas && resAltas.status); return; }
        const dataAltas = await resAltas.json();
        const raw = Array.isArray(dataAltas) ? dataAltas
            : Array.isArray(dataAltas.clientes) ? dataAltas.clientes
            : Array.isArray(dataAltas.data) ? dataAltas.data : [];
        let listaProy = [];
        if (resProy && resProy.ok) {
            const dataProy = await resProy.json();
            listaProy = Array.isArray(dataProy) ? dataProy
                : Array.isArray(dataProy.proyectos) ? dataProy.proyectos
                : Array.isArray(dataProy.data) ? dataProy.data : [];
            listaProy = listaProy.filter(p => p && !p.deleted_at);
        }
        const proyectosCache = JSON.parse(localStorage.getItem('gestor_proyectos_v3') || '[]');
        const existentesNorm = new Set(listaProy.map(p => _normNombre(p.cliente)));
        const tomb = _leerTombstonesFichas();
        console.log('=== [debug] Sin asignar ===');
        console.log('Fichas totales devueltas por /altas:', raw.length);
        console.log('Proyectos del backend (/proyectos):', listaProy.map(p => ({ id: p.id, cliente: p.cliente, estado: p.estado })));
        console.log('Proyectos en caché local (localStorage):', proyectosCache.map(p => p.cliente));
        console.log('Tombstones locales:', [...tomb]);
        const sinAsignar = raw.filter(a => {
            const id = String(a.id || a.ID || '');
            if (tomb.has(id)) return false;
            const nombre = _extraerNombreFicha(a);
            if (!nombre) return false;
            return !existentesNorm.has(_normNombre(nombre));
        });
        console.table(sinAsignar.map(a => ({
            id: a.id || a.ID,
            nombre: _extraerNombreFicha(a),
            estado: a.estado || a['Estado'] || '',
            deleted_at: a.deleted_at || null,
            created_at: a.created_at || null
        })));
        return sinAsignar;
    }

    // Helpers compartidos con el badge para que la lógica esté centralizada.
    function _extraerNombreFicha(a) {
        return (
            a['Denominación Social'] || a['Denominacion Social'] || a.denominacion ||
            a['Nombre Sociedad']      || a['Nombre Comercial']     || a.nombreComercial ||
            a.Nombre || ''
        ).toString().trim();
    }
    function _normNombre(n) {
        return String(n || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // ──────────────────────────────────────────────────────────
    //  BADGE "SIN ASIGNAR" — se usa en varias páginas
    // ──────────────────────────────────────────────────────────
    // Actualiza el <span id="badge-sinasignar"> con el número de fichas
    // de alta que aún no tienen proyecto creado en el gestor.
    async function actualizarBadgeSinAsignar() {
        try {
            const badge = document.getElementById('badge-sinasignar');
            if (!badge) return;
            const cached = _badgeCacheGet('sinasignar');
            if (cached !== null) {
                badge.textContent = cached > 0 ? cached : '';
                if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
                return;
            }

            // Cache-bust para evitar que el navegador devuelva respuestas
            // viejas tras borrar una ficha.
            const urlAltas = ENDPOINTS.altas + (ENDPOINTS.altas.includes('?') ? '&' : '?') + '_=' + Date.now();
            const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };

            // Fetch en PARALELO de fichas y proyectos. Antes leíamos
            // proyectos solo desde localStorage['gestor_proyectos_v3'],
            // que es un caché que solo rellena proyectos.html. Si el
            // usuario no había pasado por ahí, el caché estaba vacío
            // y el badge contaba CUALQUIER ficha como "sin asignar",
            // incluidas las que en realidad sí tienen proyecto.
            const urlProy  = ENDPOINTS.proyectos + (ENDPOINTS.proyectos.includes('?') ? '&' : '?') + '_=' + Date.now();
            const [resAltas, resProy] = await Promise.all([
                apiFetch(urlAltas, { method: 'GET', headers }),
                apiFetch(urlProy,  { method: 'GET', headers })
            ]);
            if (!resAltas.ok) return;
            const dataAltas = await resAltas.json();
            const rawInicial = Array.isArray(dataAltas) ? dataAltas
                : Array.isArray(dataAltas.clientes) ? dataAltas.clientes
                : Array.isArray(dataAltas.data) ? dataAltas.data : [];
            const raw = aplicarTombstonesFichas(rawInicial);

            // Lista de clientes con proyecto activo (del backend). Si la
            // llamada al endpoint de proyectos falla, caemos al caché local
            // como fallback y loggeamos el problema en consola.
            let clientesConProy = [];
            if (resProy && resProy.ok) {
                const dataProy = await resProy.json();
                const listaProy = Array.isArray(dataProy) ? dataProy
                    : Array.isArray(dataProy.proyectos) ? dataProy.proyectos
                    : Array.isArray(dataProy.data) ? dataProy.data : [];
                clientesConProy = listaProy
                    .filter(p => p && !p.deleted_at)
                    .map(p => p.cliente);
            } else {
                console.warn('[badge] /proyectos no disponible, usando caché local.');
                const cache = JSON.parse(localStorage.getItem('gestor_proyectos_v3') || '[]');
                clientesConProy = cache.map(p => p.cliente);
            }

            const existentes = new Set(clientesConProy.map(_normNombre));
            const count = raw.filter(a => {
                const nombre = _extraerNombreFicha(a);
                return nombre && !existentes.has(_normNombre(nombre));
            }).length;
            _badgeCacheSet('sinasignar', count);
            badge.textContent = count > 0 ? count : '';
            if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
        } catch (_) { /* silencioso: badge informativo */ }
    }

    // ──────────────────────────────────────────────────────────
    //  HISTORIAL DE ACCIONES (audit log por ficha)
    // ──────────────────────────────────────────────────────────

    // Compara dos valores de cualquier tipo; devuelve true si son equivalentes.
    function _esIgual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a == b;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((x, i) => _esIgual(x, b[i]));
        }
        if (typeof a === 'object') {
            const ka = Object.keys(a), kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            return ka.every(k => _esIgual(a[k], b[k]));
        }
        return false;
    }

    // Calcula el diff entre dos objetos — devuelve sólo los campos que
    // cambian: { campo: {before, after}, ... }. Los campos en `ignorar`
    // (array) se saltan (útil para timestamps, campos calculados, etc.).
    function computeDiff(before, after, ignorar) {
        const ignoreSet = new Set(Array.isArray(ignorar) ? ignorar : []);
        const diff = {};
        const keys = new Set([
            ...Object.keys(before || {}),
            ...Object.keys(after  || {})
        ]);
        for (const k of keys) {
            if (ignoreSet.has(k)) continue;
            const b = before && before[k];
            const a = after  && after[k];
            if (!_esIgual(b, a)) diff[k] = { before: b, after: a };
        }
        return diff;
    }

    // Registra una entrada en el historial. Fire-and-forget: si falla la
    // petición NO bloqueamos la operación principal, sólo logueamos en
    // consola. Devuelve una promesa por si el caller quiere await.
    //
    // Parámetros:
    //   entry = {
    //     ficha_id, solicitud_id,                    // uno de los dos, obligatorio
    //     accion: 'create'|'update'|'delete'|…,      // obligatorio
    //     descripcion: 'texto legible',
    //     cambios: {campo:{before,after}},
    //     metadata: {...}
    //   }
    //   opts = { actorOverride: {...} }              // para logs del cliente o sistema
    function logHistorial(entry, opts) {
        opts = opts || {};
        const sess = getSession();
        const actor = opts.actorOverride || (sess ? {
            id:     sess.id || null,
            nombre: sess.nombre || sess.user || 'desconocido',
            rol:    sess.rol   || 'user'
        } : { nombre: 'sistema', rol: 'sistema' });

        const body = {
            ficha_id:     entry.ficha_id     || null,
            solicitud_id: entry.solicitud_id || null,
            usuario:      actor,
            accion:       entry.accion,
            descripcion:  entry.descripcion || '',
            cambios:      entry.cambios     || {},
            metadata:     entry.metadata    || {}
        };

        return apiFetch(ENDPOINTS.historial, {
            method: 'POST',
            body: JSON.stringify(body)
        }).catch(err => {
            console.warn('[historial] fallo al registrar acción (no bloqueante):', err && err.message);
            return null;
        });
    }

    // Registra una entrada en el historial del PROYECTO (equivalente a
    // logHistorial pero contra la tabla proyectos_historial). Campos:
    //   { proyecto_id (oblig.), accion, descripcion, cambios, metadata,
    //     seccion_nombre?, tarea_id?, tarea_nombre? }
    function logProyectoHistorial(entry, opts) {
        opts = opts || {};
        const sess = getSession();
        const actor = opts.actorOverride || (sess ? {
            id:     sess.id || null,
            nombre: sess.nombre || sess.user || 'desconocido',
            rol:    sess.rol   || 'user'
        } : { nombre: 'sistema', rol: 'sistema' });
        const body = {
            proyecto_id:    entry.proyecto_id,
            usuario:        actor,
            accion:         entry.accion,
            seccion_nombre: entry.seccion_nombre || null,
            tarea_id:       entry.tarea_id       || null,
            tarea_nombre:   entry.tarea_nombre   || null,
            descripcion:    entry.descripcion    || '',
            cambios:        entry.cambios        || {},
            metadata:       entry.metadata       || {}
        };
        return apiFetch(ENDPOINTS.proyectoHistorial, {
            method: 'POST',
            body: JSON.stringify(body)
        }).catch(err => {
            console.warn('[proyecto-historial] fallo al registrar acción (no bloqueante):', err && err.message);
            return null;
        });
    }

    async function getProyectoHistorial(filter) {
        try {
            const q = new URLSearchParams();
            q.set('proyectoId', filter.proyectoId || filter.proyecto_id || '');
            if (filter && filter.limit)  q.set('limit',  String(filter.limit));
            if (filter && filter.offset) q.set('offset', String(filter.offset));
            const url = ENDPOINTS.proyectoHistorial + '?' + q.toString();
            const res = await apiFetch(url, { method: 'GET' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            return Array.isArray(data.historial) ? data.historial : [];
        } catch (err) {
            console.warn('[proyecto-historial] fallo al leer:', err && err.message);
            return [];
        }
    }

    // Recupera el historial de una ficha. Devuelve un array (o [] si hay
    // error). Úsalo en UI para pintar el timeline.
    async function getHistorial(filter) {
        try {
            const q = new URLSearchParams();
            if (filter && filter.fichaId)     q.set('fichaId',     filter.fichaId);
            if (filter && filter.solicitudId) q.set('solicitudId', filter.solicitudId);
            if (filter && filter.limit)       q.set('limit',       String(filter.limit));
            if (filter && filter.offset)      q.set('offset',      String(filter.offset));
            const url = ENDPOINTS.historial + '?' + q.toString();
            const res = await apiFetch(url, { method: 'GET' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            return Array.isArray(data.historial) ? data.historial : [];
        } catch (err) {
            console.warn('[historial] fallo al leer:', err && err.message);
            return [];
        }
    }

    // ──────────────────────────────────────────────────────────
    //  EXPORTAR
    // ──────────────────────────────────────────────────────────
    global.YurestConfig = {
        EMISOR,
        WEBHOOK_BASE,
        PANEL_API_BASE,
        ENDPOINTS,
        SESSION_KEY,
        SESSION_TTL_MS,
        SESSION_TTL_LONG_MS,
        IMPLEMENTADORES,
        PERMISOS_DISPONIBLES,
        HARDWARE_CATALOGO,
        getSession,
        setSession,
        clearSession,
        getLastUser,
        forgetLastUser,
        requireAuth,
        getPermisos,
        tienePermiso,
        puedeLeer,
        puedeEscribir,
        puedeBorrar,
        esAdmin,
        getUsuario,
        getAuthHeaders,
        apiFetch,
        getBackendMode,
        rewriteForLaravel,
        API_BASE,
        cerrarSesion,
        escHtml,
        escAttr,
        escJsInAttr,
        generarId,
        getPortalBaseUrl,
        actualizarBadgeSinAsignar,
        marcarFichaEliminada,
        aplicarTombstonesFichas,
        limpiarTombstonesFichas,
        debugSinAsignar,
        actualizarBadgeA3,
        actualizarBadgeProformas,
        toast,
        emptyStateHtml,
        renderHeader,
        _badgeCacheGet,
        _badgeCacheSet,
        _badgeCacheInvalidateAll,
        a11yAbrirModal,
        a11yCerrarModal,
        logHistorial,
        getHistorial,
        logProyectoHistorial,
        getProyectoHistorial,
        computeDiff,
        formatDate,
        formatEur,
        parseEur,
        validators,
        modal,
        renderTable,
        confirmDelete
    };
})(window);
