// ============================================================
//  SIDEBAR COMPARTIDO — Yurest Portal
//  Renderiza el menú lateral desde JS para garantizar que las
//  6 páginas que lo usan queden siempre sincronizadas.
//  Se agrupa por departamento: Comercial, Implementación, Soporte.
// ============================================================
(function (global) {
    'use strict';

    // Iconos SVG inline (mismo set que se usaba antes en los HTML)
    const ICON = {
        chevronRight:  '<svg aria-hidden="true" class="sidebar-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        close:         '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
        informes:      '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 4 4 5-5"/></svg>',
        comercial:     '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>',
        // Implementación → llave inglesa + destornillador (work in progress)
        implementacion:'<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        // Soporte → auriculares con micrófono (helpdesk)
        soporte:       '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z"/></svg>',
        implementadores:'<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="6" r="2.5"/></svg>',
        fichas:        '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        bajas:         '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        sinasignar:    '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
        proyectos:     '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
        integraciones: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
        ventas:        '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
        // Mapa de calor → cuadrícula 3×3
        informe_tickets:'<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>',
        contabilidad:  '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
        a3:            '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        admin:         '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        // Customer Success → corazón con pulso (lealtad + atención al cliente)
        customer:      '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        clientes:      '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        // Promociones → rejilla 4×4 (las 16 plazas) con un par destacadas.
        promociones:   '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        hardware:      '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        // Stock → cajas apiladas (inventario / almacén)
        stock:         '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        // Producto → bombilla (ideas/desarrollo)
        producto:      '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>',
        // Presupuestos → documento con € (presupuesto financiero)
        presupuestos:  '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18V11"/><path d="M9 14c0-1 .6-2 3-2s3 1 3 2-1 2-3 2-3 1-3 2 1 2 3 2 3-1 3-2"/></svg>',
        // Updates → chispa/estrella (novedades / release notes)
        updates:       '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>',
        // Churn Técnico → flecha descendente con usuario (fuga técnica)
        churn_tecnico: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/><line x1="23" y1="13" x2="19" y2="13"/></svg>',
        // Escalados → escalera ascendente (upsell / ampliación contractual)
        escalados:     '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 20 8 20 8 14 13 14 13 8 18 8 18 4 21 4"/><polyline points="15 4 21 4 21 10"/></svg>',
        // Kanban CS → tres columnas verticales (tablero kanban)
        cs_kanban:     '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="4" height="14" rx="1"/></svg>',
        // Estado clientes Yurest → monitor con linea de pulso (uso del producto, telemetría)
        estado_clientes_yurest: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="18" x2="12" y2="20"/><polyline points="5 11 9 11 10 9 12 13 14 11 19 11"/></svg>',
        // HighLevel → flecha hacia arriba (escalada / nivel superior)
        highlevel:     '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 9 11l4 4 8-8"/><polyline points="14 7 21 7 21 14"/></svg>',
        // Resumen semanal → bocadillo de chat (resumen IA)
        resumen_semanal: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>',
        // Resumen mensual → calendario con check (informe profundo del mes)
        resumen_mensual: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
        // Documentación de integraciones → libro abierto (manual / docs)
        documentacion_integraciones: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
    };

    // Estructura del menú. Cada item tiene:
    //   id      — identificador único (el mismo que se pasa a render(activeId)).
    //   href    — destino del link.
    //   label   — texto visible.
    //   icon    — clave dentro de ICON.
    //   badgeId — opcional, id del <span> para badges numéricos.
    const GROUPS = [
        {
            id: 'informes',
            label: 'Informes',
            icon: 'informes',
            // `subgrupo` agrupa los items dentro del menú lateral con un
            // separador visual (mismo patrón que el detalle del home).
            // Si dos items consecutivos comparten subgrupo se renderizan
            // bajo una única cabecera.
            items: [
                { id: 'ventas',           href: 'ventas.html',          label: 'Ventas',                   icon: 'ventas',          subgrupo: 'Comercial' },
                { id: 'distribucion',          href: 'distribucion.html',        label: 'Implementadores',          icon: 'implementadores',  subgrupo: 'Implementación' },
                { id: 'informe_implementacion', href: 'informe-implementacion.html', label: 'Proyectos (dashboard)',  icon: 'implementacion',   subgrupo: 'Implementación', permiso: 'proyectos' },
                { id: 'informe_tickets',     href: 'informe-tickets.html',    label: 'Mapa de calor de tickets', icon: 'informe_tickets', subgrupo: 'Soporte' },
                { id: 'informe_tickets_ia',  href: 'informe-tickets-ia.html', label: 'Heatmap — Agente IA',      icon: 'informe_tickets', subgrupo: 'Soporte' },
                { id: 'resumen_semanal',     href: 'resumen-semanal.html',    label: 'Resumen semanal',          icon: 'resumen_semanal', subgrupo: 'Soporte' },
                { id: 'resumen_mensual',     href: 'resumen-mensual.html',    label: 'Resumen mensual',          icon: 'resumen_mensual', subgrupo: 'Soporte' },
                { id: 'churn_tecnico',       href: 'churn-tecnico.html',      label: 'Churn técnico',            icon: 'churn_tecnico',   subgrupo: 'Soporte', public: true }
            ]
        },
        {
            id: 'comercial',
            label: 'Comercial',
            icon: 'comercial',
            items: [
                { id: 'ofertas',       href: 'ofertas.html',       label: 'Ofertas generadas',      icon: 'fichas' },
                { id: 'configurador',  href: 'configurador.html',  label: 'Configurador de oferta', icon: 'presupuestos' },
                { id: 'lista',         href: 'lista.html',         label: 'Fichas de cliente',      icon: 'fichas' },
                { id: 'escalados',     href: 'escalados.html',     label: 'Escalados de clientes',  icon: 'escalados' }
            ]
        },
        {
            id: 'implementacion',
            label: 'Implementación',
            icon: 'implementacion',
            items: [
                { id: 'sinasignar', href: 'sinasignar.html', label: 'Sin asignar', icon: 'sinasignar', badgeId: 'badge-sinasignar' },
                { id: 'proyectos',  href: 'proyectos.html',  label: 'Proyectos',   icon: 'proyectos' },
                { id: 'panel_sesiones', href: 'panel-sesiones.html', label: 'Panel de sesiones', icon: 'proyectos' }
            ]
        },
        {
            id: 'contabilidad',
            label: 'Contabilidad',
            icon: 'contabilidad',
            items: [
                { id: 'contabilidad', href: 'contabilidad.html', label: 'Grabar en A3',          icon: 'a3',       badgeId: 'badge-a3' },
                { id: 'clientes_a3',  href: 'clientes-a3.html',  label: 'Clientes A3',           icon: 'clientes' },
                { id: 'proformas',    href: 'proformas.html',    label: 'Pagos de proformas',     icon: 'fichas', badgeId: 'badge-proformas' }
            ]
        },
        {
            id: 'customer',
            label: 'Customer Success',
            icon: 'customer',
            items: [
                { id: 'clientes',    href: 'clientes.html',    label: 'Clientes',    icon: 'clientes'    },
                { id: 'estado_clientes_yurest', href: 'estado-clientes-yurest.html', label: 'Estado clientes Yurest', icon: 'estado_clientes_yurest' },
                { id: 'cs_kanban',   href: 'cs-kanban.html',   label: 'Kanban CS',   icon: 'cs_kanban'   },
                { id: 'bajas',       href: 'bajas.html',       label: 'Bajas',       icon: 'bajas'       },
                { id: 'promociones', href: 'promociones.html', label: 'Promociones', icon: 'promociones', badgeId: 'badge-promociones' },
                { id: 'highlevel',          href: 'cs-highlevel.html',     label: 'HighLevel · Contactos',        icon: 'highlevel' },
                { id: 'highlevel_clientes', href: 'highlevel-clientes.html', label: 'HighLevel · Clientes ganados', icon: 'highlevel' },
                { id: 'huerfanos_prod',     href: 'huerfanos-prod.html',     label: 'Clientes Yurest sin CRM',      icon: 'highlevel' }
            ]
        },
        {
            id: 'producto',
            label: 'Producto',
            icon: 'producto',
            items: [
                { id: 'presupuestos', href: 'presupuestos.html', label: 'Presupuestos', icon: 'presupuestos', badgeId: 'badge-presupuestos' },
                { id: 'updates',      href: 'updates.html',      label: 'Updates',      icon: 'updates',      public: true }
            ]
        },
        {
            id: 'soporte',
            label: 'Soporte',
            icon: 'soporte',
            items: [
                { id: 'integraciones',     href: 'integraciones.html',  label: 'Integraciones',   icon: 'integraciones' },
                { id: 'documentacion_integraciones', href: 'documentacion-integraciones.html', label: 'Doc. integraciones', icon: 'documentacion_integraciones', public: true },
                { id: 'hardware',          href: 'hardware.html',       label: 'Hardware envíos', icon: 'hardware', badgeId: 'badge-hardware' },
                { id: 'stock',             href: 'stock.html',          label: 'Stock',           icon: 'stock' }
                // 'churn_tecnico' se ha movido al grupo Informes → subgrupo
                // Soporte para que comparta espacio con el resto de informes
                // de soporte (heatmap, resumen semanal). Se sigue marcando
                // como public:true allí.
            ]
        },
        {
            id: 'admin',
            label: 'Administración',
            icon: 'admin',
            items: [
                { id: 'admin', href: 'admin.html', label: 'Usuarios y permisos', icon: 'admin' }
            ]
        }
    ];

    // Devuelve el id de grupo al que pertenece el item con id `activeId`.
    function findGroupOf(activeId) {
        for (const g of GROUPS) {
            if (g.items.some(it => it.id === activeId)) return g.id;
        }
        return null;
    }

    // Devuelve una copia de GROUPS con sólo los items que el usuario actual
    // tiene permiso para ver. Grupos sin items visibles se omiten.
    function groupsVisibles() {
        const YC = window.YurestConfig;
        if (!YC || typeof YC.tienePermiso !== 'function') return GROUPS;
        // Items marcados como `public: true` se muestran a cualquier usuario
        // autenticado sin necesidad de un permiso en la tabla usuarios.
        // `permiso` permite que un item use otro id distinto al de su página
        // como clave de permiso — útil para vistas alternativas de los mismos
        // datos (ej. el dashboard de implementación usa el permiso 'proyectos').
        return GROUPS
            .map(g => ({ ...g, items: g.items.filter(it => it.public || YC.tienePermiso(it.permiso || it.id)) }))
            .filter(g => g.items.length > 0);
    }

    // Construye el HTML de un item (link dentro de grupo).
    function renderItem(item, activeId) {
        const active = item.id === activeId ? ' active' : '';
        const badge = item.badgeId
            ? ` <span class="sidebar-badge" id="${item.badgeId}"></span>`
            : '';
        return `
            <a href="${item.href}" class="sidebar-item${active}">
                ${ICON[item.icon] || ''}
                ${item.label}${badge}
            </a>`;
    }

    // Renderiza los hijos de un grupo. Si alguno declara `subgrupo`, los
    // agrupamos por ese campo y pintamos un separador con el nombre antes
    // de cada bloque (mismo patrón que el detalle del home — Informes
    // queda dividido en Comercial / Implementación / Soporte).
    function renderChildren(items, activeId) {
        const usaSubgrupos = items.some(it => it && it.subgrupo);
        if (!usaSubgrupos) return items.map(it => renderItem(it, activeId)).join('');
        const orden = [];
        const porSub = new Map();
        items.forEach(it => {
            const k = it.subgrupo || 'Otros';
            if (!porSub.has(k)) { porSub.set(k, []); orden.push(k); }
            porSub.get(k).push(it);
        });
        return orden.map(k => `
            <div class="sidebar-subgroup-label">${k}</div>
            ${porSub.get(k).map(it => renderItem(it, activeId)).join('')}
        `).join('');
    }

    // Persistencia del estado abierto/cerrado de los grupos. Antes el
    // usuario abría un grupo, navegaba a otra página y volvía a la misma
    // — y el grupo aparecía cerrado de nuevo.
    const SIDEBAR_GROUPS_KEY = 'yurest_sidebar_grupos_abiertos';
    function _gruposAbiertos() {
        try {
            const raw = sessionStorage.getItem(SIDEBAR_GROUPS_KEY);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch (_) { return new Set(); }
    }
    function _persistirGrupo(id, abierto) {
        try {
            const set = _gruposAbiertos();
            if (abierto) set.add(id); else set.delete(id);
            sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify([...set]));
        } catch (_) { /* sin storage: ignorar */ }
    }

    // Construye el HTML de un grupo colapsable.
    function renderGroup(group, activeId, isOpen) {
        const domId = 'sidebar-group-' + group.id;
        // Si tenemos persistencia previa para este grupo, prevalece sobre
        // el isOpen calculado por el activeId actual.
        const persistidos = _gruposAbiertos();
        const openCalculado = persistidos.has(group.id) ? true : isOpen;
        const openCls = openCalculado ? ' open' : '';
        // Badge agregado al grupo: aparece SOLO cuando el grupo está cerrado
        // (CSS regla más abajo) y muestra la suma de los hijos con badge.
        const childBadgeIds = group.items.map(it => it.badgeId).filter(Boolean);
        const groupBadge = childBadgeIds.length > 0
            ? `<span class="sidebar-group-badge" id="sidebar-group-badge-${group.id}" data-children="${childBadgeIds.join(',')}"></span>`
            : '';
        return `
            <div class="sidebar-group${openCls}" id="${domId}">
                <div class="sidebar-group-header" onclick="(function(el){const op=el.classList.toggle('open');try{const k='${SIDEBAR_GROUPS_KEY}';const set=new Set(JSON.parse(sessionStorage.getItem(k)||'[]'));op?set.add('${group.id}'):set.delete('${group.id}');sessionStorage.setItem(k,JSON.stringify([...set]));}catch(_){}})(document.getElementById('${domId}'))">
                    ${ICON[group.icon] || ''}
                    ${group.label}
                    ${groupBadge}
                    ${ICON.chevronRight}
                </div>
                <div class="sidebar-group-children">
                    ${renderChildren(group.items, activeId)}
                </div>
            </div>`;
    }

    // Recorre los grupos y suma los badges hijos para mostrarlos en el padre
    // cuando el grupo está cerrado. Se llama tras cada actualizarBadgeX.
    // También notifica a la campana de notificaciones para que repinte el
    // contador sin esperar a la próxima carga.
    function actualizarBadgesGrupos() {
        document.querySelectorAll('.sidebar-group-badge').forEach(badge => {
            const ids = (badge.dataset.children || '').split(',').filter(Boolean);
            let total = 0;
            ids.forEach(id => {
                const v = parseInt((document.getElementById(id)?.textContent || '').trim(), 10);
                if (!isNaN(v)) total += v;
            });
            badge.textContent = total > 0 ? total : '';
        });
        if (window.YurestNotifications && typeof window.YurestNotifications.refresh === 'function') {
            window.YurestNotifications.refresh();
        }
    }
    // Exponer para llamar desde fuera tras actualizar badges hijos.
    if (typeof window !== 'undefined') window._actualizarSidebarBadgesGrupos = actualizarBadgesGrupos;

    // Renderiza el sidebar completo en el <nav id="sidebar"> de la página actual.
    // `activeId` es el id del item que debe aparecer resaltado (p.ej. 'lista').
    // Estilos propios del sidebar que no viven en cada HTML (los originales
    // están inline en cada página). Inyectamos sólo lo nuevo aquí para no
    // tener que tocar 20 ficheros cada vez que se añade un detalle visual.
    function _injectSidebarStyles() {
        if (document.getElementById('yurest-sidebar-extra-style')) return;
        const st = document.createElement('style');
        st.id = 'yurest-sidebar-extra-style';
        st.textContent = `
            /* Logo dentro del sidebar — sustituye al texto+dot que había
               antes. Tamaño contenido para que no se coma el botón cerrar.
               El alto compensa los 24-26px del botón de cerrar al lado. */
            .sidebar-brand-logo {
                height: 26px; width: auto; display: block;
            }
            .sidebar-subgroup-label {
                margin: 8px 18px 2px 30px;
                padding: 0;
                font-size: 9.5px;
                font-weight: 800;
                letter-spacing: .1em;
                text-transform: uppercase;
                color: #94a3b8;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sidebar-subgroup-label::after {
                content: '';
                flex: 1;
                height: 1px;
                background: #e2e8f0;
            }
            /* La pseudo-línea conectora de los items dentro de los grupos
               se acorta cuando va precedida por un separador subgrupo
               para no chocar visualmente con la regla horizontal. */
            .sidebar-subgroup-label + .sidebar-item::before { display: none; }
        `;
        document.head.appendChild(st);
    }

    function render(activeId) {
        const nav = document.getElementById('sidebar');
        if (!nav) return;
        _injectSidebarStyles();

        const activeGroup = findGroupOf(activeId);
        // Sólo mostramos los grupos/items para los que el usuario tiene permiso
        const visibles = groupsVisibles();

        const html = `
            <div class="sidebar-hd">
                <div class="sidebar-brand">
                    <!-- Logo: favicon.svg (mismo origen). Antes apuntaba a
                         yurest.com/wp-content/.../Yurest-sin-texto2.png que
                         podía no responder (timeout / red bloqueada) y
                         dejaba un icono de imagen rota en cada página que
                         renderiza el sidebar. -->
                    <img class="sidebar-brand-logo"
                         src="favicon.svg"
                         alt="Yurest">
                </div>
                <button class="sidebar-close" onclick="closeSidebar()" aria-label="Cerrar menú">✕</button>
            </div>
            <div class="sidebar-label">Navegación</div>
            <a href="/" class="sidebar-item" style="margin-bottom:8px">
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Inicio
            </a>
            <div class="sidebar-label" style="margin-top:4px">Secciones</div>
            ${visibles.map(g => renderGroup(g, activeId, g.id === activeGroup)).join('')}
            <div class="sidebar-ft">
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
                    <button onclick="closeSidebar(); window.open('docs/yurest-flow.html','_blank');" title="Esquema visual del funcionamiento" style="background:#fff;border:1.5px solid #e2e8f0;color:#334155;padding:8px 12px;border-radius:10px;font-size:.8rem;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;text-align:left;transition:all .15s">
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Esquema de la web
                    </button>
                    <button onclick="closeSidebar(); window.open('docs/yurest-api.html','_blank');" title="Documentación de la API" style="background:#fff;border:1.5px solid #e2e8f0;color:#334155;padding:8px 12px;border-radius:10px;font-size:.8rem;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;text-align:left;transition:all .15s">
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        Documentación API
                    </button>
                </div>
                <button onclick="closeSidebar(); (window.cerrarSesion||YurestConfig.cerrarSesion)();">
                    ${ICON.close}
                    Cerrar sesión
                </button>
            </div>`;

        nav.innerHTML = html;

        // Disparar actualización de los badges informativos del sidebar.
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeSinAsignar) {
            window.YurestConfig.actualizarBadgeSinAsignar();
        }
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeA3) {
            window.YurestConfig.actualizarBadgeA3();
        }
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeProformas) {
            window.YurestConfig.actualizarBadgeProformas();
        }

        // Cargar notifications.js bajo demanda (misma carpeta que sidebar.js)
        // y montar la campana en la cabecera. Evita editar las 15+ páginas.
        ensureNotificationsLoaded();
    }

    function ensureNotificationsLoaded() {
        if (window.YurestNotifications) {
            if (typeof window.YurestNotifications.mountHeaderBell === 'function') {
                window.YurestNotifications.mountHeaderBell();
            }
            return;
        }
        if (document.getElementById('yurest-notifications-script')) return;
        const s = document.createElement('script');
        s.id = 'yurest-notifications-script';
        // Todas las páginas viven en la raíz, usamos path relativo simple.
        s.src = 'notifications.js';
        s.async = true;
        s.onload = () => {
            if (window.YurestNotifications && window.YurestNotifications.mountHeaderBell) {
                window.YurestNotifications.mountHeaderBell();
            }
        };
        s.onerror = () => console.error('[sidebar] no pude cargar notifications.js');
        document.head.appendChild(s);
    }

    global.YurestSidebar = { render, GROUPS };
})(window);
