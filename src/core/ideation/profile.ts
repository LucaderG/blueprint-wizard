import { z } from 'zod'

/** Wie viel Zeit die Person für das Projekt hat. */
export const AVAILABLE_TIMES = [
  'fewHours',
  'fewEvenings',
  'fewWeekends',
  'fewWeeks',
  'longTerm',
] as const
export type AvailableTime = (typeof AVAILABLE_TIMES)[number]

/** Gewünschte Plattform; `any` heißt „egal, schlag etwas Passendes vor“. */
export const PLATFORM_PREFERENCES = ['any', 'web', 'mobile', 'desktop', 'cli'] as const
export type PlatformPreference = (typeof PLATFORM_PREFERENCES)[number]

/** Höchstzahl an Schlagwörtern pro Liste (Interessen, Fähigkeiten). */
export const MAX_TAGS = 10
/** Höchstlänge eines Schlagworts. */
export const MAX_TAG_LENGTH = 60
/** Höchstlänge der Freitexte (Lernziel, Frust im Alltag). */
export const MAX_PROFILE_TEXT_LENGTH = 1000

/** Antworten des kurzen Fragebogens „keine Idee“. */
export const ideationProfileSchema = z.object({
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  availableTime: z.enum(AVAILABLE_TIMES).nullable(),
  learningGoal: z.string(),
  frustrations: z.string(),
  platform: z.enum(PLATFORM_PREFERENCES),
})
export type IdeationProfile = z.infer<typeof ideationProfileSchema>

export const EMPTY_PROFILE: IdeationProfile = {
  interests: [],
  skills: [],
  availableTime: null,
  learningGoal: '',
  frustrations: '',
  platform: 'any',
}

const tagKey = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, ' ')
const cleanTag = (tag: string) => tag.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH).trim()

/** Bereinigt eine Schlagwortliste: trimmt, entfernt leere und doppelte, begrenzt auf `MAX_TAGS`. */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const tag = cleanTag(raw)
    const key = tagKey(tag)
    if (!tag || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length >= MAX_TAGS) break
  }
  return result
}

/** Zerlegt eine Eingabe wie „Musik, Kochen; Fotografie“ in einzelne Schlagwörter. */
export function parseTags(input: string): string[] {
  return cleanTags(input.split(/[,;\n]/))
}

/** Fügt Schlagwörter hinzu (auch mehrere, durch Komma getrennt); Doppelte entfallen. */
export function addTags(tags: readonly string[], input: string): string[] {
  return cleanTags([...tags, ...parseTags(input)])
}

/** Entfernt ein Schlagwort (ohne Groß-/Kleinschreibung). */
export function removeTag(tags: readonly string[], tag: string): string[] {
  const key = tagKey(tag)
  return tags.filter((t) => tagKey(t) !== key)
}

/** Schaltet ein Schlagwort um: vorhanden → entfernen, sonst hinzufügen. */
export function toggleTag(tags: readonly string[], tag: string): string[] {
  const key = tagKey(tag)
  return tags.some((t) => tagKey(t) === key) ? removeTag(tags, tag) : addTags(tags, tag)
}

export function hasTag(tags: readonly string[], tag: string): boolean {
  const key = tagKey(tag)
  return tags.some((t) => tagKey(t) === key)
}

/** Bereinigt alle Antworten, bevor sie an die KI gehen oder gespeichert werden. */
export function normalizeProfile(profile: IdeationProfile): IdeationProfile {
  return {
    interests: cleanTags(profile.interests),
    skills: cleanTags(profile.skills),
    availableTime: profile.availableTime,
    learningGoal: profile.learningGoal.trim().slice(0, MAX_PROFILE_TEXT_LENGTH).trim(),
    frustrations: profile.frustrations.trim().slice(0, MAX_PROFILE_TEXT_LENGTH).trim(),
    platform: profile.platform,
  }
}

/** Die Fragen des Fragebogens in Anzeigereihenfolge. */
export const PROFILE_FIELDS = [
  'interests',
  'frustrations',
  'skills',
  'learningGoal',
  'availableTime',
  'platform',
] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]

/** Ob eine Frage beantwortet ist. „Plattform: egal“ zählt als Antwort. */
export function isFieldAnswered(profile: IdeationProfile, field: ProfileField): boolean {
  switch (field) {
    case 'interests':
    case 'skills':
      return cleanTags(profile[field]).length > 0
    case 'learningGoal':
    case 'frustrations':
      return profile[field].trim() !== ''
    case 'availableTime':
      return profile.availableTime !== null
    case 'platform':
      return true
  }
}

export interface ProfileStatus {
  answered: number
  total: number
  /**
   * Ideen lassen sich erst erzeugen, wenn es einen inhaltlichen Ansatzpunkt gibt: Interessen,
   * Frust im Alltag oder ein Lernziel. Zeit und Plattform allein reichen nicht.
   */
  canGenerate: boolean
}

export function profileStatus(profile: IdeationProfile): ProfileStatus {
  const answered = PROFILE_FIELDS.filter((field) => isFieldAnswered(profile, field)).length
  const canGenerate = (['interests', 'frustrations', 'learningGoal'] as const).some((field) =>
    isFieldAnswered(profile, field),
  )
  return { answered, total: PROFILE_FIELDS.length, canGenerate }
}
