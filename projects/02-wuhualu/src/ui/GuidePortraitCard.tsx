type GuidePortraitCardProps = {
  variant: 'landing' | 'intro'
  imageSrc: string
  imageAlt: string
  guideName: string
  guideRole: string
  line: string
}

const uncroppedPortraitStyle = { aspectRatio: '3 / 4', objectFit: 'contain' } as const

export function GuidePortraitCard({ variant, imageSrc, imageAlt, guideName, guideRole, line }: GuidePortraitCardProps) {
  return (
    <figure className={`guide-portrait-card guide-portrait-card--${variant}`}>
      <div className="guide-portrait-card__media">
        <img src={imageSrc} alt={imageAlt} width="900" height="1200" style={uncroppedPortraitStyle} />
      </div>
      <figcaption>
        <span>{guideRole} · {guideName}</span>
        <blockquote>“{line}”</blockquote>
      </figcaption>
    </figure>
  )
}
