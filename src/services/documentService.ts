import { mockDocuments } from '../data/mockDocuments'
import type { DocumentRecord } from '../types/documents'

export interface DocumentRepository {
  list(): Promise<DocumentRecord[]>
  create(document: DocumentRecord): Promise<DocumentRecord>
}

export const mockDocumentService: DocumentRepository = {
  async list() {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return structuredClone(mockDocuments)
  },
  async create(document) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return document
  },
}

