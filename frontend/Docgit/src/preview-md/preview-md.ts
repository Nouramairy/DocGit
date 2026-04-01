import { Injectable } from '@angular/core';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class PreviewMd {
  openPreview(fileName: string, markdownContent: string): void {
    const html = marked.parse(markdownContent) as string;
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) return;

    previewWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} — Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a2e;
      background: #f4f5f7;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #e2e4e9;
      padding: 14px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .header-badge {
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      background: #f0f1f3;
      padding: 3px 10px;
      border-radius: 99px;
    }

    .content {
      max-width: 780px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
      padding: 48px 56px;
    }

    h1 { font-size: 2em; font-weight: 700; margin: 0 0 16px; color: #111827; letter-spacing: -0.5px; }
    h2 { font-size: 1.5em; font-weight: 600; margin: 32px 0 12px; color: #1f2937; letter-spacing: -0.3px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h3 { font-size: 1.25em; font-weight: 600; margin: 28px 0 8px; color: #374151; }
    h4 { font-size: 1.1em; font-weight: 600; margin: 24px 0 6px; color: #4b5563; }

    p { margin: 0 0 16px; color: #374151; }

    a { color: #2563eb; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.15s; }
    a:hover { border-bottom-color: #2563eb; }

    strong { font-weight: 600; color: #111827; }
    em { font-style: italic; }

    ul, ol { margin: 0 0 16px; padding-left: 24px; }
    li { margin-bottom: 6px; color: #374151; }
    li::marker { color: #9ca3af; }

    blockquote {
      margin: 16px 0;
      padding: 12px 20px;
      border-left: 4px solid #3b82f6;
      background: #eff6ff;
      border-radius: 0 8px 8px 0;
      color: #1e40af;
      font-style: italic;
    }

    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.875em;
      background: #f3f4f6;
      color: #dc2626;
      padding: 2px 6px;
      border-radius: 4px;
    }

    pre {
      margin: 16px 0;
      padding: 20px 24px;
      background: #1e293b;
      color: #e2e8f0;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.6;
    }

    pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }

    th {
      text-align: left;
      padding: 10px 14px;
      background: #f9fafb;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 600;
      color: #374151;
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid #f3f4f6;
      color: #4b5563;
    }

    tr:hover td { background: #f9fafb; }

    hr {
      border: none;
      height: 2px;
      background: #e5e7eb;
      margin: 32px 0;
      border-radius: 1px;
    }

    img { max-width: 100%; border-radius: 8px; margin: 16px 0; }

    input[type="checkbox"] {
      margin-right: 8px;
      accent-color: #2563eb;
    }

    @media (max-width: 860px) {
      .content { margin: 20px 16px; padding: 32px 28px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">${fileName}</span>
    <span class="header-badge">Markdown Preview</span>
  </div>
  <div class="content">${html}</div>
</body>
</html>`);
    previewWindow.document.close();
  }
}
