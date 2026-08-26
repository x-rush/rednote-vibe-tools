# Relationship-specific Question Banks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared 21-question flow with three isolated, emotionally accurate 21-question banks and generate context-matched results without discarding semantically equivalent V2 draft answers.

**Architecture:** `content.json` becomes a schema-3 package whose `relationshipBanks` object owns all questions, boundaries, result fragments, merge rules, and fallbacks for one relationship context. A single selector supplies the active bank to validation, profile/card generation, storage, and the React flow; shared code retains only chapters, dimensions, safety policy, NPC framing, and card layout rules.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Vite 8, localStorage; no new dependencies.

**Spec:** `projects/05-relationship-manual/QUESTION-BANK-V3-DESIGN.md`

## Global Constraints

- Modify only `projects/05-relationship-manual`.
- Business content remains exclusively in `src/content/content.json`.
- Keep the app a static frontend: no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unapproved device API.
- Do not store user images, Base64, audio, video, or Blob data.
- Each relationship context has exactly 21 questions, with exactly 3 questions in each of the 7 frozen chapters.
- Question, option, boundary, and sentence IDs use `close-`, `friend-`, or `family-` prefixes and never cross bank boundaries.
- An answer/result mapping preserves scene, grammatical subject, action, and intensity.
- Safety advice is fixed copy and never competes with preferences in a selectable option.
- Existing NPC, result editing, compact card, image export, and expiring-toast behavior remains unchanged.
- Do not add dependencies or modify the root lockfile.
- Final verification is `pnpm lint && pnpm test && pnpm build`, followed by 375, 390, and 430 CSS px checks.

---

## File map

- `src/content/schema.ts`: schema-3 types, including `RelationshipBank`, `ResultVoice`, and answer migrations.
- `src/content/bank.ts`: the only public selector for a relationship bank and helpers for all-bank ID maps.
- `src/content/content.json`: all three question/result banks and V2-to-V3 semantic answer mappings.
- `src/content/validate.ts`: structural, isolation, reachability, voice, intensity, and neutral-option validation.
- `src/content/content.test.ts`: contract tests for all 63 questions and three result banks.
- `src/content/semantic-audit.test.ts`: explicit event/subject/output audit for every question.
- `src/domain/profile.ts`: score and provenance generation from only the selected relationship bank.
- `src/domain/card.ts`: section, fallback, conflict, and summary generation from only the selected result bank.
- `src/domain/relationship.test.ts`: per-context profile/card behavior and regression mappings.
- `src/storage/storage.ts`: context-aware draft cleaning and V2 answer migration reporting.
- `src/storage/storage.test.ts`: preserved-answer, rejected-cross-bank, and partial-migration tests.
- `src/App.tsx`: selects one bank from application state and passes it through the existing flow.
- `src/app/view-model.test.ts`, `src/app/presentation.test.ts`: active-bank missing-answer and progress tests.
- `src/components/QuestionSheet.tsx`: accurate single/multiple-choice helper text.
- `src/components/QuestionSheet.test.tsx`: helper-copy regression.
- `VISUAL-QA.md`: records 375/390/430 verification for all three relationship flows.

---

### Task 1: Introduce schema-3 bank contracts and author the three content banks

**Files:**
- Create: `projects/05-relationship-manual/src/content/bank.ts`
- Create: `projects/05-relationship-manual/src/content/semantic-audit.test.ts`
- Modify: `projects/05-relationship-manual/src/content/schema.ts`
- Modify: `projects/05-relationship-manual/src/content/validate.ts`
- Modify: `projects/05-relationship-manual/src/content/content.json`
- Modify: `projects/05-relationship-manual/src/content/content.test.ts`

**Interfaces:**
- Produces: `getRelationshipBank(content, context): RelationshipBank`.
- Produces: `getAllQuestions(content): RelationshipQuestion[]` and `getAllSentences(content): ManualSentence[]` for storage/reference construction only.
- Produces: schema-3 `RelationshipContentPackage` with `relationshipBanks` and `answerMigrations`.
- Produces: each `RelationshipQuestion` has `resultVoices`; each `ManualSentence` has `voice` and `intensity`.

- [ ] **Step 1: Add failing contract tests for three isolated 21-question banks**

Replace shared-array expectations in `src/content/content.test.ts` with explicit per-context assertions:

