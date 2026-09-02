import { describe, expect, it } from 'vitest'
import { radarMarkers } from './EcologyRadar'

describe('ecology radar projection', () => {
  it('projects only boundary, encounter, exit, and warned threats', () => {
    expect(radarMarkers({
      world: { width: 1000, height: 1000 },
      playerPosition: { x: 500, y: 500 },
      encounterPosition: { x: 900, y: 500 },
      warnedThreats: [{ x: 300, y: 500 }],
    }).map((marker) => marker.kind)).toEqual(['boundary', 'encounter', 'warned-threat'])
  })
})
