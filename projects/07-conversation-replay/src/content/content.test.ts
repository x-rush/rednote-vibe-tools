import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { parseContent, validateContent } from './validate'

describe('conversation replay production content', () => {
  it('provides content-owned copy for the landing and privacy stages', () => {
    const intro = parseContent(rawContent).content.intro

    expect(intro.landing.beforeText.trim()).not.toBe('')
    expect(intro.landing.afterText.trim()).not.toBe('')
    expect(intro.landing.privacyNoteTitle.trim()).not.toBe('')
    expect(intro.landing.privacyNoteBody.trim()).not.toBe('')
    expect(intro.privacy.sections).toHaveLength(3)
    expect(intro.privacy.ephemeralDescription.trim()).not.toBe('')
    expect(intro.privacy.localDescription.trim()).not.toBe('')
  })

  it('provides content-owned copy for saving the replay card to a phone album', () => {
    const replayCard = parseContent(rawContent).content.intro.replayCard

    expect(Object.values(replayCard).every((text) => text.trim().length > 0)).toBe(true)
    expect(replayCard.saveLabel).toContain('手机相册')
    expect(replayCard.unavailableMessage).toContain('小红书真机')
  })

  it('rejects blank replay-card save copy', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { intro: { replayCard?: Record<string, string> } }
    }
    invalid.content.intro.replayCard!.savedMessage = ' '

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.intro.replayCard.savedMessage')).toBe(true)
  })

  it('rejects blank intro presentation copy', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { intro: { privacy: { primaryLabel: string } } }
    }
    invalid.content.intro.privacy.primaryLabel = ' '

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.intro.privacy.primaryLabel')).toBe(true)
  })

  it('provides a complete and bounded Chiyan companion script', () => {
    const momentKeys = [
      'landing', 'privacy', 'guide', 'relationship', 'goal', 'scenario', 'fact', 'feeling',
      'inference', 'need', 'request', 'draft', 'practice', 'comparison', 'result', 'saved',
      'exit', 'safety', 'recovery',
    ] as const
    const parsed = parseContent(rawContent) as unknown as {
      content: {
        npc?: {
          id: string
          role: string
          moments: Record<(typeof momentKeys)[number], { pose: string; invitation: string; reassurance?: string; autonomy: string }>
        }
      }
    }

    expect(parsed.content.npc).toBeDefined()
    expect(parsed.content.npc?.id).toBe('chiyan')
    expect(parsed.content.npc?.role).toBe('温和编辑搭档')
    expect(Object.keys(parsed.content.npc?.moments ?? {}).sort()).toEqual([...momentKeys].sort())
    for (const key of momentKeys) {
      expect(parsed.content.npc?.moments[key].invitation.trim(), key).not.toBe('')
      expect(parsed.content.npc?.moments[key].autonomy.trim(), key).not.toBe('')
    }
    expect(parsed.content.npc?.moments.safety.pose).toBe('safety')
    expect(parsed.content.npc?.moments.safety.reassurance).toContain('现实')
  })

  it.each([
    ['只有我懂你', '排他依赖'],
    ['只有迟言理解你', '排他依赖'],
    ['我会永远陪着你', '永久承诺'],
    ['迟言会永远陪着你', '永久承诺'],
    ['这样说对方一定会理解', '结果保证'],
    ['你现在必须当面对质', '强迫对质'],
  ])('rejects unsafe companion copy: %s', (invitation, expectedMessage) => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { npc: { moments: { fact: { invitation: string } } } }
    }
    invalid.content.npc.moments.fact.invitation = invitation

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path, message }) => path === 'content.npc.moments.fact.invitation' && message.includes(expectedMessage))).toBe(true)
  })

  it('keeps the safety companion moment out of confrontation rehearsal', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { npc: { moments: { safety: { reassurance: string } } } }
    }
    invalid.content.npc.moments.safety.reassurance = '现在继续演练怎样对质。'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.npc.moments.safety.reassurance')).toBe(true)
  })

  it('keeps every recommended output free of dependency and guaranteed-outcome language', () => {
    const content = parseContent(rawContent).content
    const recommended: Array<{ path: string; text: string }> = []
    const add = (path: string, values: Array<string | undefined>) => values.forEach((text) => {
      if (text) recommended.push({ path, text })
    })

    for (const scenario of content.scenarios) {
      const replay = scenario.replay
      replay.factOptions.forEach((option) => add(`${scenario.scenarioId}.fact`, [option.label, option.explanation]))
      replay.requestOptions.forEach((option) => add(`${scenario.scenarioId}.request`, [option.label, ...Object.values(option.structure)]))
      replay.practiceOptions.forEach((option) => {
        add(`${scenario.scenarioId}.practice`, [option.label])
        option.replyOptions.forEach((reply) => add(`${scenario.scenarioId}.practice`, [reply.label]))
      })
    }
    for (const rewrite of content.rewrites) {
      add(`${rewrite.scenarioId}.rewrite`, [
        ...rewrite.structure,
        ...Object.values(rewrite.tones),
        rewrite.repairLine,
        rewrite.nextTimeLine,
        rewrite.summary,
        rewrite.shareSummary,
      ])
      rewrite.nextSteps.forEach((step) => add(`${rewrite.scenarioId}.nextStep`, [step.label, step.description]))
    }
    for (const [key, moment] of Object.entries(content.npc.moments)) {
      add(`npc.${key}`, [moment.invitation, moment.reassurance, moment.autonomy])
    }

    const unsafe = /(只有(我|迟言).{0,8}(懂|理解|需要|陪)|(我会|迟言会).{0,6}(永远|一直).{0,8}(陪|守着|在)|(?<!不)(一定会|保证).{0,12}(理解|答应|原谅|改变)|(必须|现在).{0,10}(当面)?对质)/
    expect(recommended.filter(({ text }) => unsafe.test(text))).toEqual([])
  })

  it('contains the frozen launch counts and identity', () => {
    const content = parseContent(rawContent)

    expect(content.projectId).toBe('conversation-replay')
    expect(content.schemaVersion).toBe(1)
    expect(content.content.feelings).toHaveLength(48)
    expect(content.content.needs).toHaveLength(48)
    expect(content.content.scenarios).toHaveLength(32)
  })

  it('keeps scenario and referenced IDs unique', () => {
    const content = parseContent(rawContent)
    const scenarioIds = content.content.scenarios.map(({ scenarioId }) => scenarioId)
    const entityIds = [
      ...content.content.feelings.map(({ id }) => id),
      ...content.content.needs.map(({ id }) => id),
      ...content.content.choices.map(({ id }) => id),
      ...content.content.rewrites.map(({ id }) => id),
      ...content.content.safetyRules.map(({ id }) => id),
    ]

    expect(new Set(scenarioIds).size).toBe(32)
    expect(new Set(entityIds).size).toBe(entityIds.length)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'friend')).toHaveLength(6)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'partner')).toHaveLength(8)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'family')).toHaveLength(6)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'coworker')).toHaveLength(8)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'general')).toHaveLength(4)
  })

  it('provides complete alternatives and executable next steps', () => {
    const content = parseContent(rawContent)
    const rewrites = new Map(content.content.rewrites.map((rewrite) => [rewrite.id, rewrite]))

    for (const scenario of content.content.scenarios) {
      const rewrite = rewrites.get(scenario.rewriteId)
      expect(rewrite, scenario.scenarioId).toBeDefined()
      expect(rewrite?.tones.gentle.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.tones.direct.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.tones.firm.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.nextSteps.length, scenario.scenarioId).toBeGreaterThan(0)
    }
  })

  it('gives every scenario complete five-layer replay material', () => {
    const scenarios = (rawContent as unknown as {
      content: {
        scenarios: Array<{
          scenarioId: string
          replay?: {
            factOptions: unknown[]
            inferenceExpressionIds: string[]
            requestOptions: unknown[]
            practiceOptions: Array<{ replyOptions: unknown[] }>
          }
        }>
      }
    }).content.scenarios

    for (const scenario of scenarios) {
      expect(scenario.replay?.factOptions.length, scenario.scenarioId).toBeGreaterThanOrEqual(1)
      expect(scenario.replay?.inferenceExpressionIds.length, scenario.scenarioId).toBeGreaterThanOrEqual(1)
      expect(scenario.replay?.requestOptions.length, scenario.scenarioId).toBeGreaterThanOrEqual(1)
      expect(scenario.replay?.practiceOptions.length, scenario.scenarioId).toBeGreaterThanOrEqual(1)
      expect(scenario.replay?.practiceOptions.every(({ replyOptions }) => replyOptions.length >= 2), scenario.scenarioId).toBe(true)
    }
  })

  it('keeps each request answer speakable and aligned through drafting and practice', () => {
    const content = parseContent(rawContent).content
    const rewrites = new Map(content.rewrites.map((rewrite) => [rewrite.id, rewrite]))

    for (const scenario of content.scenarios) {
      if (scenario.safetyLevel === 'safety') continue
      const rewrite = rewrites.get(scenario.rewriteId)!
      const direct = rewrite.tones.direct
      expect(scenario.replay.requestOptions.some(({ label }) => label === direct), scenario.scenarioId).toBe(true)
      expect(rewrite.nextTimeLine, scenario.scenarioId).toBe(direct)
      for (const practice of scenario.replay.practiceOptions) {
        expect(practice.replyOptions.some(({ label }) => label === direct), `${scenario.scenarioId}/${practice.id}`).toBe(true)
      }
    }
  })

  it('rejects a request answer that drifts back into editing instructions', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { scenarios: Array<{ replay: { requestOptions: Array<{ label: string }> } }> }
    }
    invalid.content.scenarios[0]!.replay.requestOptions[0]!.label = '我会先说明事实，再提出请求。'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path, message }) => path.endsWith('replay.requestOptions') && message.includes('直接版表达'))).toBe(true)
  })

  it('rejects self-condemning language in a recommended repair line', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: { rewrites: Array<{ repairLine: string }> }
    }
    invalid.content.rewrites[0]!.repairLine = '刚才我攻击了你这个人。'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path, message }) => path.endsWith('repairLine') && message.includes('加重自责'))).toBe(true)
  })

  it('rejects a scenario whose five-layer replay material is missing', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as { scenarios: Array<Record<string, unknown>> }
    delete nested.scenarios[0]!.replay

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.scenarios[0].replay')).toBe(true)
  })

  it('rejects dangling replay references, incomplete requests, and unsafe practice actions', () => {
    const invalid = structuredClone(rawContent) as unknown as {
      content: {
        scenarios: Array<{
          safetyLevel: string
          replay: {
            inferenceExpressionIds: string[]
            requestOptions: Array<{ structure: { when: string } }>
            practiceOptions: Array<{ replyOptions: Array<{ action: string }> }>
          }
        }>
      }
    }
    const first = invalid.content.scenarios[0]!
    first.replay.inferenceExpressionIds[0] = 'expr-missing'
    first.replay.requestOptions[0]!.structure.when = ' '
    first.replay.practiceOptions[0]!.replyOptions.splice(1)
    const safety = invalid.content.scenarios.find(({ safetyLevel }) => safetyLevel === 'safety')!
    safety.replay.practiceOptions[0]!.replyOptions[0]!.action = 'repair'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path.endsWith('replay.inferenceExpressionIds[0]'))).toBe(true)
    expect(result.errors.some(({ path }) => path.endsWith('replay.requestOptions[0].structure.when'))).toBe(true)
    expect(result.errors.some(({ path }) => path.endsWith('replay.practiceOptions[0].replyOptions'))).toBe(true)
    expect(result.errors.some(({ path, message }) => path.endsWith('replyOptions[0].action') && message.includes('安全情境'))).toBe(true)
  })

  it('requires a safety notice for every safety scenario', () => {
    const content = parseContent(rawContent)
    const safetyRuleIds = new Set(content.content.safetyRules.map(({ id }) => id))

    for (const scenario of content.content.scenarios.filter(({ safetyLevel }) => safetyLevel === 'safety')) {
      expect(scenario.safetyRuleId, scenario.scenarioId).toBeTruthy()
      expect(safetyRuleIds.has(scenario.safetyRuleId ?? ''), scenario.scenarioId).toBe(true)
    }
  })

  it('reports paths for malformed or dangling content', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const content = invalid.content as { scenarios: Array<Record<string, unknown>> }
    content.scenarios[0] = { ...content.scenarios[0], rewriteId: 'rewrite-missing' }

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path.includes('content.scenarios[0].rewriteId'))).toBe(true)
  })

  it('rejects blank nested copy and duplicate nested IDs', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as {
      scenarios: Array<{ riskPoints: string[] }>
      rewrites: Array<{ nextSteps: Array<{ id: string; description: string }> }>
    }
    nested.scenarios[0]!.riskPoints[0] = ' '
    nested.rewrites[1]!.nextSteps[0]!.id = nested.rewrites[0]!.nextSteps[0]!.id
    nested.rewrites[1]!.nextSteps[0]!.description = ''

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path.includes('content.scenarios[0].riskPoints[0]'))).toBe(true)
    expect(result.errors.some(({ path }) => path.includes('content.rewrites[1].nextSteps[0].id'))).toBe(true)
    expect(result.errors.some(({ path }) => path.includes('content.rewrites[1].nextSteps[0].description'))).toBe(true)
  })

  it('reports malformed collection items without throwing', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as { feelings: unknown[] }
    nested.feelings[0] = null

    expect(() => validateContent(invalid, 'production')).not.toThrow()
    const result = validateContent(invalid, 'production')
    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.feelings[0]')).toBe(true)
  })

  it('rejects invalid enums and mismatched reciprocal rewrite references', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as {
      feelings: Array<{ category: string }>
      rewrites: Array<{ scenarioId: string }>
    }
    nested.feelings[0]!.category = 'invented'
    nested.rewrites[0]!.scenarioId = 'friend-cancel'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.feelings[0].category')).toBe(true)
    expect(result.errors.some(({ path }) => path === 'content.rewrites[0].scenarioId')).toBe(true)
  })
})