```ts
import { describe, expect, it } from 'vitest'
import { getValidatedContent, validateContent } from './validate'
import { getRelationshipBank } from './bank'
import type { RelationshipContext } from './schema'

const contexts: RelationshipContext[] = ['close-relationship', 'friendship', 'family']
const categories = ['contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair'] as const
const prefixes: Record<RelationshipContext, string> = {
  'close-relationship': 'close-',
  friendship: 'friend-',
  family: 'family-',
}

describe('schema 3 relationship banks', () => {
  const content = getValidatedContent()

  it.each(contexts)('%s has exactly 21 isolated questions and three per chapter', (context) => {
    const bank = getRelationshipBank(content, context)
    expect(bank.questions).toHaveLength(21)
    for (const category of categories) {
      expect(bank.questions.filter((question) => question.category === category)).toHaveLength(3)
    }
    expect(bank.questions.every((question) => question.questionId.startsWith(prefixes[context]))).toBe(true)
    expect(bank.questions.flatMap((question) => question.options)
      .every((option) => option.optionId.startsWith(prefixes[context]))).toBe(true)
    expect(bank.sentenceFragments.every((sentence) => sentence.textKey.startsWith(prefixes[context]))).toBe(true)
  })

  it('rejects an option that references another relationship bank', () => {
    const broken = structuredClone(content)
    broken.content.relationshipBanks.family.questions[0]!.options[0]!.resultTextKeys = [
      broken.content.relationshipBanks.friendship.sentenceFragments[0]!.textKey,
    ]
    const result = validateContent(broken)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('cross-bank result key'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
cd projects/05-relationship-manual
pnpm test src/content/content.test.ts
```

Expected: FAIL because schema 2 has `content.questions` and no `relationshipBanks` or bank selector.

- [ ] **Step 3: Add the schema-3 types and bank selector**

In `src/content/schema.ts`, replace global question/result ownership with these exact interfaces:

```ts
export type ResultVoice = 'request' | 'boundary' | 'self-commitment'

export type RelationshipQuestion = {
  questionId: string
  category: RelationshipCategory
  sceneLead: string
  prompt: string
  resultVoices: ResultVoice[]
  multiple: boolean
  selectionLimit: { min: number; max: number }
  options: RelationshipOption[]
  skipRule: { allowed: boolean; reason: string }
  version: number
}

export type ManualSentence = {
  textKey: string
  sourceSectionId: string
  cardSectionId: CardSectionId
  kind: SentenceKind
  role: SentenceRole
  voice: ResultVoice
  intensity: 1 | 2 | 3
  text: string
  sensitive: boolean
  compactDefault: boolean
}

export type RelationshipBank = {
  questions: RelationshipQuestion[]
  boundaryPreferences: BoundaryPreference[]
  sentenceFragments: ManualSentence[]
  conflictMergeRules: ConflictMergeRule[]
  boundaryCommitmentRules: Array<{ boundaryId: string; textKeys: string[] }>
  defaultCommitmentTextKeys: string[]
  sectionFallbacks: Record<CardSectionId, { needText: string; actionText: string }>
}

export type AnswerMigration = {
  fromContentVersion: '2.0.0'
  byContext: Record<RelationshipContext, Record<string, {
    questionId: string
    optionIds: Record<string, string>
  }>>
}
```

Change `PreferenceDimension.fallbackTextKey` to:

```ts
fallbackTextKeys: Record<RelationshipContext, string>
```

Change the content package to `schemaVersion: 3`; add:

```ts
relationshipBanks: Record<RelationshipContext, RelationshipBank>
answerMigrations: AnswerMigration[]
```

Move relationship-specific merge, commitment, and fallback fields out of shared `CardRules`.

Create `src/content/bank.ts`:

```ts
import type {
  ManualSentence,
  RelationshipBank,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipQuestion,
} from './schema'

export const RELATIONSHIP_CONTEXTS: RelationshipContext[] = [
  'close-relationship',
  'friendship',
  'family',
]

export function getRelationshipBank(
  content: RelationshipContentPackage,
  context: RelationshipContext,
): RelationshipBank {
  return content.content.relationshipBanks[context]
}

export function getAllQuestions(content: RelationshipContentPackage): RelationshipQuestion[] {
  return RELATIONSHIP_CONTEXTS.flatMap((context) => getRelationshipBank(content, context).questions)
}

export function getAllSentences(content: RelationshipContentPackage): ManualSentence[] {
  return RELATIONSHIP_CONTEXTS.flatMap((context) => getRelationshipBank(content, context).sentenceFragments)
}
```

- [ ] **Step 4: Rewrite validation around one bank at a time**

In `src/content/validate.ts`, make schema validation iterate `RELATIONSHIP_CONTEXTS`. For each bank, construct local `questionIds`, `optionIds`, `boundaryIds`, and `textKeys`, and enforce:

