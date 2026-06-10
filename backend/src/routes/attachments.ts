import { Router } from 'express'
import multer from 'multer'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { fileStorage } from '../services/fileStorage'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.use(authenticate)

router.post('/', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
  const { entityType, entityId, discussionId } = req.body as { entityType?: string; entityId?: string; discussionId?: string }
  const storageKey = await fileStorage.upload(req.file.buffer, req.file.originalname, req.file.mimetype)
  const attachment = await prisma.attachment.create({
    data: {
      entityType,
      entityId,
      discussionId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      storageKey,
      sizeBytes: req.file.size,
      uploadedById: req.user!.id,
    }
  })
  res.status(201).json({ ...attachment, url: fileStorage.url(storageKey) })
})

router.get('/', async (req, res) => {
  const { entityType, entityId, discussionId } = req.query as Record<string, string>
  const attachments = await prisma.attachment.findMany({
    where: {
      ...(entityType && entityId ? { entityType, entityId } : {}),
      ...(discussionId ? { discussionId } : {}),
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(attachments.map(a => ({ ...a, url: fileStorage.url(a.storageKey) })))
})

router.get('/:storageKey/download', async (req, res) => {
  const attachment = await prisma.attachment.findFirst({ where: { storageKey: req.params.storageKey as string } })
  if (!attachment) { res.status(404).json({ error: 'Not found' }); return }
  const buffer = await fileStorage.download(req.params.storageKey as string)
  res.setHeader('Content-Type', attachment.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`)
  res.send(buffer)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } })
  if (!attachment) { res.status(404).json({ error: 'Not found' }); return }
  await fileStorage.delete(attachment.storageKey)
  await prisma.attachment.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
