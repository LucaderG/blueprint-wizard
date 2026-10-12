import { formatVersion, releaseTag, resolveBuildInfo } from './buildInfo'

describe('resolveBuildInfo', () => {
  it('ist stable, wenn der Commit den Release-Tag der Version trägt', () => {
    expect(
      resolveBuildInfo({ version: '1.0.0', commit: 'abc1234', tagsAtCommit: ['v1.0.0'] }),
    ).toEqual({ version: '1.0.0', channel: 'stable', commit: 'abc1234' })
  })

  it('ist nightly ohne Tag, mit fremdem Tag oder ohne git', () => {
    expect(
      resolveBuildInfo({ version: '1.0.0', commit: 'abc1234', tagsAtCommit: [] }).channel,
    ).toBe('nightly')
    expect(
      resolveBuildInfo({ version: '1.1.0', commit: 'abc1234', tagsAtCommit: ['v1.0.0'] }).channel,
    ).toBe('nightly')
    expect(resolveBuildInfo({ version: '1.0.0', commit: null, tagsAtCommit: ['v1.0.0'] })).toEqual({
      version: '1.0.0',
      channel: 'nightly',
      commit: null,
    })
  })
})

describe('formatVersion', () => {
  it('zeigt stable ohne Commit-Hash', () => {
    expect(formatVersion({ version: '1.0.0', channel: 'stable', commit: 'abc1234' })).toBe(
      'v1.0.0 · stable',
    )
  })

  it('zeigt nightly mit Commit-Hash, falls bekannt', () => {
    expect(formatVersion({ version: '1.0.0', channel: 'nightly', commit: 'abc1234' })).toBe(
      'v1.0.0 · nightly · abc1234',
    )
    expect(formatVersion({ version: '1.0.0', channel: 'nightly', commit: null })).toBe(
      'v1.0.0 · nightly',
    )
  })

  it('baut den Release-Tag mit „v“', () => {
    expect(releaseTag('2.3.4')).toBe('v2.3.4')
  })
})
