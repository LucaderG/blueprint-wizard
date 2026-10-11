import { cn } from '@/shared/lib/utils'

describe('cn', () => {
  it('verbindet Klassen und ignoriert falsy-Werte', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b')
  })

  it('lässt bei Tailwind-Konflikten die letzte Klasse gewinnen', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
