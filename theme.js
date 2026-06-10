// ============================================================
//  TEMA CLARO/OSCURO COMPARTIDO — Yurest Portal
//  Cargar SIN defer en el <head> de cada página, antes del CSS
//  de la página si es posible:
//      <script src="theme.js"></script>
//
//  · Sin elección guardada manda prefers-color-scheme (sistema).
//  · El switch persiste la elección en localStorage.yurest_theme,
//    compartida por todas las páginas del portal.
//  · El cambio se anima con un revelado circular (View Transitions
//    API) que nace en el botón pulsado; fallback a cambio directo.
//  · Si la página no trae su propio botón .theme-toggle (login e
//    index lo integran en su layout), se inyecta uno flotante.
// ============================================================
(function () {
    'use strict';

    // ── 1) Anti-flash: aplicar el tema ANTES del primer pintado ──────
    try {
        var saved = localStorage.getItem('yurest_theme');
        if (saved === 'dark' || saved === 'light') {
            document.documentElement.dataset.theme = saved;
        }
    } catch (_) {}

    // ── 2) CSS común: iconos del switch, FAB y view transition ───────
    var css = [
        // Sol/luna: luna en claro, sol en oscuro (el efectivo, no el guardado)
        '.theme-toggle .icon-sun { display:none }',
        '[data-theme="dark"] .theme-toggle .icon-sun { display:block }',
        '[data-theme="dark"] .theme-toggle .icon-moon { display:none }',
        '@media (prefers-color-scheme: dark) {',
        '  :root:not([data-theme="light"]) .theme-toggle .icon-sun { display:block }',
        '  :root:not([data-theme="light"]) .theme-toggle .icon-moon { display:none }',
        '}',
        '.theme-toggle svg { transition: transform .3s ease }',
        '.theme-toggle:active svg { transform: rotate(40deg) }',
        // Botón flotante (solo el inyectado lleva esta clase)
        '.theme-toggle--fab {',
        '  position:fixed; right:18px; bottom:18px; z-index:590;',
        '  width:40px; height:40px; border-radius:999px;',
        '  background:var(--card, var(--surface-base, #fff));',
        '  border:1.5px solid var(--border, #e2e8f0);',
        '  color:var(--text-muted, #64748b); cursor:pointer;',
        '  display:flex; align-items:center; justify-content:center;',
        '  box-shadow:0 4px 14px rgba(15,23,42,.10);',
        '  transition:color .15s, border-color .15s, transform .15s;',
        '}',
        '.theme-toggle--fab:hover { color:var(--primary, #fc5858); border-color:var(--primary, #fc5858); transform:translateY(-1px) }',
        // Revelado circular: anulamos el crossfade por defecto; la
        // animación real es el clip-path que lanza toggleTheme().
        '::view-transition-old(root), ::view-transition-new(root) { animation:none; mix-blend-mode:normal }',
        '::view-transition-old(root) { z-index:1 }',
        '::view-transition-new(root) { z-index:2 }',
        // Congelar transiciones CSS de color durante el snapshot para no
        // capturar colores a medio interpolar.
        'html.vt-active *, html.vt-active *::before, html.vt-active *::after { transition:none !important }'
    ].join('\n');
    var styleEl = document.createElement('style');
    styleEl.id = 'yurest-theme-css';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ── 3) Alternar tema con revelado circular ────────────────────────
    // Parte del tema EFECTIVO (elegido o, si no hay elección, el del
    // sistema) y persiste la elección explícita.
    window.toggleTheme = function (ev) {
        var root = document.documentElement;
        var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var current = root.dataset.theme || (sysDark ? 'dark' : 'light');
        var next = current === 'dark' ? 'light' : 'dark';

        var apply = function () {
            root.dataset.theme = next;
            try { localStorage.setItem('yurest_theme', next); } catch (_) {}
        };

        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!document.startViewTransition || reduceMotion) { apply(); return; }

        // Centro del revelado: el botón pulsado (o el primero que haya)
        var btn = (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect)
            ? ev.currentTarget
            : document.querySelector('.theme-toggle');
        var cx = window.innerWidth - 40, cy = 40;
        if (btn) {
            var r = btn.getBoundingClientRect();
            cx = r.left + r.width / 2;
            cy = r.top + r.height / 2;
        }
        // Radio hasta la esquina más lejana para cubrir todo el viewport
        var radius = Math.hypot(
            Math.max(cx, window.innerWidth - cx),
            Math.max(cy, window.innerHeight - cy)
        );

        root.classList.add('vt-active');
        var vt = document.startViewTransition(apply);
        vt.ready.then(function () {
            root.animate(
                {
                    clipPath: [
                        'circle(0px at ' + cx + 'px ' + cy + 'px)',
                        'circle(' + radius + 'px at ' + cx + 'px ' + cy + 'px)'
                    ]
                },
                { duration: 550, easing: 'cubic-bezier(.2, 0, 0, 1)', pseudoElement: '::view-transition-new(root)' }
            );
        });
        vt.finished.finally(function () { root.classList.remove('vt-active'); });
    };

    // ── 4) Botón flotante si la página no integra el suyo ────────────
    var SUN = '<svg class="icon-sun" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    var MOON = '<svg class="icon-moon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    function ensureButton() {
        if (document.querySelector('.theme-toggle')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-toggle theme-toggle--fab';
        btn.setAttribute('aria-label', 'Cambiar entre tema claro y oscuro');
        btn.title = 'Cambiar tema';
        btn.innerHTML = MOON + SUN;
        btn.addEventListener('click', window.toggleTheme);
        document.body.appendChild(btn);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureButton);
    } else {
        ensureButton();
    }
})();
