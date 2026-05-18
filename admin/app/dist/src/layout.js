export function layout(title, body, loggedIn) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | SDET Store Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f5f5f5; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Nav — matches main site */
    nav { background: #1a1a1a; color: #fff; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .nav-brand { font-weight: 700; font-size: 1.1rem; }
    .nav-brand .badge { background: #2563eb; color: #fff; font-size: 0.65rem; padding: 0.1rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; letter-spacing: 0.05em; vertical-align: middle; }
    .nav-links { display: flex; align-items: center; gap: 1rem; }
    nav form { display: inline; }
    nav .link-btn { background: transparent; color: #fff; border: 0; padding: 0; cursor: pointer; font: inherit; }
    nav .link-btn:hover { text-decoration: underline; }

    /* Layout */
    main { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem; gap: 1rem; flex-wrap: wrap; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 0.95rem; color: #6b7280; font-weight: 400; margin-bottom: 1rem; }

    /* Forms */
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .form-group input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
    .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
    .btn { display: inline-block; padding: 0.5rem 1.25rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 500; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-danger:hover { background: #dc2626; }

    /* Alerts */
    .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    /* Current-mode chip */
    .current-mode-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .current-mode-row .label { font-size: 0.85rem; color: #6b7280; }
    .current-mode { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: #2563eb; color: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; font-weight: 600; }
    .current-mode.healthy { background: #16a34a; }

    /* Mode grid */
    .section-group { margin-top: 1.5rem; }
    .section-group h3 { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; margin-bottom: 0.6rem; letter-spacing: 0.06em; font-weight: 600; }
    .mode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.6rem; }
    .mode-btn-form { display: block; }
    .mode-btn { display: block; width: 100%; text-align: left; padding: 0.75rem 0.9rem; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; cursor: pointer; font: inherit; color: inherit; transition: border-color 0.1s, background 0.1s; }
    .mode-btn:hover { background: #f9fafb; border-color: #9ca3af; }
    .mode-btn.active { background: #eff6ff; border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb inset; }
    .mode-btn .mode-name { display: flex; align-items: center; gap: 0.4rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; font-weight: 600; color: #1a1a1a; margin-bottom: 0.2rem; }
    .mode-btn .mode-name .dot { width: 6px; height: 6px; border-radius: 999px; background: #d1d5db; }
    .mode-btn.active .mode-name .dot { background: #2563eb; }
    .mode-btn.healthy .mode-name .dot { background: #16a34a; }
    .mode-btn .mode-desc { font-size: 0.8rem; color: #4b5563; line-height: 1.4; }

    /* Tables (users + orders share styling) */
    .users-table, .orders-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .users-table th, .users-table td, .orders-table th, .orders-table td { padding: 0.55rem 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .users-table th, .orders-table th { font-size: 0.72rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .users-table td.mono, .orders-table td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; }
    .users-table tr:last-child td, .orders-table tr:last-child td { border-bottom: 0; }
    .users-table .num, .orders-table .num { text-align: right; }
    th.num { text-align: right; }
    .copy-cell { display: inline-flex; align-items: center; gap: 0.4rem; }
    .copy-btn { background: #f3f4f6; border: 1px solid #e5e7eb; color: #4b5563; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; font-family: inherit; }
    .copy-btn:hover { background: #e5e7eb; color: #1a1a1a; }
    .copy-btn.copied { background: #16a34a; color: #fff; border-color: #16a34a; }

    /* Session indicator */
    .session-dot { display: inline-block; min-width: 1.25rem; text-align: center; font-weight: 700; font-size: 0.9rem; }
    .session-dot.active { color: #16a34a; }
    .session-dot.expired { color: #dc2626; }
    .session-dot.none { color: #9ca3af; }

    /* Order status pill */
    .order-status { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; background: #e5e7eb; color: #4b5563; }
    .order-status.status-confirmed { background: #dcfce7; color: #16a34a; }
    .order-status.status-pending { background: #fef3c7; color: #92400e; }

    /* State-card sub-sections */
    .sub-head { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.06em; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.55rem; }
    .sub-block { margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: #f9fafb; border-radius: 6px; border: 1px solid #f3f4f6; }
    .sub-block-head { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.25rem; }
    .sub-list { list-style: none; padding-left: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: #1a1a1a; }
    .sub-list li { padding: 0.15rem 0; }

    /* Activity feed */
    .activity-list { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; max-height: 360px; overflow-y: auto; border: 1px solid #f3f4f6; border-radius: 6px; background: #fafafa; }
    .activity-list:empty::after { content: "Waiting for events…"; color: #9ca3af; font-family: system-ui, sans-serif; font-size: 0.85rem; padding: 1rem; display: block; text-align: center; }
    .act-row { display: grid; grid-template-columns: 70px 160px 60px 1fr auto; gap: 0.6rem; align-items: center; padding: 0.35rem 0.75rem; border-bottom: 1px solid #f3f4f6; }
    .act-row:last-child { border-bottom: 0; }
    .act-time { color: #6b7280; }
    .act-user { color: #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .act-kind { font-weight: 700; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 3px; text-align: center; letter-spacing: 0.03em; }
    .act-kind.k-http { background: #e0e7ff; color: #3730a3; }
    .act-kind.k-mode { background: #fef3c7; color: #92400e; }
    .act-kind.k-seed { background: #fce7f3; color: #9d174d; }
    .act-path { color: #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .act-detail { color: #1a1a1a; }
    .act-status { font-weight: 700; padding: 0.05rem 0.45rem; border-radius: 3px; font-size: 0.7rem; }
    .act-status.st-2xx { background: #dcfce7; color: #16a34a; }
    .act-status.st-3xx { background: #e0e7ff; color: #3730a3; }
    .act-status.st-4xx { background: #fef3c7; color: #92400e; }
    .act-status.st-5xx { background: #fee2e2; color: #dc2626; }

    /* Misc */
    .muted { color: #6b7280; }
    .small { font-size: 0.8rem; }
    .meta { color: #6b7280; font-size: 0.8rem; margin-top: 0.75rem; }
    .meta code { background: #f3f4f6; padding: 0.05rem 0.4rem; border-radius: 4px; font-size: 0.8rem; }
  </style>
</head>
<body>
  <nav>
    <span class="nav-brand">SDET Store<span class="badge">ADMIN</span></span>
    <div class="nav-links">
      ${loggedIn
        ? `<form method="POST" action="/logout"><button type="submit" class="link-btn" data-testid="nav-logout">Logout</button></form>`
        : ""}
    </div>
  </nav>
  <main>
    ${body}
  </main>
  <script>
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(function () {
        var prev = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = prev;
          btn.classList.remove('copied');
        }, 1200);
      });
    });
  </script>
</body>
</html>`;
}
//# sourceMappingURL=layout.js.map