```ts
const prefixes: Record<RelationshipContext, string> = {
  'close-relationship': 'close-',
  friendship: 'friend-',
  family: 'family-',
}

for (const context of RELATIONSHIP_CONTEXTS) {
  const bank = relationshipBanks[context]
  const prefix = prefixes[context]
  if (bank.questions.length !== 21) errors.push(`${base}.questions: expected 21 questions`)
  for (const category of CHAPTER_CATEGORIES) {
    if (bank.questions.filter((question) => question.category === category).length !== 3) {
      errors.push(`${base}.questions: expected 3 questions for ${category}`)
    }
  }
  // Validate IDs against prefix and references against this bank's local sets.
}
```

For every option/result mapping, enforce voice, intensity, and neutral semantics:

```ts
const sentence = sentenceByKey.get(textKey)
if (!sentence) errors.push(`${optionBase}.resultTextKeys: cross-bank result key "${textKey}"`)
else {
  if (!question.resultVoices.includes(sentence.voice)) errors.push(`${optionBase}: result voice mismatch`)
  if (Math.abs(option.intensity - sentence.intensity) > 1 && !sentence.sensitive) {
    errors.push(`${optionBase}: result intensity mismatch`)
  }
}
if ((option.neutral || option.tags.includes('not-applicable'))
  && (option.resultTextKeys.length > 0 || option.boundaryIds.length > 0)) {
  errors.push(`${optionBase}: neutral option must not generate results`)
}
```

Reachability is the union of option result keys, contextual dimension fallbacks, boundary text keys, merge replacements, commitment rules, defaults, and section fallbacks. Report every sentence not in that union.

- [ ] **Step 5: Author all three banks in `content.json`**

Set `schemaVersion` to `3`, `contentVersion` to `3.0.0`, and replace the global `questions`, `boundaryPreferences`, and `sentenceFragments` arrays with `relationshipBanks`.

Use the exact 63-event matrix in specification section 3. Use these exact question IDs so the audit and later UI tests are deterministic:

```ts
const expectedQuestionIds = {
  'close-relationship': [
    'close-contact-busy', 'close-contact-delay', 'close-contact-plan-change',
    'close-listening-first-response', 'close-listening-questions', 'close-listening-capacity',
    'close-conflict-tone', 'close-conflict-pause', 'close-conflict-memory',
    'close-space-announce', 'close-space-checkin', 'close-space-social-time',
    'close-care-actions', 'close-care-language', 'close-care-touch-consent',
    'close-boundary-device', 'close-boundary-intimacy', 'close-boundary-public-sharing',
    'close-repair-apology', 'close-repair-change', 'close-repair-follow-up',
  ],
  friendship: [
    'friend-contact-frequency', 'friend-contact-delay', 'friend-contact-plan-change',
    'friend-listening-response', 'friend-listening-capacity', 'friend-listening-support-mode',
    'friend-conflict-private-talk', 'friend-conflict-jokes', 'friend-conflict-values',
    'friend-space-busy-season', 'friend-space-social-pause', 'friend-space-new-friends',
    'friend-care-checkin', 'friend-care-ask-first', 'friend-care-support-limits',
    'friend-boundary-confidentiality', 'friend-boundary-sharing', 'friend-boundary-refusal',
    'friend-repair-accountability', 'friend-repair-group-misunderstanding', 'friend-repair-trust',
  ],
  family: [
    'family-contact-checkin', 'family-contact-delay', 'family-contact-plan-change',
    'family-listening-first-response', 'family-listening-advice', 'family-listening-respect',
    'family-conflict-current-event', 'family-conflict-authority', 'family-conflict-pause',
    'family-space-room', 'family-space-decisions', 'family-space-distance',
    'family-care-preference', 'family-care-illness', 'family-care-worry',
    'family-boundary-private-topics', 'family-boundary-decisions', 'family-boundary-relatives',
    'family-repair-no-bypass', 'family-repair-impact', 'family-repair-change',
  ],
} as const
```

For each question, write three or four concrete, non-judgmental options. Make an item single-choice only when actions are mutually exclusive or the prompt asks for the most important one. Add a `not-applicable` neutral option to touch, shared-device, cohabitation/distance, group-chat, lending, and other non-universal situations.

Write one precise result sentence for each distinct selected action unless two choices within the same bank are semantically identical. Examples of required direction:

```json
{
  "optionId": "close-space-checkin-nearby",
  "text": "安静待在附近，不急着追问",
  "intensity": 2,
  "resultTextKeys": ["close-space-request-quiet-presence"]
}
```

```json
{
  "textKey": "close-space-request-quiet-presence",
  "role": "need",
  "voice": "request",
  "intensity": 2,
  "text": "我需要缓一缓时，希望你可以安静留在附近，不催我立刻说明。",
  "sensitive": false
}
```

