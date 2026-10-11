import { z } from 'zod'
import { ideationProfileSchema, EMPTY_PROFILE } from './profile'

export const IDEA_EFFORTS = ['small', 'medium', 'large'] as const
export type IdeaEffort = (typeof IDEA_EFFORTS)[number]

/** Eine bereinigte Projektidee, wie sie die Oberfläche anzeigt. */
export const ideaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Ein bis zwei Sätze: worum es geht. */
  pitch: z.string().min(1),
  problem: z.string(),
  audience: z.string(),
  features: z.array(z.string()),
  platform: z.string(),
  effort: z.enum(IDEA_EFFORTS),
  /** 1 (bekannt) bis 5 (sehr neu). */
  novelty: z.number().int().min(1).max(5),
  /** 1 (wenig) bis 5 (sehr viel zu lernen). */
  learningValue: z.number().int().min(1).max(5),
  /** Kurz: was man dabei lernt. */
  learningNote: z.string(),
})
export type Idea = z.infer<typeof ideaSchema>

/**
 * Stand der Ideenfindung. Er lebt nur im Browser-Tab (sessionStorage), bis eine Idee gewählt ist;
 * danach steht alles im Projekt. Deshalb gibt es hier kein Projektschema und keine Migration.
 */
export const ideationSessionSchema = z.object({
  profile: ideationProfileSchema,
  ideas: z.array(ideaSchema),
  /** Titel aller bisher gezeigten Ideen, damit „Neu würfeln“ keine Wiederholungen bringt. */
  seenTitles: z.array(z.string()),
})
export type IdeationSession = z.infer<typeof ideationSessionSchema>

export const EMPTY_SESSION: IdeationSession = { profile: EMPTY_PROFILE, ideas: [], seenTitles: [] }

/** Liest einen gespeicherten Stand; Ungültiges oder Fremdes ergibt den leeren Stand. */
export function parseIdeationSession(raw: string | null): IdeationSession {
  if (!raw) return EMPTY_SESSION
  try {
    const result = ideationSessionSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : EMPTY_SESSION
  } catch {
    return EMPTY_SESSION
  }
}
