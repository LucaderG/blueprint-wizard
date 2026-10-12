import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { RouteError, RouteLoading } from './RouteStates'

describe('Seitenzustände', () => {
  it('zeigt beim Laden einen Status', () => {
    render(<RouteLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Seite wird geladen')
  })

  it('zeigt bei einem Ladefehler einen Hinweis mit „Neu laden“', async () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })
    const router = createMemoryRouter([
      {
        path: '/',
        errorElement: <RouteError />,
        lazy: () => Promise.reject(new Error('Chunk fehlt')),
      },
    ])
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Diese Seite konnte nicht geladen werden',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Neu laden' }))
    expect(reload).toHaveBeenCalled()
  })
})
