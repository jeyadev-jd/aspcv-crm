import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { logAudit } from '../services/audit'
import { runAllRules } from '../services/rulesEngine'
import '../services/businessRules'

const router = createSafeRouter()
router.use(authenticate)
router.use(requirePermission('business_rule', 'read_all'))

router.get('/', async (_req, res) => {
  const rules = await prisma.businessRule.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] })
  res.json(rules)
})

router.get('/:id/triggers', async (req, res) => {
  const triggers = await prisma.ruleTriggerLog.findMany({
    where: { ruleId: req.params.id as string },
    orderBy: { firedAt: 'desc' },
    take: 50,
  })
  res.json(triggers)
})

router.patch('/:id', requirePermission('business_rule', 'edit'), async (req: AuthRequest, res) => {
  const { enabled, config, name, description } = req.body as {
    enabled?: boolean; config?: object; name?: string; description?: string
  }
  const existing = await prisma.businessRule.findUnique({ where: { id: req.params.id as string } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const updated = await prisma.businessRule.update({
    where: { id: req.params.id as string },
    data: {
      ...(enabled !== undefined && { enabled }),
      ...(config !== undefined && { config }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
  })

  await logAudit({
    userId: req.user!.id, roleName: req.user!.roleName,
    action: 'business_rule_update', module: 'BusinessRule', entityId: updated.id,
    oldValue: { enabled: existing.enabled, config: existing.config },
    newValue: { enabled: updated.enabled, config: updated.config },
  })

  res.json(updated)
})

// POST /run — manual trigger for testing/verification, bypasses the 5-min scan throttle
router.post('/run', requirePermission('business_rule', 'edit'), async (_req, res) => {
  await runAllRules()
  res.json({ success: true })
})

export default router
