import { createSafeRouter } from '../lib/safeRouter'
import multer from 'multer'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { fileStorage } from '../services/fileStorage'
import { requirePermission, resolvePermission } from '../middleware/permissions'
import { DocumentType, RelatedModule } from '@prisma/client'

const router = createSafeRouter()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.use(authenticate)

const DOCUMENT_TYPES = new Set(Object.values(DocumentType))
const RELATED_MODULES = new Set(Object.values(RelatedModule))

// entityType is a free-form tag (not a typed Prisma relation) — map each known
// value to how ownership is actually modeled for that entity, so an attachment
// can't be uploaded/read/deleted against a record the caller can't access.
const OWNERSHIP_RESOLVERS: Record<string, (entityId: string, userId: string) => Promise<boolean>> = {
  lead: async (entityId, userId) => {
    const lead = await prisma.lead.findUnique({ where: { id: entityId }, include: { owners: true } })
    return !!lead && lead.owners.some(o => o.userId === userId)
  },
  deal: async (entityId, userId) => {
    const deal = await prisma.deal.findUnique({ where: { id: entityId }, include: { owners: true } })
    return !!deal && deal.owners.some(o => o.userId === userId)
  },
  company: async (entityId, userId) => {
    const company = await prisma.company.findFirst({
      where: { id: entityId, leads: { some: { owners: { some: { userId } }, isActive: true } } },
    })
    return !!company
  },
  contact: async (entityId, userId) => {
    const contact = await prisma.contact.findUnique({ where: { id: entityId } })
    return !!contact && contact.createdById === userId
  },
  project: async (entityId, userId) => {
    const project = await prisma.project.findUnique({ where: { id: entityId } })
    return !!project && project.createdById === userId
  },
  installation: async (entityId, userId) => {
    const installation = await prisma.installation.findUnique({ where: { id: entityId } })
    return !!installation && installation.createdById === userId
  },
  quotation: async (entityId, userId) => {
    const quotation = await prisma.quotation.findUnique({ where: { id: entityId }, include: { deal: { include: { owners: true } } } })
    if (!quotation) return false
    if (quotation.createdById === userId) return true
    return !!quotation.deal?.owners.some(o => o.userId === userId)
  },
}

// Checks whether the requesting user may act on the given entityType/entityId —
// via read_all on the 'attachment' resource, an entity-specific ownership check,
// or (for attachments with no entity link, e.g. discussion-only) uploader identity.
async function canAccessAttachmentTarget(
  req: AuthRequest,
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): Promise<boolean> {
  const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'attachment', 'read_all')
  if (canReadAll) return true
  if (!entityType || !entityId) return false
  const resolver = OWNERSHIP_RESOLVERS[entityType.toLowerCase()]
  if (!resolver) return false // unknown entityType — deny rather than silently allow
  return resolver(entityId, req.user!.id)
}

/** Whether an entityType has an ownership resolver, so callers can reject early. */
function isKnownAttachmentTarget(entityType: string): boolean {
  return Object.prototype.hasOwnProperty.call(OWNERSHIP_RESOLVERS, entityType.toLowerCase())
}

