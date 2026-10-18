import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createGameEngine } from '../game/engine'
import { getContent } from '../content'
import { createDefaultSave } from '../storage/codec'
import { createRadarInput } from './EcologyRadar'
import { Hud } from './Hud'
import { Lab } from './Lab'
import { Codex } from './Codex'

describe('ecosystem interface', () => {
  it('shows concealment, real growth sight and opened routes from engine state', () => {
    const content = getContent()
    const engine = createGameEngine({ seed: 727 })
    const markup = renderToStaticMarkup(<Hud snapshot={{ ...engine.snapshot(), territory: { sightRadius: 1680, concealed: true, brokenFibers: 2, canBreak: false } }} onPause={() => undefined} />)
    expect(markup).toContain(content.ui.hud.fiberCover)
    expect(markup).toContain('10.0')
    expect(markup).toContain(content.ui.hud.fiberBroken)
    engine.destroy()
  })
  it('explains terrain control only during actual fiber contact', () => {
    const content = getContent()
    const engine = createGameEngine({ seed: 727 })
    const snapshot = engine.snapshot()
    const draw = (fiberControl?: number) => renderToStaticMarkup(<Hud snapshot={{ ...snapshot, fiberControl }} onPause={() => undefined} />)
    expect(draw()).not.toContain(content.ui.hud.fiberSqueeze)
    expect(draw(0)).toContain(content.ui.hud.fiberSqueeze)
    expect(draw(1)).toContain(content.ui.hud.fiberPush)
    engine.destroy()
  })
  it('derives radar position and only already warned threats from the actual world', () => {
    const engine = createGameEngine({ seed: 727, originId: 'origin-primal-cell', environmentId: 'env-clear-drop' })
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === world.playerId)!
    const input = createRadarInput(world)
    expect(input?.world).toEqual({ width: world.width, height: world.height })
    expect(input?.playerPosition).toEqual(player.position)
    expect(input?.warnedThreats).toEqual(world.entities.filter((entity) => entity.arrivalPhase === 'alert' && entity.status === 'active').map((entity) => entity.position))
    engine.destroy()
  })

  it('hides radar without real world information', () => {
    const engine = createGameEngine({ seed: 727, originId: 'origin-primal-cell', environmentId: 'env-clear-drop' })
    const markup = renderToStaticMarkup(<Hud snapshot={engine.snapshot()} onPause={() => undefined} />)
    expect(markup).not.toContain('class="ecology-radar"')
    engine.destroy()
  })

  it('makes comfort settings reachable before the first run', () => {
    const content = getContent()
    const markup = renderToStaticMarkup(<Lab content={content} save={createDefaultSave()} hasArchive={false} selectedOriginId="origin-primal-cell" activeModifierIds={[]} dailyRunSeed={727} onSelectOrigin={() => undefined} onToggleModifier={() => undefined} onOpen={() => undefined} onStart={() => undefined} />)
    expect(markup).toContain(content.ui.actions.open_settings)
  })

  it('teaches behavior and counterplay only after discovering a creature', () => {
    const content = getContent()
    const note = content.ecosystems[0]!.enemyNotes[0]!
    const unseen = renderToStaticMarkup(<Codex content={content} progress={{}} onClose={() => undefined} />)
    const seen = renderToStaticMarkup(<Codex content={content} progress={{ [note.creatureId]: 'seen' }} onClose={() => undefined} />)
    expect(unseen).not.toContain(note.weakness)
    expect(seen).toContain(note.behavior)
    expect(seen).toContain(note.weakness)
  })
})