Do not reuse the old incorrect mappings for delayed replies, quiet presence, light check-ins, plan changes, apology requests, repair follow-ups, group pressure, or threat language.

- [ ] **Step 6: Add the explicit 63-question semantic audit**

Create `src/content/semantic-audit.test.ts`. Assert the exact ID lists above, then audit each option/result pair as real content rather than snapshots of implementation objects:

```ts
it.each(contexts)('%s has no dead result fragments', (context) => {
  const bank = getRelationshipBank(content, context)
  const reachable = new Set([
    ...bank.questions.flatMap((question) => question.options.flatMap((option) => option.resultTextKeys)),
    ...bank.boundaryPreferences.map((boundary) => boundary.textKey),
    ...bank.boundaryCommitmentRules.flatMap((rule) => rule.textKeys),
    ...bank.defaultCommitmentTextKeys,
    ...content.content.dimensions.map((dimension) => dimension.fallbackTextKeys[context]),
  ])
  expect(bank.sentenceFragments.filter((sentence) => !reachable.has(sentence.textKey))).toEqual([])
})

it('keeps ordinary delayed replies separate from punitive disappearance', () => {
  const bank = getRelationshipBank(content, 'close-relationship')
  const question = bank.questions.find((item) => item.questionId === 'close-contact-delay')!
  const ordinary = question.options.find((item) => item.tags.includes('flexible-delay'))!
  const textByKey = new Map(bank.sentenceFragments.map((item) => [item.textKey, item.text]))
  const output = ordinary.resultTextKeys.map((key) => textByKey.get(key)).join('')
  expect(output).not.toMatch(/惩罚|逼迫|冷暴力/u)
})

it('keeps quiet presence distinct from solitude', () => {
  const bank = getRelationshipBank(content, 'close-relationship')
  const sentence = bank.sentenceFragments.find((item) => item.textKey === 'close-space-request-quiet-presence')!
  expect(sentence.text).toContain('留在附近')
  expect(sentence.text).not.toContain('完整独处')
})

it('keeps plan rescheduling about notice and a new plan', () => {
  const bank = getRelationshipBank(content, 'close-relationship')
  const sentence = bank.sentenceFragments.find((item) => item.textKey === 'close-contact-request-reschedule')!
  expect(sentence.voice).toBe('request')
  expect(sentence.text).toMatch(/提前|改时间|重新约/u)
  expect(sentence.text).not.toMatch(/评价|恶意/u)
})

it('keeps an apology request in the other-person request voice', () => {
  const bank = getRelationshipBank(content, 'close-relationship')
  const sentence = bank.sentenceFragments.find((item) => item.textKey === 'close-repair-request-impact-apology')!
  expect(sentence.voice).toBe('request')
  expect(sentence.text).toMatch(/希望|承认|影响/u)
  expect(sentence.text).not.toMatch(/^我愿意/u)
})

it('keeps a later repair check-in about following up', () => {
  const bank = getRelationshipBank(content, 'close-relationship')
  const sentence = bank.sentenceFragments.find((item) => item.textKey === 'close-repair-request-follow-up')!
  expect(sentence.text).toMatch(/过一段时间|之后|再确认/u)
  expect(sentence.text).not.toMatch(/暂停后回来/u)
})

it('names group triangulation directly in the friendship bank', () => {
  const bank = getRelationshipBank(content, 'friendship')
  const sentence = bank.sentenceFragments.find((item) => item.textKey === 'friend-conflict-boundary-no-group-pressure')!
  expect(sentence.voice).toBe('boundary')
  expect(sentence.text).toMatch(/群|站队|当众/u)
  expect(sentence.text).not.toMatch(/我说不/u)
})

it('does not leak breakup or intimacy wording into friendship and family results', () => {
  for (const context of ['friendship', 'family'] as const) {
    const bankText = JSON.stringify(getRelationshipBank(content, context))
    expect(bankText).not.toMatch(/分手|亲密接触/u)
  }
})

it('keeps external safety help outside selectable preferences', () => {
  const optionText = contexts.flatMap((context) => getRelationshipBank(content, context).questions)
    .flatMap((question) => question.options)
    .map((option) => `${option.text}${option.subtitle}`)
    .join('')
  expect(optionText).not.toMatch(/危险时.*向外求助|报警|求助热线/u)
  expect(content.content.safetyRules.some((rule) => /外部帮助|报警|紧急/u.test(rule.label))).toBe(true)
})

it.each([
  ['close-relationship', 'close-contact-plan-change'],
  ['friendship', 'friend-boundary-sharing'],
  ['family', 'family-repair-change'],
] as const)('%s %s makes combinable choices multi-select or asks for one priority', (context, questionId) => {
  const question = getRelationshipBank(content, context).questions.find((item) => item.questionId === questionId)!
  expect(question.multiple || /最重要|最需要|更在意|更希望/u.test(question.prompt)).toBe(true)
})
```

