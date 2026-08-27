import type { BrandIdentityCopy, DimensionDefinition, ExperienceCopy, PersonalityType } from '../content/types'
import type { QuizResult, ShareCardViewModel } from '../quiz/types'
import { getBeastAsset } from '../ui/beastAssets'

export type ShareCardModel = {
  eyebrow: string
  creatureName: string
  typeName: string
  line: string
  chibiLine: string
  quote: string
  guideLabel: string
  guideSeal: string
  guideNote: string
  preferredPoles: string[]
  brand: string
  boundary: string
  imageSrc?: string
  chibiSrc?: string
  placeholderSrc?: string
  imageFocusY: number
}

type ShareCardModelInput = {
  result: QuizResult
  profile: PersonalityType
  share: ShareCardViewModel
  dimensions: DimensionDefinition[]
  identity: BrandIdentityCopy
  copy: ExperienceCopy['shareCard']
}

export function createShareCardModel(input: ShareCardModelInput): ShareCardModel {
  const asset = getBeastAsset(input.result.code)
  const preferredPoles = input.result.summary.dimensions.map((dimension) => {
    const definition = input.dimensions.find((item) => item.code === dimension.dimension)
    return definition?.poles.find((pole) => pole.code === dimension.preferredPole)?.name ?? ''
  })

  return {
    eyebrow: input.copy.cardEyebrow,
    creatureName: input.share.creatureName,
    typeName: input.share.typeName,
    line: input.share.line,
    chibiLine: input.profile.recognitionCard.blessing,
    quote: input.profile.shareQuotes[0],
    guideLabel: input.copy.guideLabel,
    guideSeal: input.copy.guideSeal,
    guideNote: input.profile.wenshanNote,
    preferredPoles,
    brand: input.identity.formalName,
    boundary: input.identity.boundary,
    imageSrc: asset?.src,
    chibiSrc: asset?.chibiSrc,
    placeholderSrc: asset?.placeholder,
    imageFocusY: asset?.shareFocusY ?? 0.5,
  }
}
