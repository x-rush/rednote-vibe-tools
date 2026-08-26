import { describe, expect, it } from 'vitest'
import checklistSource from './ChecklistWorkspace.tsx?raw'
import completionSource from './CompletionScreen.tsx?raw'
import wizardSource from './ConditionWizard.tsx?raw'
import guideSheetSource from './GuideSheet.tsx?raw'
import homeSource from './HomeScreen.tsx?raw'
import lastMinuteSource from './LastMinuteMode.tsx?raw'
import recoverySource from './RecoveryScreen.tsx?raw'
import savedSource from './SavedListsScreen.tsx?raw'

describe('guide screen integration', () => {
  it('keeps every approved large portrait stage wired into its screen', () => {
    expect(homeSource).toContain('<GuidePortrait variant="home">')
    expect(wizardSource).toContain('<GuidePortrait variant="wizard">')
    expect(checklistSource).toContain('<GuidePortrait variant="summary" interactive onActivate={onHelp} />')
    expect(guideSheetSource).toContain('<GuidePortrait variant="help">')
    expect(lastMinuteSource).toContain('<GuidePortrait variant="urgent">')
    expect(completionSource).toContain('<GuidePortrait variant="completion">')
  })

  it('keeps the home title on the paper instead of competing with the portrait', () => {
    const portraitEnd = homeSource.indexOf('</GuidePortrait>')
    const paperStart = homeSource.indexOf('<section className="home-paper"')
    const title = homeSource.indexOf('<h1 id="home-title">今天去哪儿？</h1>')

    expect(homeSource).toContain('home-guide-message')
    expect(title).toBeGreaterThan(portraitEnd)
    expect(title).toBeGreaterThan(paperStart)
  })

  it('keeps compact guide identity on saved and recoverable screens', () => {
    expect(savedSource).toContain('compact-guide-heading')
    expect(recoverySource).toContain('compact-guide-heading recovery-guide')
  })

  it('does not repeat a small avatar beside an existing large guide portrait', () => {
    expect(guideSheetSource).not.toContain('GUIDE_ASSETS.avatar')
    expect(guideSheetSource).not.toContain('guide-identity')
  })

  it('advances directly from answer buttons without a redundant next button', () => {
    expect(wizardSource).toContain('onAnswer(definition.key, option.value)')
    expect(wizardSource).not.toContain("'下一题'")
    expect(wizardSource).toContain('wizard-navigation')
  })

  it('moves focus to the new question after direct advancement', () => {
    expect(wizardSource).toContain('questionTitleRef.current?.focus()')
    expect(wizardSource).toContain('ref={questionTitleRef}')
    expect(wizardSource).toContain('tabIndex={-1}')
  })

  it('uses two columns for number presets as well as other answers', () => {
    expect(wizardSource).toContain('className="option-grid answer-options compact-options"')
  })

  it('resets last-minute mode before paint through the tested viewport helper', () => {
    expect(lastMinuteSource).toContain('useLayoutEffect')
    expect(lastMinuteSource).toContain('resetPageScroll(window)')
  })
})