These named assertions are the minimum regression set; preserve them as content changes rather than replacing them with broad snapshots.

- [ ] **Step 7: Run content tests and confirm GREEN**

Run:

```bash
pnpm test src/content/content.test.ts src/content/semantic-audit.test.ts
```

Expected: PASS with 63 questions, no cross-bank references, no dead fragments, and all named semantic regressions green.

- [ ] **Step 8: Commit the content contract slice**

```bash
git add projects/05-relationship-manual/src/content/schema.ts \
  projects/05-relationship-manual/src/content/bank.ts \
  projects/05-relationship-manual/src/content/validate.ts \
  projects/05-relationship-manual/src/content/content.json \
  projects/05-relationship-manual/src/content/content.test.ts \
  projects/05-relationship-manual/src/content/semantic-audit.test.ts
git commit -m "feat: add independent relationship question banks"
```

---

### Task 2: Make profile and card generation context-bound

**Files:**
- Modify: `projects/05-relationship-manual/src/domain/profile.ts`
- Modify: `projects/05-relationship-manual/src/domain/card.ts`
- Modify: `projects/05-relationship-manual/src/domain/relationship.test.ts`

**Interfaces:**
- Consumes: `getRelationshipBank(content, relationshipContext)` from Task 1.
- Produces: `buildRelationshipProfile(content, relationshipContext, answers, generatedAt)`.
- Produces: `buildShareSummary(content, profile, relationshipContext)`.
- Keeps: `buildCardViewModel(content, profile, relationshipContext)` public call shape.

- [ ] **Step 1: Add failing per-context domain tests**

In `src/domain/relationship.test.ts`, update the helper to accept context and add isolation checks:

```ts
const contextPrefixes = {
  'close-relationship': 'close-',
  friendship: 'friend-',
  family: 'family-',
} as const

it.each(['close-relationship', 'friendship', 'family'] as const)(
  'builds a seven-section %s card using only its own result bank',
  (context) => {
    const bank = getRelationshipBank(content, context)
    const answers = bank.questions.map((question) => ({
      questionId: question.questionId,
      optionIds: [question.options[0]!.optionId],
      skipped: false,
      updatedAt: '2026-08-26T12:00:00.000Z',
    }))
    const profile = buildRelationshipProfile(content, context, answers, '2026-08-26T12:00:00.000Z')
    const card = buildCardViewModel(content, profile, context)
    expect(card.sections).toHaveLength(7)
    expect(profile.selectedTextKeys.every((key) => key.startsWith(contextPrefixes[context]))).toBe(true)
    expect(card.sections.flatMap((section) => section.paragraphSourceTextKeys)
      .filter((key): key is string => key !== null)
      .every((key) => key.startsWith(contextPrefixes[context]))).toBe(true)
  },
)

it('ignores an answer from another relationship bank', () => {
  const foreignQuestion = getRelationshipBank(content, 'friendship').questions[0]!
  const profile = buildRelationshipProfile(content, 'family', [{
    questionId: foreignQuestion.questionId,
    optionIds: [foreignQuestion.options[0]!.optionId],
    skipped: false,
    updatedAt: '2026-08-26T12:00:00.000Z',
  }], '2026-08-26T12:00:00.000Z')
  expect(profile.selectedTextKeys).toEqual([])
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
pnpm test src/domain/relationship.test.ts
```

Expected: FAIL because profile generation still reads the removed global arrays and has no context parameter.

- [ ] **Step 3: Bind profile generation to one relationship bank**

Change the function signature in `src/domain/profile.ts`:

```ts
export function buildRelationshipProfile(
  content: RelationshipContentPackage,
  relationshipContext: RelationshipContext,
  answers: QuestionnaireAnswer[],
  generatedAt: string,
): RelationshipProfile
```

At the top of the function:

```ts
const bank = getRelationshipBank(content, relationshipContext)
const questionById = new Map(bank.questions.map((question) => [question.questionId, question]))
const optionById = new Map(bank.questions.flatMap((question) => question.options)
  .map((option) => [option.optionId, option]))
const validAnswers = answers.filter((answer) => questionById.has(answer.questionId))
```

Use `bank.questions`, `bank.boundaryCommitmentRules`, `bank.defaultCommitmentTextKeys`, and `bank.conflictMergeRules` throughout. Return `validAnswers` in the profile so foreign provenance cannot leak into a result.

