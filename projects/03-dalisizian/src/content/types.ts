export type CaseVerdict = 'credible' | 'partial' | 'uncertain' | 'myth'

export type Difficulty = '入门' | '进阶' | '审慎'

export type ScreenState =
  | 'landing'
  | 'caseList'
  | 'briefing'
  | 'investigation'
  | 'scene'
  | 'dialogue'
  | 'clueBook'
  | 'evidenceDetail'
  | 'deduction'
  | 'verdict'
  | 'ending'
  | 'error'

export type CollectionConditionField =
  | 'clueIds'
  | 'evidenceIds'
  | 'unlockedSceneIds'
  | 'visitedNodeIds'
  | 'reviewedRouteIds'
  | 'styleTags'
  | 'completedCaseIds'

export type ConditionExpression =
  | { all: ConditionExpression[] }
  | { any: ConditionExpression[] }
  | { not: ConditionExpression }
  | { field: CollectionConditionField; operator: 'includes' | 'not-includes'; value: string }
  | { field: 'flags'; operator: 'equals'; key: string; value: boolean }
  | { field: 'deductionAnswers'; operator: 'answer-is'; key: string; value: string }
  | { field: 'firstDeductionAnswers'; operator: 'answer-is'; key: string; value: string }
  | { field: 'deductionAttempts'; operator: 'at-most'; key: string; value: number }

export type NodeEffect =
  | { type: 'set-flag'; flag: string; value: boolean }
  | { type: 'add-clue'; clueId: string }
  | { type: 'add-evidence'; evidenceId: string }
  | { type: 'unlock-scene'; sceneId: string }
  | { type: 'add-style-tag'; tag: string }
  | { type: 'set-initial-verdict'; verdict: CaseVerdict }
  | { type: 'set-final-verdict'; verdict: CaseVerdict }

export type NodeChoice = {
  id: string
  text: string
  nextNodeId: string
  condition?: ConditionExpression
  effects?: NodeEffect[]
}

export type ConditionBranch = {
  id: string
  nextNodeId: string
  condition?: ConditionExpression
}

export type NodeKind =
  | 'narration'
  | 'dialogue'
  | 'choice'
  | 'investigation-hub'
  | 'clue'
  | 'condition'
  | 'scene'
  | 'deduction'
  | 'ending'

export type CaseNode = {
  id: string
  caseId: string
  kind: NodeKind
  text: string
  critical: boolean
  speakerId?: string
  sceneId?: string
  routeId?: string
  choices?: NodeChoice[]
  acquireClueIds?: string[]
  acquireEvidenceIds?: string[]
  branches?: ConditionBranch[]
  deductionId?: string
  endingId?: string
}

export type Character = {
  id: string
  name: string
  title: string
  role: string
  assetId: string
  contentVersion: string
}

export type Scene = {
  id: string
  title: string
  description: string
  assetId: string
  characterIds: string[]
}

export type KnowledgeExplanation = {
  form: string
  meaning: string
  semantics: string
  certainty: string
}

export type Clue = {
  id: string
  title: string
  category: 'direct-form' | 'historical-gloss' | 'later-interpretation' | 'modern-folk'
  summary: string
  explanation: KnowledgeExplanation
  evidenceIds: string[]
  sourceIds: string[]
}

export type EvidenceVisualTemplate = 'glyph-timeline' | 'lexicon-scroll' | 'semantic-map' | 'myth-verdict'

export type EvidencePalette = 'jade' | 'cinnabar' | 'bronze' | 'ink'

export type EvidenceObservationPoint = {
  id: string
  title: string
  body: string
  sourceIds: string[]
  anchor: { x: number; y: number }
}

type EvidenceVisualBase = {
  thumbnailLabel: string
  palette: EvidencePalette
  completionPrompt: string
  fallbackSummary: string
  observationPoints: EvidenceObservationPoint[]
}

export type GlyphTimelineVisual = EvidenceVisualBase & {
  template: 'glyph-timeline'
  stages: Array<{
    id: string
    label: string
    period: string
    assetId?: string
    materialKind: 'structure-diagram' | 'database-rendering' | 'rubbing' | 'manual-tracing'
    certainty: string
    sourceIds: string[]
  }>
}

