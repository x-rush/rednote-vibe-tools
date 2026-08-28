export function ErrorPanel({ title, description, detail, actionLabel, onAction }: {
  title: string
  description: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <section className="error-panel" role="alert" aria-live="assertive">
      <span className="error-panel__glyph" aria-hidden="true">!</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {detail && <small>{detail}</small>}
      {actionLabel && onAction && <button className="hatchery-start" type="button" onClick={onAction}>{actionLabel}</button>}
    </section>
  )
}
