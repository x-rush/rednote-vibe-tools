import { useState } from 'react'
import { AssetIcon } from '../../components/AssetIcon'
import type { ReplayResultV2 } from '../../domain/replay'
import type { IntroContent, ToneVariant } from '../../domain/types'

function toneMeta(copy: IntroContent['result']): Record<ToneVariant, { label: string; icon: 'gentle' | 'direct' | 'firm' }> {
  return {
    gentle: { label: copy.gentleLabel, icon: 'gentle' },
    direct: { label: copy.directLabel, icon: 'direct' },
    firm: { label: copy.firmLabel, icon: 'firm' },
  }
}

export function ToneEditor({
  result,
  copy,
  edits,
  onTone,
  onEdit,
  onPractice,
  onCompare,
}: {
  result?: ReplayResultV2
  copy: IntroContent
  edits: Partial<Record<ToneVariant, string>>
  onTone(tone: ToneVariant): void
  onEdit(tone: ToneVariant, text: string): void
  onPractice(): void
  onCompare(): void
}) {
  if (!result) return <p className="empty-note">{copy.result.incompleteMessage}</p>
  const tone = result.selectedTone
  const value = edits[tone] ?? result.tones[tone]
  const tones = toneMeta(copy.result)
  return (
    <section className="tone-editor">
      <div className="tone-tabs" role="tablist" aria-label="选择表达语气">
        {(Object.keys(tones) as ToneVariant[]).map((item) => (
          <button className={item === tone ? 'is-active' : ''} role="tab" aria-selected={item === tone} type="button" key={item} onClick={() => onTone(item)}>
            <AssetIcon name={tones[item].icon} size={20} />{tones[item].label}
          </button>
        ))}
      </div>
      <label className="draft-paper">
        <span>{copy.result.editorLabel}</span>
        <textarea value={value} maxLength={280} onChange={(event) => onEdit(tone, event.target.value)} />
        <small>{value.length} / 280</small>
      </label>
      <p className="margin-note"><b>{copy.result.toneNoteTitle}</b><br />{copy.result.toneNoteBody}</p>
      <div className="button-stack">
        <button className="button primary" type="button" onClick={onPractice}>{copy.result.practiceActionLabel}</button>
        <button className="button ghost" type="button" onClick={onCompare}>{copy.result.compareActionLabel}</button>
      </div>
    </section>
  )
}

export function PracticeBoard({
  prompts,
  copy,
  onComplete,
}: {
  prompts: Array<{ id: string; label: string; replies: Array<{ id: string; label: string }> }>
  copy: IntroContent
  onComplete(optionId: string, replyId: string): void
}) {
  const [optionId, setOptionId] = useState(prompts[0]?.id ?? '')
  const active = prompts.find(({ id }) => id === optionId) ?? prompts[0]
  return (
    <section className="practice-board">
      <div className="practice-response">
        <span>{copy.result.practicePromptLabel}</span>
        {prompts.map((prompt) => <button className={prompt.id === active?.id ? 'is-active' : ''} type="button" key={prompt.id} onClick={() => setOptionId(prompt.id)}>{prompt.label}</button>)}
      </div>
      <div className="practice-replies">
        <span>{copy.result.practiceReplyLabel}</span>
        {active?.replies.map((reply) => <button type="button" key={reply.id} onClick={() => onComplete(active.id, reply.id)}>{reply.label}</button>)}
      </div>
      <p className="margin-note">{copy.result.practiceNote}</p>
    </section>
  )
}

export function BeforeAfter({ result, copy, onNext }: { result?: ReplayResultV2; copy: IntroContent; onNext(): void }) {
  if (!result) return <p className="empty-note">{copy.result.incompleteMessage}</p>
  return (
    <section className="before-after">
      <article><span>{copy.result.beforeLabel}</span><h2>{result.layers.inferences.join('、') || copy.result.beforeFallback}</h2><p>{copy.result.beforeExplanation}</p></article>
      <article><span>{copy.result.afterLabel}</span><dl>
        <div><dt>{copy.replayCard.factLabel}</dt><dd>{result.layers.facts.join('；')}</dd></div>
        <div><dt>{copy.replayCard.feelingLabel}</dt><dd>{result.layers.feelings.join('、')}</dd></div>
        <div><dt>{copy.replayCard.inferenceLabel}（{copy.replayCard.inferenceHint}）</dt><dd>{result.layers.inferences.join('；')}</dd></div>
        <div><dt>{copy.replayCard.needLabel}</dt><dd>{result.layers.needs.join('、')}</dd></div>
        <div><dt>{copy.replayCard.requestLabel}</dt><dd>{result.layers.request}</dd></div>
      </dl></article>
      <p className="margin-note">{copy.replayCard.responsibilityNotice}</p>
      <button className="button primary" type="button" onClick={onNext}>{copy.result.viewCardLabel}</button>
    </section>
  )
}

export function ReplayCard({ result, copy }: { result?: ReplayResultV2; copy: IntroContent }) {
  if (!result) return <p className="empty-note">{copy.result.cardIncompleteMessage}</p>
  return (
    <article className="replay-card-v2">
      <span>{copy.result.cardEyebrow}</span>
      <h2>{result.scenarioTitle}</h2>
      <p className="final-expression">{result.selectedText}</p>
      <dl>
        <div><dt>{copy.replayCard.factLabel}</dt><dd>{result.layers.facts.join('；')}</dd></div>
        <div><dt>{copy.replayCard.feelingLabel}</dt><dd>{result.layers.feelings.join('、')}</dd></div>
        <div><dt>{copy.replayCard.inferenceLabel}（{copy.replayCard.inferenceHint}）</dt><dd>{result.layers.inferences.join('；')}</dd></div>
        <div><dt>{copy.replayCard.needLabel}</dt><dd>{result.layers.needs.join('、')}</dd></div>
        <div><dt>{copy.replayCard.requestLabel}</dt><dd>{result.layers.request}</dd></div>
      </dl>
      <p>{result.summary}</p>
    </article>
  )
}