- [ ] **Step 4: Bind summaries and card fallbacks to the same bank**

Change `buildShareSummary` to receive `relationshipContext`, obtain the bank, and use only `bank.sentenceFragments` and `bank.conflictMergeRules`.

In `buildCardViewModel`, replace global sentence and conflict maps with the active bank. Replace shared section fallback strings with `bank.sectionFallbacks[rule.sectionId]`. Keep section order, length limits, compact metadata, and relationship label unchanged.

- [ ] **Step 5: Run domain tests and confirm GREEN**

```bash
pnpm test src/domain/relationship.test.ts
```

Expected: PASS for all three contexts and cross-bank answers ignored.

- [ ] **Step 6: Commit the domain slice**

```bash
git add projects/05-relationship-manual/src/domain/profile.ts \
  projects/05-relationship-manual/src/domain/card.ts \
  projects/05-relationship-manual/src/domain/relationship.test.ts
git commit -m "refactor: bind relationship results to active bank"
```

---

### Task 3: Preserve compatible V2 draft answers during schema-3 migration

**Files:**
- Modify: `projects/05-relationship-manual/src/storage/storage.ts`
- Modify: `projects/05-relationship-manual/src/storage/storage.test.ts`
- Modify: `projects/05-relationship-manual/src/content/content.json`

**Interfaces:**
- Consumes: `content.content.answerMigrations` and context-specific question maps.
- Produces: `StorageReferences.questionBanks` keyed by `RelationshipContext`.
- Produces: `buildStorageReferences(content): StorageReferences`.
- Produces: optional `migration` metadata on successful `LoadDraftResult` with preserved count and unanswered IDs.

- [ ] **Step 1: Add failing migration and bank-isolation tests**

In `src/storage/storage.test.ts`, add:

```ts
it('migrates semantically equivalent V2 answers into the selected V3 bank', () => {
  storage.setItem(STORAGE_KEY, JSON.stringify({
    ...validDraft,
    contentVersion: '2.0.0',
    relationshipContext: 'friendship',
    answers: [{
      questionId: 'question-message-delay',
      optionIds: ['option-delay-estimate'],
      skipped: false,
      updatedAt: '2026-08-26T12:00:00.000Z',
    }],
  }))
  const result = loadDraft(storage, content, buildStorageReferences(content))
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  expect(result.payload.answers).toEqual([expect.objectContaining({
    questionId: 'friend-contact-delay',
  })])
  expect(result.migration?.preservedAnswerCount).toBe(1)
  expect(result.migration?.needsAnswerQuestionIds).toHaveLength(20)
})

it('rejects valid IDs from a bank other than the draft context', () => {
  const closeQuestion = getRelationshipBank(content, 'close-relationship').questions[0]!
  const payload = { ...validDraft, relationshipContext: 'family', answers: [{
    questionId: closeQuestion.questionId,
    optionIds: [closeQuestion.options[0]!.optionId],
    skipped: false,
    updatedAt: '2026-08-26T12:00:00.000Z',
  }] }
  storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  const result = loadDraft(storage, content, buildStorageReferences(content))
  expect(result.status).toBe('ok')
  if (result.status === 'ok') expect(result.payload.answers).toEqual([])
})
```

- [ ] **Step 2: Run storage tests and confirm RED**

```bash
pnpm test src/storage/storage.test.ts
```

Expected: FAIL because `loadDraft` receives only a version string, cleans against a global question map, and has no semantic migration report.

- [ ] **Step 3: Add context-aware references and answer migration**

Change storage references to:

```ts
export type StorageReferences = {
  questionBanks: Record<RelationshipContext, Map<string, RelationshipQuestion>>
  sentenceSectionByTextKey?: Map<string, CardSectionId>
  sentenceRoleByTextKey?: Map<string, SentenceRole>
}

export type DraftMigrationReport = {
  preservedAnswerCount: number
  needsAnswerQuestionIds: string[]
}

export type LoadDraftResult =
  | { status: 'empty' }
  | { status: 'ok'; payload: DraftPayload; contentChanged: boolean; migration?: DraftMigrationReport }
  | { status: 'corrupt'; reason: 'invalid-json' | 'invalid-payload' }
  | { status: 'unsupported-version'; schemaVersion: number }
  | { status: 'unavailable' }
```

Change the public function to receive the content package so migrations remain content-driven:

```ts
export function loadDraft(
  storage: Pick<Storage, 'getItem'>,
  content: RelationshipContentPackage,
  references?: StorageReferences,
): LoadDraftResult
```

