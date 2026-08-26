import { AssetIcon, type IconName } from '../../components/AssetIcon'

const steps: Array<{ label: string; icon: IconName }> = [
  { label: '事实', icon: 'fact' },
  { label: '感受', icon: 'feeling' },
  { label: '推测', icon: 'inference' },
  { label: '需要', icon: 'need' },
  { label: '请求', icon: 'request' },
]

export function StepRail({ current }: { current: number }) {
  return (
    <ol className="step-rail" aria-label={`五步编辑台，第 ${current} 步`}>
      {steps.map((step, index) => (
        <li className={index + 1 < current ? 'is-done' : index + 1 === current ? 'is-current' : ''} key={step.label}>
          <AssetIcon name={step.icon} size={20} /><span>{step.label}</span>
        </li>
      ))}
    </ol>
  )
}
