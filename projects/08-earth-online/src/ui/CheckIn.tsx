import type { EarthOnlineContent, EnergyLevel, QuestPreference, TimeCost } from '../content/schema'

type CheckInProps = {
  content: EarthOnlineContent
  preference: QuestPreference
  onChange: (preference: QuestPreference) => void
  onSubmit: () => void
}

export function CheckIn({ content, preference, onChange, onSubmit }: CheckInProps) {
  const copy = content.content.ui
  const update = <K extends keyof QuestPreference>(key: K, value: QuestPreference[K]) => {
    onChange({ ...preference, [key]: value, ...(key === 'environment' ? { location: value === 'indoor' ? 'familiar-indoor' : 'familiar-public-area' } : {}) })
  }
  return (
    <form className="check-in" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <ChoiceField legend={copy.checkIn.legends.time}>
        {([5, 10, 15, 20] as TimeCost[]).map((value) => <Choice key={value} selected={preference.minutes === value} onClick={() => update('minutes', value)}>{copy.checkIn.timeLabels[value]}</Choice>)}
      </ChoiceField>
      <ChoiceField legend={copy.checkIn.legends.energy}>
        {([1, 2, 3] as EnergyLevel[]).map((value) => <Choice key={value} selected={preference.energy === value} onClick={() => update('energy', value)}><span className={`energy-dots energy-dots--${value}`} aria-hidden="true" />{copy.checkIn.energyLabels[value - 1]}</Choice>)}
      </ChoiceField>
      <ChoiceField legend={copy.checkIn.legends.environment}>
        {(['indoor', 'outdoor'] as const).map((value) => <Choice key={value} selected={preference.environment === value} onClick={() => update('environment', value)}>{copy.checkIn.environmentLabels[value]}</Choice>)}
      </ChoiceField>
      <ChoiceField legend={copy.checkIn.legends.social}>
        {(['none', 'optional'] as const).map((value) => <Choice key={value} selected={preference.social === value} onClick={() => update('social', value)}>{copy.checkIn.socialLabels[value]}</Choice>)}
      </ChoiceField>
      <ChoiceField legend={copy.checkIn.legends.goal}>
        {content.content.goals.map((goal) => <Choice key={goal.id} selected={preference.goalId === goal.id} onClick={() => update('goalId', goal.id)}>{goal.name}</Choice>)}
      </ChoiceField>
      <ChoiceField legend={copy.checkIn.legends.dayPart}>
        {(['day', 'night'] as const).map((value) => <Choice key={value} selected={preference.timeOfDay === value} onClick={() => update('timeOfDay', value)}>{copy.checkIn.dayPartLabels[value]}</Choice>)}
      </ChoiceField>
      <p className="inline-notice">{copy.notices.privacy}</p>
      <button className="button button--primary button--large" type="submit">{copy.actions.match}</button>
    </form>
  )
}

function ChoiceField({ legend, children }: { legend: string; children: React.ReactNode }) {
  return <fieldset className="choice-field"><legend className="visually-hidden">{legend}</legend><span className="choice-field__title" aria-hidden="true">{legend}</span><div className="choice-grid">{children}</div></fieldset>
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="choice" aria-pressed={selected} onClick={onClick}>{children}</button>
}
