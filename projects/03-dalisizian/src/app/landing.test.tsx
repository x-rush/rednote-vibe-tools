/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LandingHeroModel } from './viewModel'
import * as appModule from '../App'

type LandingScreenProps = {
  model: LandingHeroModel
  title: string
  subtitle: string
  disclaimer: string
  portraitSrc?: string
  onPrimary: () => void
  onOpenCaseList: () => void
  onOpenCollection: () => void
  onOpenGuide: () => void
  onClearData: () => void
}

const model: LandingHeroModel = {
  companion: {
    name: '沈砚',
    title: '大理寺录事',
    role: '管理案卷、说明程序与证据方法，不代替玩家作答。',
    assetId: 'asset-character-temple-official',
  },
  currentCase: undefined,
  primaryCase: { caseId: 'case-home-roof-pig', order: 1, title: '家字失踪案' },
  primaryAction: 'case',
  primaryMode: 'new',
  primaryLabel: '领取第一案',
  primaryStatus: '新案候审',
  primaryTitle: '家字失踪案',
  completedCount: 0,
  totalCases: 8,
}

describe('landing screen', () => {
  it('makes Shen Yan the interactive hero without displacing the case actions', () => {
    const LandingScreen = (appModule as Partial<typeof appModule & { LandingScreen: ComponentType<LandingScreenProps> }>).LandingScreen
    const html = LandingScreen ? renderToStaticMarkup(createElement(LandingScreen, {
      model,
      title: '大理寺字案录',
      subtitle: '一卷一字，一案一证。',
      disclaimer: '本作不替代专业研究。',
      portraitSrc: '/assets/characters/shenyan/shenyan-master-v3.webp',
      onPrimary: () => undefined,
      onOpenCaseList: () => undefined,
      onOpenCollection: () => undefined,
      onOpenGuide: () => undefined,
      onClearData: () => undefined,
    })) : ''

    expect(html).toContain('沈砚全身立绘')
    expect(html).toContain('大理寺录事')
    expect(html).toContain('管理案卷、说明程序与证据方法')
    expect(html).toContain('领取第一案')
    expect(html).toContain('案卷柜')
    expect(html).toContain('断案图鉴')
    expect(html).toContain('听沈砚说明查案方法')
  })

  it('keeps every visible landing action at least 44 CSS pixels tall', () => {
    const appCss = readFileSync(resolve('src/App.css'), 'utf8')
    expect(appCss).toMatch(/\.landing-clear\s*\{[^}]*min-height:\s*44px/)
  })

  it('allows the companion introduction to wrap instead of clipping it', () => {
    const appCss = readFileSync(resolve('src/App.css'), 'utf8')
    const roleRule = appCss.match(/\.landing-companion-plaque i\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(roleRule).toContain('white-space: normal')
    expect(roleRule).not.toContain('text-overflow: ellipsis')
  })
})
