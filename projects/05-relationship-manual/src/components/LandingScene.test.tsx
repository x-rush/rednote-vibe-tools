import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { NpcCue } from '../content/schema'
import { LandingScene } from './LandingScene'

const landingCue: NpcCue = {
  cueId: 'cue-landing',
  trigger: 'landing',
  pose: 'daily',
  speaker: '小满',
  roleLabel: '关系卡片整理员',
  text: '把难以开口的需要，慢慢整理成可以继续商量的句子。',
  primaryAction: '开始整理',
  skippable: false,
}

describe('LandingScene', () => {
  it('renders a divided landing title as exactly two intentional lines', () => {
    const html = renderToStaticMarkup(
      <LandingScene
        cue={landingCue}
        title="深夜信笺编辑部｜关系说明书"
        eyebrow="关系说明书"
        lead="和小满一起整理相处中的需要。"
        privacyTitle="不上传你的回答"
        privacyBody="所有内容只保存在当前设备。"
        hasDraft={false}
        draftAnswers={0}
        questionCount={21}
        onRestore={() => undefined}
        onStart={() => undefined}
      />,
    )

    expect(html).toContain('<span class="hero__title-line">深夜信笺编辑部</span><span class="hero__title-line">关系说明书</span>')
  })

  it('places Xiaoman before privacy details and the primary action in reading order', () => {
    const html = renderToStaticMarkup(
      <LandingScene
        cue={landingCue}
        title="深夜信笺编辑部"
        eyebrow="关系说明书"
        lead="和小满一起整理相处中的需要。"
        privacyTitle="不上传你的回答"
        privacyBody="所有内容只保存在当前设备。"
        hasDraft={false}
        draftAnswers={0}
        questionCount={21}
        onRestore={() => undefined}
        onStart={() => undefined}
      />,
    )

    const titlePosition = html.indexOf('深夜信笺编辑部')
    const xiaomanPosition = html.indexOf('小满，关系卡片整理员')
    const privacyPosition = html.indexOf('不上传你的回答')
    const actionPosition = html.indexOf('开始整理')

    expect(titlePosition).toBeGreaterThan(-1)
    expect(xiaomanPosition).toBeGreaterThan(titlePosition)
    expect(privacyPosition).toBeGreaterThan(xiaomanPosition)
    expect(actionPosition).toBeGreaterThan(privacyPosition)
    expect(html).toContain('./assets/guide/xiaoman-daily-v2.webp')
  })
})
