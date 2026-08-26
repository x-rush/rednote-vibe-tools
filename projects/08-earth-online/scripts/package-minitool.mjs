import { mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateMinitoolPath } from './validate-minitool.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const distPath = resolve(projectRoot, 'dist-minitool')
const outputPath = resolve(projectRoot, 'release-assets/earth-online-minitool.zip')

validateMinitoolPath(distPath)
mkdirSync(dirname(outputPath), { recursive: true })
rmSync(outputPath, { force: true })

const result = spawnSync('jar', ['--create', '--file', outputPath, '--no-manifest', '-C', distPath, '.'], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(`jar failed: ${result.stderr || result.stdout}`)

const validation = validateMinitoolPath(outputPath)
console.log(`minitool-packaged path=${outputPath} files=${validation.files} zip=${statSync(outputPath).size}`)