Add `buildStorageReferences` in the same module:

```ts
export function buildStorageReferences(content: RelationshipContentPackage): StorageReferences {
  return {
    questionBanks: Object.fromEntries(RELATIONSHIP_CONTEXTS.map((context) => [
      context,
      new Map(getRelationshipBank(content, context).questions.map((question) => [question.questionId, question])),
    ])) as StorageReferences['questionBanks'],
    sentenceSectionByTextKey: new Map(getAllSentences(content)
      .map((sentence) => [sentence.textKey, sentence.cardSectionId])),
    sentenceRoleByTextKey: new Map(getAllSentences(content)
      .map((sentence) => [sentence.textKey, sentence.role])),
  }
}
```

Implement a pure migration helper:

```ts
export function migrateAnswers(
  answers: QuestionnaireAnswer[],
  fromContentVersion: string,
  context: RelationshipContext,
  content: RelationshipContentPackage,
): { answers: QuestionnaireAnswer[]; preservedAnswerCount: number }
```

For each old answer, retain it only when the selected context's migration table contains the old question and every selected option has an exact semantic option mapping. Preserve `skipped` and `updatedAt`; never infer an unmapped option. After migration, compute `needsAnswerQuestionIds` from the 21 active questions.

- [ ] **Step 4: Complete the V2-to-V3 mappings in `content.json`**

For every old question/option combination that retains the same selected meaning, map it to the corresponding context question and option. Deliberately omit mappings for the known semantically incorrect V2 outputs and any newly introduced context-only scenario. Validate that every migration target exists in the selected relationship bank.

- [ ] **Step 5: Run storage tests and confirm GREEN**

```bash
pnpm test src/storage/storage.test.ts
```

Expected: PASS; compatible answers are retained, ambiguous answers become missing questions, and foreign-bank IDs are removed.

- [ ] **Step 6: Commit the storage slice**

```bash
git add projects/05-relationship-manual/src/storage/storage.ts \
  projects/05-relationship-manual/src/storage/storage.test.ts \
  projects/05-relationship-manual/src/content/content.json
git commit -m "feat: migrate drafts into relationship-specific banks"
```

---

### Task 4: Route the React questionnaire through the active bank

**Files:**
- Modify: `projects/05-relationship-manual/src/App.tsx`
- Modify: `projects/05-relationship-manual/src/app/view-model.test.ts`
- Modify: `projects/05-relationship-manual/src/app/presentation.test.ts`
- Modify: `projects/05-relationship-manual/src/components/QuestionSheet.tsx`
- Modify: `projects/05-relationship-manual/src/components/QuestionSheet.test.tsx`
- Modify: `projects/05-relationship-manual/src/storage/storage.test.ts`

**Interfaces:**
- Consumes: `getRelationshipBank`, `getAllSentences`, context-aware profile/card/storage APIs.
- Keeps: 21-step questionnaire, chapter intros, review/edit-answer flow, and existing page-state actions.
- Produces: helper copy based on selection mode, not a hard-coded option count.

- [ ] **Step 1: Add failing active-bank flow tests**

Update `src/app/presentation.test.ts` to call progress helpers with `getRelationshipBank(content, context).questions`. Add an assertion for each context:

```ts
it.each(['close-relationship', 'friendship', 'family'] as const)(
  'builds progress from only the %s bank',
  (context) => {
    const questions = getRelationshipBank(content, context).questions
    const topics = buildTopicProgress(questions, 0, [])
    expect(topics).toHaveLength(7)
    expect(topics.reduce((sum, topic) => sum + topic.total, 0)).toBe(21)
  },
)
```

Update `src/app/view-model.test.ts` with a foreign-bank answer and assert it does not satisfy an active required question.

In `src/components/QuestionSheet.test.tsx`, add:

