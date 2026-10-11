import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { MemoryProjectRepository } from '@/core/storage'
import { useProjectRepository } from './useProjectRepository'

describe('useProjectRepository', () => {
  it('liefert das Repository des Providers', () => {
    const repository = new MemoryProjectRepository()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProjectRepositoryProvider repository={repository}>{children}</ProjectRepositoryProvider>
    )

    const { result } = renderHook(() => useProjectRepository(), { wrapper })

    expect(result.current).toBe(repository)
  })

  it('wirft ohne Provider einen verständlichen Fehler', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useProjectRepository())).toThrow(/ProjectRepositoryProvider/)
  })
})