export type LexiconScrollVisual = EvidenceVisualBase & {
  template: 'lexicon-scroll'
  entries: Array<{
    id: string
    heading: string
    originalText: string
    interpretation: string
    highlight: string
    sourceIds: string[]
  }>
}

export type SemanticMapVisual = EvidenceVisualBase & {
  template: 'semantic-map'
  nodes: Array<{ id: string; label: string; detail: string }>
  edges: Array<{
    id: string
    from: string
    to: string
    label: string
    strength: 'supported' | 'possible' | 'blocked'
    sourceIds: string[]
  }>
}

export type MythVerdictVisual = EvidenceVisualBase & {
  template: 'myth-verdict'
  claim: string
  supports: string[]
  limits: string[]
  disputes: string[]
}

export type EvidenceVisualSpec = GlyphTimelineVisual | LexiconScrollVisual | SemanticMapVisual | MythVerdictVisual

export type Evidence = {
  id: string
  caseId: string
  type: '字形' | '字书' | '语义' | '辨伪'
  title: string
  body: string
  assetId: string
  visualSpec: EvidenceVisualSpec
  sourceIds: string[]
  contentVersion: string
}

export type DeductionOption = {
  id: string
  text: string
  correct: boolean
  feedback: string
  nextNodeId: string
  reviewNodeId?: string
  verdict?: CaseVerdict
}

export type DeductionQuestion = {
  id: string
  prompt: string
  requiredClueIds: string[]
  focusEvidenceIds?: string[]
  options: DeductionOption[]
}

export type InvestigationRoute = {
  id: string
  title: string
  summary: string
  entryNodeId: string
  requiredClueIds: string[]
  accent: 'cinnabar' | 'ink' | 'bronze'
}

export type ScoringRule = {
  id: string
  label: string
  points: number
  condition: ConditionExpression
}

export type CaseAssetIds = {
  characterIds: string[]
  sceneIds: string[]
  evidenceIds: string[]
}

export type HanziCase = {
  caseId: string
  title: string
  subtitle: string
  order: number
  difficulty: Difficulty
  summary: string
  opening: string
  coreCharacter: string
  coreKnowledge: string
  characterIds: string[]
  scenes: Scene[]
  clues: Clue[]
  nodeIds: string[]
  evidenceIds: string[]
  startNodeId: string
  requiredClueIds: string[]
  investigationRoutes: InvestigationRoute[]
  deductions: DeductionQuestion[]
  correctConclusion: CaseVerdict
  wrongConclusionFeedback: Record<CaseVerdict, string>
  endingIds: string[]
  scoringRules: ScoringRule[]
  unlockCondition: ConditionExpression
  assetIds: CaseAssetIds
  sourceIds: string[]
  contentVersion: string
}

export type Ending = {
  id: string
  caseId: string
  title: string
  officialVerdict: CaseVerdict
  verdictReason: string
  scholarlyUncertainty: string
  closingText: string
  sourceIds: string[]
  contentVersion: string
}

export type SourceRecord = {
  id: string
  title: string
  type: 'A' | 'B' | 'F'
  url?: string
  note: string
}

export type DalisizianContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'dalisizian'
  meta: {
    title: string
    subtitle: string
    locale: 'zh-CN'
    updatedAt: string
    disclaimer: string
  }
  sources: SourceRecord[]
  content: {
    characters: Character[]
    cases: HanziCase[]
    nodes: CaseNode[]
    evidence: Evidence[]
    endings: Ending[]
  }
}

export type ContentIndex = {
  characters: Map<string, Character>
  cases: Map<string, HanziCase>
  nodes: Map<string, CaseNode>
  evidence: Map<string, Evidence>
  endings: Map<string, Ending>
  scenes: Map<string, Scene>
  clues: Map<string, Clue>
}

export type CaseRuntimeState = {
  caseId: string
  screen: ScreenState
  currentNodeId: string
  currentSceneId?: string
  flags: Record<string, boolean>
  clueIds: string[]
  evidenceIds: string[]
  unlockedSceneIds: string[]
  visitedNodeIds: string[]
  deductionAnswers: Record<string, string>
  deductionAttempts: Record<string, number>
  firstDeductionAnswers: Record<string, string>
  reviewedRouteIds: string[]
  deductionFeedback?: string
  initialVerdict?: CaseVerdict
  finalVerdict?: CaseVerdict
  styleTags: string[]
  completed: boolean
}
