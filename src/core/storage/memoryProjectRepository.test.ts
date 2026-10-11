import { MemoryProjectRepository } from './memoryProjectRepository'
import { describeProjectRepositoryContract } from './projectRepository.contract'

describeProjectRepositoryContract(
  'MemoryProjectRepository',
  (deps) => new MemoryProjectRepository(deps),
)

describe('MemoryProjectRepository', () => {
  it('funktioniert mit Standard-Abhängigkeiten', async () => {
    const project = await new MemoryProjectRepository().create('Standard')
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(project.createdAt)).not.toBeNaN()
  })
})
