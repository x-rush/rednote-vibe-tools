import { describe, expect, it } from 'vitest'
import { assertClassicScriptSource } from './minitool-contract.mjs'

describe('mini tool classic-script contract', () => {
  it.each([
    ['static import', "import game from './game.js'"],
    ['side-effect import', "import './game.js'"],
    ['named export', 'export { game }'],
    ['default export', 'export default game'],
    ['dynamic import', "import('./game.js')"],
  ])('rejects %s syntax', (_label, source) => {
    expect(() => assertClassicScriptSource(source)).toThrow('静态模块或动态模块')
  })

  it('accepts a self-contained IIFE bundle', () => {
    expect(() => assertClassicScriptSource("(function(){'use strict';window.game={ready:true}})();")).not.toThrow()
  })
})
