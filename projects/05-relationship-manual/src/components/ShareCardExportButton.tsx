type ShareCardExportButtonProps = {
  exporting: boolean
  disabled?: boolean
  label: string
  exportingLabel: string
  description: string
  onExport: () => void
}

export function ShareCardExportButton({ exporting, disabled = false, label, exportingLabel, description, onExport }: ShareCardExportButtonProps) {
  return (
    <>
      <button className="button button--secondary" type="button" disabled={exporting || disabled} aria-describedby="share-card-export-note" onClick={onExport}>
        {exporting ? exportingLabel : label}
      </button>
      <span className="sr-only" id="share-card-export-note">{description}</span>
    </>
  )
}
