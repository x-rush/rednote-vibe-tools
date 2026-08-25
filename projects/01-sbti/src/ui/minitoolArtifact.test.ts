import { describe, expect, it } from 'vitest'
import { toMiniToolHtml, toMiniToolScript } from './minitoolArtifact'

describe('mini-tool build artifact', () => {
  it('converts the generated local module entry into a classic external script', () => {
    const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <script type="module" crossorigin src="./assets/index-example.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

    expect(toMiniToolHtml(html)).toBe(`<!doctype html>
<html lang="zh-CN">
  <head>
  </head>
  <body>
    <div id="root"></div>
    <script src="./assets/index-example.js"></script>
  </body>
</html>`)
  })

  it('removes React runtime reads of unavailable network information', () => {
    const script = 'return navigator.connection && navigator.connection.downlink;'

    expect(toMiniToolScript(script)).toBe('return undefined && undefined.downlink;')
  })
})