router.post('/', upload.single('file'), requirePermission('attachment', 'create'), async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
  const { entityType, entityId, discussionId, documentType, relatedModule, rootAttachmentId } = req.body as {
    entityType?: string; entityId?: string; discussionId?: string
    documentType?: string; relatedModule?: string; rootAttachmentId?: string
  }
  if (documentType && !DOCUMENT_TYPES.has(documentType as DocumentType)) { res.status(400).json({ error: `Invalid documentType "${documentType}"` }); return }
  if (relatedModule && !RELATED_MODULES.has(relatedModule as RelatedModule)) { res.status(400).json({ error: `Invalid relatedModule "${relatedModule}"` }); return }

  if (entityType && entityId) {
    const allowed = await canAccessAttachmentTarget(req, entityType, entityId)
    if (!allowed) { res.status(403).json({ error: 'Insufficient permissions for target entity' }); return }
  } else if (discussionId) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId }, include: { participants: { where: { userId: req.user!.id } } } })
    const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'attachment', 'read_all')
    if (!discussion || (!canReadAll && discussion.participants.length === 0)) { res.status(403).json({ error: 'Insufficient permissions for target discussion' }); return }
  }

  // Uploading a new version of an existing document: version = highest existing version
  // in the chain + 1, all revisions share rootAttachmentId so they list together — the
  // original upload is never overwritten, giving true version history.
  let version = 1
  let root: string | undefined
  if (rootAttachmentId) {
    const original = await prisma.attachment.findUnique({ where: { id: rootAttachmentId } })
    if (!original) { res.status(404).json({ error: 'Original document not found' }); return }
    root = original.rootAttachmentId ?? original.id
    const latest = await prisma.attachment.aggregate({
      where: { OR: [{ id: root }, { rootAttachmentId: root }] },
      _max: { version: true },
    })
    version = (latest._max.version ?? 1) + 1
  }

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
      documentType: documentType as DocumentType | undefined,
      relatedModule: relatedModule as RelatedModule | undefined,
      version,
      rootAttachmentId: root,
    }
  })
  res.status(201).json({ ...attachment, url: fileStorage.url(attachment.storageKey!) })
})

// Link-only attachment — no file upload, just an external URL (OneDrive/Drive/etc).
router.post('/link', requirePermission('attachment', 'create'), async (req: AuthRequest, res) => {
  const { entityType, entityId, discussionId, url, fileName, documentType, relatedModule } = req.body as {
    entityType?: string; entityId?: string; discussionId?: string
    url?: string; fileName?: string; documentType?: string; relatedModule?: string
  }
  if (!url?.trim() || !/^https?:\/\//i.test(url.trim())) { res.status(400).json({ error: 'A valid http(s) URL is required' }); return }
  if (documentType && !DOCUMENT_TYPES.has(documentType as DocumentType)) { res.status(400).json({ error: `Invalid documentType "${documentType}"` }); return }
  if (relatedModule && !RELATED_MODULES.has(relatedModule as RelatedModule)) { res.status(400).json({ error: `Invalid relatedModule "${relatedModule}"` }); return }

  if (entityType && entityId) {
    const allowed = await canAccessAttachmentTarget(req, entityType, entityId)
    if (!allowed) { res.status(403).json({ error: 'Insufficient permissions for target entity' }); return }
  } else if (discussionId) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId }, include: { participants: { where: { userId: req.user!.id } } } })
    const canReadAll = await resolvePermission(req.user!.id, req.user!.roleName, 'attachment', 'read_all')
    if (!discussion || (!canReadAll && discussion.participants.length === 0)) { res.status(403).json({ error: 'Insufficient permissions for target discussion' }); return }
  }

  const attachment = await prisma.attachment.create({
    data: {
      entityType, entityId, discussionId,
      fileName: fileName?.trim() || url.trim(),
      externalUrl: url.trim(),
      uploadedById: req.user!.id,
      documentType: documentType as DocumentType | undefined,
      relatedModule: relatedModule as RelatedModule | undefined,
    }
  })
  res.status(201).json({ ...attachment, url: attachment.externalUrl })
})

// GET /attachments/:id/versions — full revision history for a document, oldest first.
router.get('/:id/versions', requirePermission('attachment', 'read_own'), async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } })
  if (!attachment) { res.status(404).json({ error: 'Not found' }); return }
  const allowed = attachment.uploadedById === req.user!.id || await canAccessAttachmentTarget(req, attachment.entityType, attachment.entityId)
  if (!allowed) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const root = attachment.rootAttachmentId ?? attachment.id
  const versions = await prisma.attachment.findMany({
    where: { OR: [{ id: root }, { rootAttachmentId: root }] },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { version: 'asc' },
  })
  res.json(versions.map(v => ({ ...v, url: v.externalUrl ?? fileStorage.url(v.storageKey!) })))
})

