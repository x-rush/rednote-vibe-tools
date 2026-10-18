import { expect, it } from 'vitest'
import { baselineCss } from '../../scripts/css-baseline'
it('keeps modern declarations while supplying local legacy values for nested sizing and safe areas',()=>{
 const css=baselineCss('.a{width:min(100%,430px);padding:max(12px,env(safe-area-inset-top,0px));gap:8px}')
 expect(css).toContain('width:100%');expect(css).toContain('width:min(')
 expect(css).toContain('padding:12px');expect(css).toContain('padding:max(')
 expect(css).toContain('grid-gap:8px;gap:8px')
})
it('guards variable-based modern colors instead of letting invalid computed values erase fallbacks',()=>{
 const css=baselineCss('.a{background:color-mix(in srgb,var(--glow) 60%,white)}')
 expect(css).toContain('@supports')
 expect(css).toContain('(color: color-mix(in srgb, red, blue))')
})
