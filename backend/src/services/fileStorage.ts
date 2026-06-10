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
    return fs.promises.readFile(path.join(UPLOAD_DIR, storageKey))
  }

  async delete(storageKey: string): Promise<void> {
    await fs.promises.unlink(path.join(UPLOAD_DIR, storageKey)).catch(() => {})
  }

  url(storageKey: string): string {
    return `/api/attachments/${storageKey}/download`
  }
}

export const fileStorage: IFileStorage = new LocalFileStorage()
