import {
  CURRENT_SCHEMA_VERSION,
  type Blueprint,
  type Interview,
  type Project,
  type Section,
} from './schema'
import { SECTION_IDS, type SectionId } from './sections'

export function createEmptySection(id: SectionId): Section {
  return { id, content: '', maturity: 'empty', source: 'user' }
}

export function createEmptyBlueprint(): Blueprint {
  const sections = Object.fromEntries(SECTION_IDS.map((id) => [id, createEmptySection(id)]))
  return { sections: sections as Blueprint['sections'] }
}

export function createEmptyInterview(): Interview {
  return { questions: [], log: [], analysis: null }
}

export interface CreateProjectOptions {
  id: string
  name: string
  now: Date
}

export function createEmptyProject({ id, name, now }: CreateProjectOptions): Project {
  const timestamp = now.toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name: name.trim(),
    entryPoint: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    blueprint: createEmptyBlueprint(),
    interview: createEmptyInterview(),
    decisions: [],
    additions: [],
  }
}