```tsx
it('describes all valid expressions without claiming there are two options', () => {
  render(<QuestionSheet {...baseProps} question={threeOptionSingleQuestion} />)
  expect(screen.getByText(/每种表达都值得尊重/u)).toBeInTheDocument()
  expect(screen.queryByText(/两种表达/u)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run UI-adjacent tests and confirm RED**

```bash
pnpm test src/app/view-model.test.ts src/app/presentation.test.ts src/components/QuestionSheet.test.tsx
```

Expected: FAIL because tests and App still read the removed shared question array and helper copy says “两种表达”.

- [ ] **Step 3: Select the active bank once in `App.tsx`**

Immediately after validated content and reducer state are available, derive:

```ts
const activeBank = getRelationshipBank(content, state.relationshipContext)
const questions = activeBank.questions
```

Replace all global question/sentence references used for current index, chapter transitions, missing answers, progress, review, profile generation, and result generation. Call:

```ts
const profile = buildRelationshipProfile(
  content,
  state.relationshipContext,
  state.answers,
  new Date().toISOString(),
)
```

Construct storage references from all banks, but let `loadDraft` choose the draft's recorded context. If migration metadata exists, show one expiring notice:

```ts
`已保留 ${preservedAnswerCount} 道旧答案，另有 ${needsAnswerQuestionIds.length} 道需要重新确认。`
```

Do not reset answers when moving between questionnaire, review, edit-answer, result, or saved-result pages.

- [ ] **Step 4: Correct question helper copy**

In `QuestionSheet.tsx`, replace the hard-coded sentence with mode-aware copy:

```ts
const selectionHint = question.multiple
  ? `可以选择 ${question.selectionLimit.min}—${question.selectionLimit.max} 项；每种需要都值得认真对待。`
  : '请选择此刻最贴近你的一项；每种表达都值得尊重。'
```

Keep the current three-button layout and NPC sizing unchanged.

- [ ] **Step 5: Run the focused flow tests and confirm GREEN**

```bash
pnpm test src/app/view-model.test.ts src/app/presentation.test.ts \
  src/components/QuestionSheet.test.tsx src/storage/storage.test.ts
```

Expected: PASS with 21 active questions per relationship and accurate helper copy.

- [ ] **Step 6: Run all tests before committing**

```bash
pnpm test
```

Expected: PASS with no old `content.content.questions` or global sentence-bank references remaining.

- [ ] **Step 7: Commit the application slice**

```bash
git add projects/05-relationship-manual/src/App.tsx \
  projects/05-relationship-manual/src/app/view-model.test.ts \
  projects/05-relationship-manual/src/app/presentation.test.ts \
  projects/05-relationship-manual/src/components/QuestionSheet.tsx \
  projects/05-relationship-manual/src/components/QuestionSheet.test.tsx \
  projects/05-relationship-manual/src/storage/storage.test.ts
git commit -m "feat: route questionnaire through selected relationship bank"
```

---

### Task 5: Full verification and mobile content QA

**Files:**
- Modify: `projects/05-relationship-manual/VISUAL-QA.md`

**Interfaces:**
- Consumes: completed schema-3 content, domain, storage, and UI slices.
- Produces: reproducible automated verification and viewport review notes.

- [ ] **Step 1: Search for stale shared-bank access**

```bash
cd projects/05-relationship-manual
rg -n "content\.content\.(questions|sentenceFragments|boundaryPreferences)|sceneLeadByContext" src
```

Expected: no matches. Any match must be replaced with `getRelationshipBank`, `getAllQuestions`, or `getAllSentences` according to whether the caller is context-bound or building storage references.

- [ ] **Step 2: Run the required automated checks**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all commands exit 0 with no deleted or skipped regression tests.

- [ ] **Step 3: Run the existing static-package verifier**

```bash
pnpm verify:minitool
```

Expected: exit 0; build output contains no forbidden runtime network or persisted media behavior.

- [ ] **Step 4: Check all relationship flows at 375 CSS px**

Start the production preview:

```bash
pnpm preview --host 127.0.0.1
```

For each relationship context, inspect context selection, the first question of every chapter, review, result, compact result, and saved-image preview at 375 × 812. Confirm no horizontal overflow, no clipped option text, NPC does not displace the question, and relationship-specific terms do not leak across contexts.

- [ ] **Step 5: Repeat responsive checks at 390 and 430 CSS px**

Inspect the same screens at 390 × 844 and 430 × 932. Confirm the three questionnaire action buttons remain readable and reachable, the result fold does not cover text, and compact export matches the on-page compact card.

- [ ] **Step 6: Record the evidence in `VISUAL-QA.md`**

Append a V3 section with this exact checklist and mark only observed results:

```markdown
## V3 独立题库回归

- [ ] 375 × 812：亲密／好友／家人各完成一轮关键页面检查
- [ ] 390 × 844：亲密／好友／家人各完成一轮关键页面检查
- [ ] 430 × 932：亲密／好友／家人各完成一轮关键页面检查
- [ ] 三套题目、复核与结果无关系专属措辞串库
- [ ] 修改答案只定位当前关系题库，不要求重答全部问题
- [ ] V2 草稿迁移提示准确，等价答案未被静默清除
- [ ] 简洁卡片页面与导出图片布局一致
```

- [ ] **Step 7: Re-run the required gate after documentation changes**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit verification evidence**

```bash
git add projects/05-relationship-manual/VISUAL-QA.md
git commit -m "test: verify independent question banks"
```
