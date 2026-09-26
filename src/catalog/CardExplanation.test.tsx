import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { CardExplanation } from './CardExplanation'
import { parseExplanation } from './explanation-markdown'

// Card Explanation (RIB-52): markdown semplice, reso solo come testo.

function show(markdown: string | null) {
  const router = createMemoryRouter([
    { path: '/', element: <CardExplanation markdown={markdown} /> },
  ])
  return render(<RouterProvider router={router} />)
}

describe('markdown delle spiegazioni', () => {
  it('paragrafi, elenchi e grassetto', () => {
    expect(parseExplanation('Primo **forte**.\nsegue\n\n- uno\n- due')).toEqual([
      {
        kind: 'paragraph',
        lines: [
          [
            { text: 'Primo ', bold: false },
            { text: 'forte', bold: true },
            { text: '.', bold: false },
          ],
          [{ text: 'segue', bold: false }],
        ],
      },
      {
        kind: 'list',
        items: [[{ text: 'uno', bold: false }], [{ text: 'due', bold: false }]],
      },
    ])
  })

  it('HTML, link e immagini restano testo', () => {
    const { container } = show(
      '<img src=x onerror="alert(1)"> [clic](javascript:alert(1)) <script>alert(2)</script>',
    )
    expect(container.querySelector('img, script, a[href^="javascript"]')).toBeNull()
    expect(screen.getByText(/<script>alert\(2\)<\/script>/)).toBeInTheDocument()
  })

  it('le Keyword tra [ ] portano al glossario, anche in grassetto', () => {
    show('Con **[Blocker]** para gli attacchi; [On Play] pesca.')
    expect(screen.getByRole('link', { name: '[Blocker]' })).toHaveAttribute(
      'href',
      '/regole?voce=blocker',
    )
    expect(screen.getByRole('link', { name: '[On Play]' })).toBeInTheDocument()
  })

  it('senza spiegazione non mostra nulla', () => {
    const { container } = show(null)
    expect(container).toBeEmptyDOMElement()
  })
})
