import { PrintableDocument } from '../types/sigen';

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // UTF-8 BOM + semicolon separator for seamless Portuguese Excel compatibility
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadDocumentHtml(doc: PrintableDocument) {
  const sectionsHtml = doc.sections
    .map((sec) => {
      const kv = sec.rows
        ? `<dl style="display:grid;grid-template-columns:220px 1fr;gap:6px 16px;margin:12px 0;font-size:13px;">${sec.rows
            .map(
              (r) =>
                `<dt style="color:#536477;font-weight:600;">${r.label}</dt><dd style="margin:0;color:#112A4A;">${r.value}</dd>`
            )
            .join('')}</dl>`
        : '';
      const tbl = sec.table
        ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;">
            <thead><tr>${sec.table.headers
              .map(
                (h) =>
                  `<th style="text-align:left;padding:8px;border-bottom:2px solid #112A4A;color:#112A4A;background:#F8FAFC;">${h}</th>`
              )
              .join('')}</tr></thead>
            <tbody>${sec.table.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((c) => `<td style="padding:7px 8px;border-bottom:1px solid #E2E8F0;color:#1E293B;">${c}</td>`)
                    .join('')}</tr>`
              )
              .join('')}</tbody>
          </table>`
        : '';
      const note = sec.note
        ? `<p style="font-size:12px;color:#536477;background:#F8FAFC;border:1px solid #E2E8F0;padding:10px 12px;border-radius:6px;">${sec.note}</p>`
        : '';
      return `<section style="margin-top:20px;"><h2 style="font-size:15px;color:#112A4A;border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:10px;">${sec.heading}</h2>${kv}${tbl}${note}</section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <title>${doc.title} — SIGEN Classificações</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:860px;margin:32px auto;padding:0 24px;color:#112A4A;">
  <header style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #112A4A;padding-bottom:14px;">
    <div>
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#112A4A;">SIGEN Classificações</div>
      <div style="font-size:12px;color:#087E91;font-weight:600;margin-top:2px;">${doc.origin}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#536477;line-height:1.5;">
      <div><strong>Código:</strong> ${doc.docCode} · <strong>Versão:</strong> ${doc.version}</div>
      <div><strong>Instituição:</strong> ${doc.institutionName}</div>
      <div><strong>Emitido por:</strong> ${doc.generatedBy} · ${doc.generatedAt}</div>
    </div>
  </header>
  <h1 style="font-size:22px;margin:20px 0 6px;color:#112A4A;">${doc.title}</h1>
  ${sectionsHtml}
  <footer style="margin-top:36px;padding-top:12px;border-top:1px solid #CBD5E1;font-size:11px;color:#536477;">
    Aviso institucional: Este documento foi gerado pelo sistema SIGEN Classificações (${doc.origin}).
  </footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.docCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateTimePT(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
