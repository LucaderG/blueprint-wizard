import { render, screen } from '@testing-library/react'
import { renderRoute } from '@/test/render'
import { VersionFooter } from './VersionFooter'

describe('VersionFooter', () => {
  it('zeigt eine Release-Version als stable', () => {
    render(<VersionFooter info={{ version: '1.0.0', channel: 'stable', commit: 'abc1234' }} />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Version v1.0.0 · stable')
  })

  it('zeigt einen ungetaggten Stand als nightly mit Commit', () => {
    render(<VersionFooter info={{ version: '1.0.0', channel: 'nightly', commit: 'abc1234' }} />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Version v1.0.0 · nightly · abc1234')
  })

  it('steht auf jeder Seite unten mit der gebauten Version', () => {
    renderRoute('/')
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      `Version v${__BUILD_INFO__.version} · ${__BUILD_INFO__.channel}`,
    )
  })
})