router.get('/', requirePermission('attachment', 'read_own'), async (req: AuthRequest, res) => {
  const { entityType, entityId, discussionId, refs } = req.query as Record<string, string>
  if (entityType && entityId) {
    const allowed = await canAccessAttachmentTarget(req, entityType, entityId)
    if (!allowed) { res.status(403).json({ error: 'Insufficient permissions for target entity' }); return }
  }
  // Cross-module document visibility: a Project's Documents tab can pass
  // refs=Lead:id1,Deal:id2,Project:id3 to see documents uploaded at any stage of the
  // same lifecycle chain, without those documents being re-uploaded or duplicated —
  // it's the same Attachment rows, just queried under multiple ancestor contexts.
  let refFilters: { entityType: string; entityId: string }[] = []
  if (refs) {
    // Each ref costs an ownership lookup, so an unbounded list is a cheap way to
    // amplify one request into hundreds of queries. Cap the count, reject unknown
    // entity types up front, and constrain ids to the cuid charset.
    const MAX_REFS = 25
    const parts = refs.split(',').filter(Boolean)
    if (parts.length > MAX_REFS) {
      res.status(400).json({ error: `Too many refs (max ${MAX_REFS})` })
      return
    }
    refFilters = parts.map(r => {
      const [type, id] = r.split(':')
      return { entityType: (type ?? '').trim(), entityId: (id ?? '').trim() }
    })
    // Rejected rather than filtered out: silently dropping an unparseable ref
    // would run the query without that filter and could return more than the
    // caller asked for.
    const bad = refFilters.find(
      r => !isKnownAttachmentTarget(r.entityType) || !/^[A-Za-z0-9_-]{1,64}$/.test(r.entityId),
    )
    if (bad) {
      res.status(400).json({ error: `Invalid ref: ${bad.entityType}:${bad.entityId}` })
      return
    }
    for (const r of refFilters) {
      const allowed = await canAccessAttachmentTarget(req, r.entityType, r.entityId)
      if (!allowed) { res.status(403).json({ error: `Insufficient permissions for ${r.entityType}:${r.entityId}` }); return }
    }
  }
  const attachments = await prisma.attachment.findMany({
    where: {
      ...(entityType && entityId ? { entityType, entityId } : {}),
      ...(discussionId ? { discussionId } : {}),
      ...(refFilters.length ? { OR: refFilters.map(r => ({ entityType: r.entityType, entityId: r.entityId })) } : {}),
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(attachments.map(a => ({ ...a, url: a.externalUrl ?? fileStorage.url(a.storageKey!) })))
})

router.get('/:storageKey/download', requirePermission('attachment', 'read_own'), async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findFirst({ where: { storageKey: req.params.storageKey as string } })
  if (!attachment) { res.status(404).json({ error: 'Not found' }); return }
  const allowed = attachment.uploadedById === req.user!.id || await canAccessAttachmentTarget(req, attachment.entityType, attachment.entityId)
  if (!allowed) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  const buffer = await fileStorage.download(req.params.storageKey as string)
  res.setHeader('Content-Type', attachment.mimeType ?? 'application/octet-stream')
  // A stored fileName containing a quote or newline would otherwise let the
  // uploader inject extra response headers. RFC 5987 form carries the real name;
  // the quoted fallback is stripped to safe characters for older clients.
  const asciiName = attachment.fileName.replace(/["\\\r\n]/g, '_')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
  )
  // Stops a browser from re-interpreting an uploaded .html/.svg as active content.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(buffer)
})

router.delete('/:id', requirePermission('attachment', 'delete'), async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id as string } })
  if (!attachment) { res.status(404).json({ error: 'Not found' }); return }
  const canDeleteAll = await resolvePermission(req.user!.id, req.user!.roleName, 'attachment', 'delete_all')
  const allowed = canDeleteAll || attachment.uploadedById === req.user!.id || await canAccessAttachmentTarget(req, attachment.entityType, attachment.entityId)
  if (!allowed) { res.status(403).json({ error: 'Insufficient permissions' }); return }
  if (attachment.storageKey) await fileStorage.delete(attachment.storageKey)
  await prisma.attachment.delete({ where: { id: req.params.id as string } })
  res.status(204).end()
})

export default router
