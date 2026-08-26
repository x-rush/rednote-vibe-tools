import { GUIDE_ASSETS } from './assets'
import { GuidePortrait } from './GuidePortrait'

type GuideSheetProps = {
  mode?: 'first-use' | 'help'
  onClose: () => void
  onContinue?: () => void
}

export function GuideSheet({ mode = 'first-use', onClose, onContinue }: GuideSheetProps) {
  if (mode === 'help') {
    return (
      <section className="bottom-sheet guide-help" role="dialog" aria-modal="true" aria-labelledby="guide-help-title">
        <div className="sheet-handle" aria-hidden="true" />
        <GuidePortrait variant="help">
          <p className="eyebrow">问路岚</p>
          <strong>卡住时，就看这一页。</strong>
        </GuidePortrait>
        <header className="guide-heading-row">
          <div><strong id="guide-help-title">问路岚</strong><small>不改变当前清单状态</small></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭路岚帮助">×</button>
        </header>
        <div className="guide-help-list">
          <p><strong>为什么出现这一项？</strong><small>每项都会列出场景和条件来源。</small></p>
          <p><strong>怎样精简清单？</strong><small>先保留必带，再按需要隐藏可选内容。</small></p>
          <p><strong>最后一分钟是什么？</strong><small>只看还没完成的关键项和确认项。</small></p>
        </div>
        <button className="primary-button" type="button" onClick={onClose}>回到原来的位置</button>
      </section>
    )
  }

  return (
    <section className="bottom-sheet guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="guide-visual">
        <img src={GUIDE_ASSETS.master} alt="" />
      </div>
      <div className="guide-sheet-copy">
        <div className="guide-title-row">
          <div><strong>路岚</strong><small>出门前的第二双眼睛</small></div>
          <span className="step-code">三步法</span>
        </div>
        <h2 id="guide-title">三步就好。</h2>
        <p>去哪里、补几项条件、只留下这趟容易忘的东西。</p>
        <div className="split-actions">
          <button className="secondary-button" type="button" onClick={onClose}>跳过</button>
          <button className="primary-button" type="button" onClick={onContinue ?? onClose}>继续</button>
        </div>
      </div>
    </section>
  )
}
