import type { MorningIntelView } from '../state/view-model'
import { AyuanStage } from './AyuanStage'

type Copy = Record<string, string>

export function MorningIntel({ intel, name, role, hint, copy, onContinue }: {
  intel: MorningIntelView
  name: string
  role: string
  hint: string
  copy: Copy
  onContinue: () => void
}) {
  return <section className="paper-panel morning-panel" aria-labelledby="morning-title">
    <p className="section-kicker">{copy.todayIntel}</p>
    <h2 id="morning-title">{intel.seasonName} · {intel.weatherName}</h2>
    <AyuanStage variant="morning" tone="neutral" name={name} role={role} text={hint} />
    <dl className="morning-intel-grid">
      <div><dt>{copy.forecastWeatherLabel}</dt><dd><strong>{intel.weatherName}</strong><span>{intel.weatherEffect}</span></dd></div>
      <div><dt>{copy.marketSignalLabel}</dt><dd>{intel.marketSignal}</dd></div>
      <div className="morning-yesterday"><dt>{copy.yesterdayInsightLabel}</dt><dd>{intel.yesterdayInsight}</dd></div>
    </dl>
    <button className="primary-action" type="button" onClick={onContinue}>{copy.goPreparation}</button>
  </section>
}
