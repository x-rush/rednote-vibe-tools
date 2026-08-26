type QuestionnaireActionsProps = {
  previousDisabled: boolean
  allowSkip: boolean
  isLastQuestion: boolean
  showReturnToReview: boolean
  onPrevious: () => void
  onSkip: () => void
  onNext: () => void
  onReturnToReview: () => void
}

export function QuestionnaireActions({ previousDisabled, allowSkip, isLastQuestion, showReturnToReview, onPrevious, onSkip, onNext, onReturnToReview }: QuestionnaireActionsProps) {
  return (
    <nav className={`action-bar${allowSkip ? ' action-bar--with-skip' : ''}${showReturnToReview ? ' action-bar--editing' : ''}`} aria-label="答题操作">
      <button className="button button--ghost action-bar__previous" type="button" onClick={onPrevious} disabled={previousDisabled}>上一题</button>
      {allowSkip && <button className="button button--text action-bar__skip" type="button" onClick={onSkip}>暂不确定</button>}
      <button className="button button--primary action-bar__next" type="button" onClick={onNext}>{isLastQuestion ? '查看回顾' : '收好这张，继续'}</button>
      {showReturnToReview && <button className="button button--ghost action-bar__return" type="button" onClick={onReturnToReview}>保存修改并返回总览</button>}
    </nav>
  )
}
