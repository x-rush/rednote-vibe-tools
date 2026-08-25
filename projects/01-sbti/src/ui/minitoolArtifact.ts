export function toMiniToolHtml(html: string): string {
  const moduleEntry = /^[\t ]*<script type="module"(?: crossorigin)? src="(\.\/assets\/[^"]+\.js)"><\/script>\r?\n?/m
  const entryMatch = html.match(moduleEntry)

  if (!entryMatch) {
    throw new Error('Mini-tool build requires one local generated module entry')
  }

  const htmlWithoutModule = html.replace(moduleEntry, '')
  const classicHtml = htmlWithoutModule.replace(
    /^([\t ]*)<\/body>/m,
    `$1  <script src="${entryMatch[1]}"></script>\n$1</body>`,
  )

  if (classicHtml === htmlWithoutModule) {
    throw new Error('Mini-tool build requires a closing body tag')
  }

  if (/\btype=["']module["']/.test(classicHtml)) {
    throw new Error('Mini-tool build cannot contain module scripts')
  }

  return classicHtml
}

export function toMiniToolScript(script: string): string {
  return script.replaceAll('navigator.connection', 'undefined')
}
