import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { build } from 'vite'

describe('mini-tool production artifact', () => {
  it('defers the classic entry script until the root element has been parsed', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'proto-cell-minitool-'))

    try {
      await build({
        root: process.cwd(),
        build: { outDir, emptyOutDir: true },
      })

      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      expect(html).toMatch(/<script defer src="\.\/assets\/[^"/]+\.js"><\/script>/)
      expect(html).not.toContain('type="module"')
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })

  it('removes the unavailable network-information probe from the bundled script', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'proto-cell-minitool-'))

    try {
      await build({
        root: process.cwd(),
        build: { outDir, emptyOutDir: true },
      })

      const assetNames = await readdir(join(outDir, 'assets'))
      const entryName = assetNames.find((name) => /^index-[^.]+\.js$/.test(name))
      expect(entryName).toBeDefined()

      const script = await readFile(join(outDir, 'assets', entryName!), 'utf8')
      expect(script).not.toContain('navigator.connection')
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })
})
