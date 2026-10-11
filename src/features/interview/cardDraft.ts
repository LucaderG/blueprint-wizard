import type { AnswerDraft } from './useInterview'

/** Eingabe zu einer Frage, solange die Runde nicht abgeschickt ist. */
export interface CardDraft {
  optionId: string | null
  text: string
  later: boolean
}

export const EMPTY_CARD_DRAFT: CardDraft = { optionId: null, text: '', later: false }

/** Wandelt die Eingabe in eine Antwort um; `null`, wenn nichts beantwortet ist. */
export function toAnswerDraft(draft: CardDraft): AnswerDraft | null {
  if (draft.later) return { kind: 'later' }
  if (draft.optionId) return { kind: 'option', optionId: draft.optionId, note: draft.text }
  if (draft.text.trim()) return { kind: 'text', text: draft.text }
  return null
}
