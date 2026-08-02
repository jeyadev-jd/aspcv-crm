import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface IFileStorage {
  upload(buffer: Buffer, originalName: string, mimeType: string): Promise<string>
  download(storageKey: string): Promise<Buffer>
  delete(storageKey: string): Promise<void>
  url(storageKey: string): string
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

/**
 * Storage keys are generated as `randomUUID() + ext` and are never user-supplied
 * in normal use. This guard exists so that stays true even if a future caller
 * forgets to look the key up in the database first: `../../.env` would otherwise
 * resolve to a real path outside the upload directory.
 */
function resolveKey(storageKey: string): string {
  const full = path.resolve(UPLOAD_DIR, storageKey)
  const root = path.resolve(UPLOAD_DIR)
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw Object.assign(new Error('Invalid storage key'), { status: 400 })
  }
  return full
}

export class LocalFileStorage implements IFileStorage {
  constructor() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }

  async upload(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName)
    const key = `${crypto.randomUUID()}${ext}`
    await fs.promises.writeFile(path.join(UPLOAD_DIR, key), buffer)
    return key
  }

  async download(storageKey: string): Promise<Buffer> {
    return fs.promises.readFile(resolveKey(storageKey))
  }

  async delete(storageKey: string): Promise<void> {
    await fs.promises.unlink(resolveKey(storageKey)).catch(() => {})
  }

  url(storageKey: string): string {
    return `/api/attachments/${storageKey}/download`
  }
}

export const fileStorage: IFileStorage = new LocalFileStorage()
