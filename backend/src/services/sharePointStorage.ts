import type { IFileStorage } from './fileStorage'

// Phase 3: swap LocalFileStorage → SharePointFileStorage via FILE_STORAGE_DRIVER=sharepoint
// Requires: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, SHAREPOINT_SITE_ID
// MS Graph endpoint: https://graph.microsoft.com/v1.0/sites/{siteId}/drives

export class SharePointFileStorage implements IFileStorage {
  private readonly siteId: string
  private readonly driveId: string

  constructor(siteId: string, driveId: string) {
    this.siteId = siteId
    this.driveId = driveId
  }

  async upload(_buffer: Buffer, _fileName: string, _mimeType: string): Promise<string> {
    // Phase 3:
    // PUT https://graph.microsoft.com/v1.0/drives/{driveId}/root:/{fileName}:/content
    // Returns item.id as storageKey
    throw new Error('SharePointFileStorage: Phase 3 not yet implemented. Set FILE_STORAGE_DRIVER=sharepoint after configuring Azure credentials.')
  }

  async download(_storageKey: string): Promise<Buffer> {
    // Phase 3: GET https://graph.microsoft.com/v1.0/drives/{driveId}/items/{storageKey}/content
    throw new Error('SharePointFileStorage: Phase 3 not yet implemented.')
  }

  async delete(_storageKey: string): Promise<void> {
    // Phase 3: DELETE https://graph.microsoft.com/v1.0/drives/{driveId}/items/{storageKey}
    throw new Error('SharePointFileStorage: Phase 3 not yet implemented.')
  }

  url(storageKey: string): string {
    return `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${storageKey}/content`
  }
}
