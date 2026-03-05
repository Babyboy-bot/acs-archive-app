// __tests__/pages/documents.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '../../app/documents/page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

jest.mock('@/hooks/useUtilisateurCourant', () => ({
  useUtilisateurCourant: () => ({
    utilisateur: { id: 1, role: 'USER' },
    chargement: false,
  }),
}))

jest.mock('@/hooks/useEnforceNonConsultant', () => ({
  useEnforceNonConsultant: () => ({}),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    estAuthentifie: true,
    chargement: false,
  }),
}))

jest.mock('@/lib/permissions', () => ({
  hasPermission: jest.fn(() => true),
}))

jest.mock('@/components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}))

jest.mock('@/components/PreviewPDF', () => ({
  PreviewPDF: ({ ouvert, onFermer, titre }: any) => (
    ouvert ? (
      <div data-testid="preview-pdf">
        <h2>{titre}</h2>
        <button onClick={onFermer}>Close</button>
      </div>
    ) : null
  ),
}))

// Mock API calls
global.fetch = jest.fn()

const mockDocuments = [
  {
    id: '1',
    titre: 'Document Test 1',
    reference: 'REF001',
    client: 'Client A',
    exercice: '2024',
    risque: 'AUTO',
    risqueKey: 'AUTO',
    typeCourrier: 'AVENANT',
    date: '2024-01-15',
    taille: '1.2 MB',
    color: '#D32027',
    urlFichier: '/media/test1.pdf',
    source: { fichier_url: '/media/test1.pdf' },
  },
  {
    id: '2',
    titre: 'Document Test 2',
    reference: 'REF002',
    client: 'Client B',
    exercice: '2023',
    risque: 'SANTE',
    risqueKey: 'SANTE',
    typeCourrier: 'FACTURE',
    date: '2023-12-10',
    taille: '2.1 MB',
    color: '#10B981',
    urlFichier: '/media/test2.pdf',
    source: { fichier_url: '/media/test2.pdf' },
  },
]

describe('DocumentsPage', () => {
  beforeEach(() => {
    // Mock API response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: mockDocuments,
        count: 2,
        next: null,
        previous: null,
      }),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the documents page with title', async () => {
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Gestion Documents')).toBeInTheDocument()
    })
  })

  it('displays documents in grid view by default', async () => {
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
      expect(screen.getByText('Document Test 2')).toBeInTheDocument()
    })
  })

  it('allows switching between grid and list view', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
    })

    // Click on list view button (document icon)
    const listViewButton = screen.getByRole('button', { name: /document/i })
    await user.click(listViewButton)

    // Should still display documents (in list format)
    expect(screen.getByText('Document Test 1')).toBeInTheDocument()
  })

  it('filters documents by search query', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
      expect(screen.getByText('Document Test 2')).toBeInTheDocument()
    })

    // Search for "Test 1"
    const searchInput = screen.getByPlaceholderText('Rechercher...')
    await user.type(searchInput, 'Test 1')

    // Should only show Document Test 1
    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
      expect(screen.queryByText('Document Test 2')).not.toBeInTheDocument()
    })
  })

  it('filters documents by risk type', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
    })

    // Select "AUTO" risk filter
    const riskSelect = screen.getByDisplayValue('Tous les risques')
    await user.selectOptions(riskSelect, 'AUTO')

    // Should only show AUTO risk documents
    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
      expect(screen.queryByText('Document Test 2')).not.toBeInTheDocument()
    })
  })

  it('shows document actions (download, print, view)', async () => {
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
    })

    // Should have action buttons (using titles)
    const downloadButtons = screen.getAllByTitle('Télécharger')
    const printButtons = screen.getAllByTitle('Imprimer')
    const viewButtons = screen.getAllByTitle('Voir')

    expect(downloadButtons.length).toBeGreaterThan(0)
    expect(printButtons.length).toBeGreaterThan(0)
    expect(viewButtons.length).toBeGreaterThan(0)
  })

  it('opens PDF preview when clicking view button', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document Test 1')).toBeInTheDocument()
    })

    // Click on view button (eye icon)
    const viewButtons = screen.getAllByTitle('Voir')
    await user.click(viewButtons[0])

    // Should open preview modal
    expect(screen.getByTestId('preview-pdf')).toBeInTheDocument()
    expect(screen.getByText('Document Test 1')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<DocumentsPage />)

    // Should show loading skeletons
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('displays pagination for large result sets', async () => {
    // Mock large dataset
    const largeMockDocuments = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      titre: `Document ${i + 1}`,
      reference: `REF${String(i + 1).padStart(3, '0')}`,
      client: 'Client Test',
      exercice: '2024',
      risque: 'AUTO',
      risqueKey: 'AUTO',
      typeCourrier: 'AVENANT',
      date: '2024-01-15',
      taille: '1.2 MB',
      color: '#D32027',
      urlFichier: `/media/test${i + 1}.pdf`,
      source: { fichier_url: `/media/test${i + 1}.pdf` },
    }))

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: largeMockDocuments.slice(0, 10), // First page
        count: 25,
        next: 'page=2',
        previous: null,
      }),
    })

    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Document 1')).toBeInTheDocument()
    })

    // Should show pagination info
    expect(screen.getByText(/Page 1 sur/)).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Erreur lors du chargement/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no documents found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [],
        count: 0,
        next: null,
        previous: null,
      }),
    })

    render(<DocumentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Aucun document trouvé')).toBeInTheDocument()
    })
  })
})
