// __tests__/integration/document-workflow.test.ts
import { apiFetchJson } from '../../lib/api'

// Mock fetch globally for integration tests
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Document Workflow Integration', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Document Upload Flow', () => {
    it('should handle successful document upload', async () => {
      // Mock successful upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 123,
          titre: 'test-document.pdf',
          taille: 1024000,
          type: 'application/pdf',
          statut: 'TRAITE',
          date_creation: '2024-01-15T10:30:00Z',
          utilisateur_id: 1,
          url_telechargement: '/api/documents/123/download/'
        }),
      } as Response)

      // Create a mock file
      const mockFile = new File(['test content'], 'test-document.pdf', {
        type: 'application/pdf'
      })

      const formData = new FormData()
      formData.append('fichier', mockFile)
      formData.append('titre', 'Test Document')
      formData.append('description', 'A test document')

      // Upload document
      const uploadResponse = await apiFetchJson('/api/documents/', {
        method: 'POST',
        body: formData,
      })

      expect(uploadResponse.response.ok).toBe(true)
      expect(uploadResponse.response.status).toBe(201)
      expect((uploadResponse.data as any)).toHaveProperty('id', 123)
      expect((uploadResponse.data as any)).toHaveProperty('titre', 'test-document.pdf')
      expect((uploadResponse.data as any)).toHaveProperty('statut', 'TRAITE')

      // Verify FormData was sent correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/api/documents/',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      )
    })

    it('should handle upload validation errors', async () => {
      // Mock validation error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation error',
          details: {
            fichier: ['File size too large. Maximum size is 10MB.'],
            titre: ['Title is required.']
          }
        }),
      } as Response)

      const mockFile = new File(['x'.repeat(15 * 1024 * 1024)], 'large-file.pdf') // 15MB file

      const formData = new FormData()
      formData.append('fichier', mockFile)
      // Missing titre field

      const uploadResponse = await apiFetchJson('/api/documents/', {
        method: 'POST',
        body: formData,
      })

      expect(uploadResponse.response.ok).toBe(false)
      expect(uploadResponse.response.status).toBe(400)
      expect((uploadResponse.data as any)).toHaveProperty('error')
      expect((uploadResponse.data as any).details).toHaveProperty('fichier')
      expect((uploadResponse.data as any).details).toHaveProperty('titre')
    })

    it('should handle unauthorized upload attempts', async () => {
      // Mock unauthorized response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'You do not have permission to upload documents.'
        }),
      } as Response)

      const mockFile = new File(['test'], 'test.pdf')

      const formData = new FormData()
      formData.append('fichier', mockFile)
      formData.append('titre', 'Test Document')

      const uploadResponse = await apiFetchJson('/api/documents/', {
        method: 'POST',
        body: formData,
      })

      expect(uploadResponse.response.ok).toBe(false)
      expect(uploadResponse.response.status).toBe(403)
      expect((uploadResponse.data as any)).toHaveProperty('error', 'Forbidden')
    })
  })

  describe('Document Search and Retrieval', () => {
    it('should search documents with filters', async () => {
      // Mock search response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              id: 123,
              titre: 'Rapport Q1.pdf',
              description: 'Rapport trimestriel',
              taille: 2048000,
              type: 'application/pdf',
              statut: 'TRAITE',
              date_creation: '2024-01-15T10:30:00Z',
              utilisateur_id: 1
            },
            {
              id: 124,
              titre: 'Contrat Client.pdf',
              description: 'Contrat signé',
              taille: 1024000,
              type: 'application/pdf',
              statut: 'TRAITE',
              date_creation: '2024-01-10T14:20:00Z',
              utilisateur_id: 1
            }
          ]
        }),
      } as Response)

      // Search documents
      const searchResponse = await apiFetchJson('/api/documents/?q=rapport&page=1&statut=TRAITE')

      expect(searchResponse.response.ok).toBe(true)
      expect((searchResponse.data as any)).toHaveProperty('count', 2)
      expect((searchResponse.data as any).results).toHaveLength(2)
      expect((searchResponse.data as any).results[0]).toHaveProperty('titre', 'Rapport Q1.pdf')
      expect((searchResponse.data as any).results[1]).toHaveProperty('titre', 'Contrat Client.pdf')
    })

    it('should retrieve single document details', async () => {
      // Mock document detail response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 123,
          titre: 'Rapport Q1.pdf',
          description: 'Rapport trimestriel détaillé',
          taille: 2048000,
          type: 'application/pdf',
          statut: 'TRAITE',
          date_creation: '2024-01-15T10:30:00Z',
          date_modification: '2024-01-15T10:30:00Z',
          utilisateur_id: 1,
          utilisateur_nom: 'John Doe',
          url_telechargement: '/api/documents/123/download/',
          url_visualisation: '/api/documents/123/view/',
          metadata: {
            pages: 15,
            auteur: 'John Doe',
            sujet: 'Rapport trimestriel'
          }
        }),
      } as Response)

      const detailResponse = await apiFetchJson('/api/documents/123/')

      expect(detailResponse.response.ok).toBe(true)
      expect((detailResponse.data as any)).toHaveProperty('id', 123)
      expect((detailResponse.data as any)).toHaveProperty('metadata')
      expect((detailResponse.data as any).metadata).toHaveProperty('pages', 15)
      expect((detailResponse.data as any)).toHaveProperty('url_telechargement')
      expect((detailResponse.data as any)).toHaveProperty('url_visualisation')
    })

    it('should handle document not found', async () => {
      // Mock 404 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Not found',
          message: 'Document with ID 999 not found.'
        }),
      } as Response)

      const detailResponse = await apiFetchJson('/api/documents/999/')

      expect(detailResponse.response.ok).toBe(false)
      expect(detailResponse.response.status).toBe(404)
      expect((detailResponse.data as any)).toHaveProperty('error', 'Not found')
    })
  })

  describe('Document Download Flow', () => {
    it('should download document successfully', async () => {
      // Mock download response (binary data)
      const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="Rapport Q1.pdf"'
        }),
        blob: async () => mockBlob,
      } as Response)

      // Download document
      const downloadResponse = await fetch('http://localhost:8000/api/api/documents/123/download/')

      expect(downloadResponse.ok).toBe(true)
      expect(downloadResponse.status).toBe(200)
      expect(downloadResponse.headers.get('content-type')).toBe('application/pdf')
      expect(downloadResponse.headers.get('content-disposition')).toContain('Rapport Q1.pdf')
    })

    it('should handle download permissions error', async () => {
      // Mock forbidden download response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'You do not have permission to download this document.'
        }),
      } as Response)

      const downloadResponse = await apiFetchJson('/api/documents/123/download/')

      expect(downloadResponse.response.ok).toBe(false)
      expect(downloadResponse.response.status).toBe(403)
      expect((downloadResponse.data as any)).toHaveProperty('error', 'Forbidden')
    })
  })

  describe('Document Update Flow', () => {
    it('should update document metadata', async () => {
      // Mock successful update response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 123,
          titre: 'Rapport Q1 - Version Finale.pdf',
          description: 'Rapport trimestriel version finale avec corrections',
          taille: 2048000,
          type: 'application/pdf',
          statut: 'TRAITE',
          date_creation: '2024-01-15T10:30:00Z',
          date_modification: '2024-01-16T09:15:00Z',
          utilisateur_id: 1
        }),
      } as Response)

      const updateData = {
        titre: 'Rapport Q1 - Version Finale.pdf',
        description: 'Rapport trimestriel version finale avec corrections'
      }

      const updateResponse = await apiFetchJson('/api/documents/123/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      expect(updateResponse.response.ok).toBe(true)
      expect(updateResponse.response.status).toBe(200)
      expect((updateResponse.data as any)).toHaveProperty('titre', 'Rapport Q1 - Version Finale.pdf')
      expect((updateResponse.data as any)).toHaveProperty('description', 'Rapport trimestriel version finale avec corrections')
      expect((updateResponse.data as any)).toHaveProperty('date_modification')
    })

    it('should handle update validation errors', async () => {
      // Mock validation error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation error',
          details: {
            titre: ['Title must be unique.']
          }
        }),
      } as Response)

      const updateData = {
        titre: 'Existing Document Name.pdf' // Duplicate title
      }

      const updateResponse = await apiFetchJson('/api/documents/123/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      expect(updateResponse.response.ok).toBe(false)
      expect(updateResponse.response.status).toBe(400)
      expect((updateResponse.data as any).details).toHaveProperty('titre')
    })
  })

  describe('Document Deletion Flow', () => {
    it('should delete document successfully', async () => {
      // Mock successful deletion response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      } as Response)

      const deleteResponse = await apiFetchJson('/api/documents/123/', {
        method: 'DELETE',
      })

      expect(deleteResponse.response.ok).toBe(true)
      expect(deleteResponse.response.status).toBe(204)
    })

    it('should handle deletion of non-existent document', async () => {
      // Mock not found response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Not found',
          message: 'Document with ID 999 not found.'
        }),
      } as Response)

      const deleteResponse = await apiFetchJson('/api/documents/999/', {
        method: 'DELETE',
      })

      expect(deleteResponse.response.ok).toBe(false)
      expect(deleteResponse.response.status).toBe(404)
      expect((deleteResponse.data as any)).toHaveProperty('error', 'Not found')
    })

    it('should handle unauthorized deletion', async () => {
      // Mock forbidden response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'You do not have permission to delete this document.'
        }),
      } as Response)

      const deleteResponse = await apiFetchJson('/api/documents/123/', {
        method: 'DELETE',
      })

      expect(deleteResponse.response.ok).toBe(false)
      expect(deleteResponse.response.status).toBe(403)
      expect((deleteResponse.data as any)).toHaveProperty('error', 'Forbidden')
    })
  })

  describe('Document Statistics', () => {
    it('should retrieve document statistics', async () => {
      // Mock statistics response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total_documents: 150,
          total_size_bytes: 524288000, // 500MB
          documents_by_status: {
            TRAITE: 120,
            EN_COURS: 25,
            ERREUR: 5
          },
          documents_by_type: {
            'application/pdf': 100,
            'application/msword': 30,
            'text/plain': 20
          },
          recent_uploads: [
            { id: 150, titre: 'Recent Doc.pdf', date_creation: '2024-01-20T10:00:00Z' },
            { id: 149, titre: 'Another Doc.pdf', date_creation: '2024-01-19T15:30:00Z' }
          ]
        }),
      } as Response)

      const statsResponse = await apiFetchJson('/api/documents/statistics/')

      expect(statsResponse.response.ok).toBe(true)
      expect((statsResponse.data as any)).toHaveProperty('total_documents', 150)
      expect((statsResponse.data as any)).toHaveProperty('total_size_bytes', 524288000)
      expect((statsResponse.data as any)).toHaveProperty('documents_by_status')
      expect((statsResponse.data as any)).toHaveProperty('documents_by_type')
      expect((statsResponse.data as any)).toHaveProperty('recent_uploads')
      expect((statsResponse.data as any).recent_uploads).toHaveLength(2)
    })
  })

  describe('Bulk Operations', () => {
    it('should handle bulk document operations', async () => {
      // Mock bulk operation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          processed: 3,
          results: [
            { id: 123, status: 'deleted' },
            { id: 124, status: 'deleted' },
            { id: 125, status: 'deleted' }
          ]
        }),
      } as Response)

      const bulkData = {
        operation: 'delete',
        document_ids: [123, 124, 125]
      }

      const bulkResponse = await apiFetchJson('/api/documents/bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bulkData),
      })

      expect(bulkResponse.response.ok).toBe(true)
      expect((bulkResponse.data as any)).toHaveProperty('success', true)
      expect((bulkResponse.data as any)).toHaveProperty('processed', 3)
      expect((bulkResponse.data as any).results).toHaveLength(3)
    })
  })
})
