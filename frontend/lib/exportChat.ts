import type { Message } from '@/types'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) || 'chat'
}

function buildMarkdown(messages: Message[], repoName: string): string {
  const lines: string[] = [
    `# CodeLens Chat — ${repoName}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`## You\n\n${msg.content}`, '')
    } else {
      lines.push(`## CodeLens\n\n${msg.content}`, '')
      if (msg.sources?.length) {
        lines.push('**Sources:**')
        for (const s of msg.sources) lines.push(`- \`${s.file_path}\``)
        lines.push('')
      }
    }
    lines.push('---', '')
  }

  return lines.join('\n')
}

export function exportMarkdown(messages: Message[], repoName: string, chatTitle: string) {
  const exportable = messages.filter((m) => m.content && !m.streaming)
  if (!exportable.length) return

  const md = buildMarkdown(exportable, repoName)
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(chatTitle)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(messages: Message[], repoName: string, chatTitle: string) {
  const exportable = messages.filter((m) => m.content && !m.streaming)
  if (!exportable.length) return

  const rows = exportable
    .map(
      (msg) => `
      <div class="message">
        <div class="role role-${msg.role}">${msg.role === 'user' ? 'You' : 'CodeLens'}</div>
        <div class="content">${escapeHtml(msg.content)}</div>
        ${
          msg.sources?.length
            ? `<div class="sources"><strong>Sources:</strong><ul>${msg.sources.map((s) => `<li>${escapeHtml(s.file_path)}</li>`).join('')}</ul></div>`
            : ''
        }
      </div>`,
    )
    .join('<hr/>')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(chatTitle)}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;color:#111}
    h1{font-size:1.4rem;margin:0 0 .25rem}
    .meta{color:#888;font-size:.8rem;margin-bottom:1.5rem}
    .message{margin-bottom:1rem}
    .role{font-weight:700;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem}
    .role-user{color:#4f46e5}.role-assistant{color:#555}
    .content{white-space:pre-wrap;line-height:1.6;font-size:.9rem}
    .sources{margin-top:.5rem;font-size:.8rem;color:#888}
    .sources ul{margin:.25rem 0;padding-left:1.25rem}
    .sources li{font-family:monospace}
    hr{border:none;border-top:1px solid #eee;margin:1.25rem 0}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <h1>${escapeHtml(chatTitle)}</h1>
  <p class="meta">Repo: ${escapeHtml(repoName)} · Exported ${new Date().toLocaleString()}</p>
  <hr/>
  ${rows}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 250)
}
