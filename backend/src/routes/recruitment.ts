import { createSafeRouter } from '../lib/safeRouter'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/audit'

const router = createSafeRouter()
router.use(authenticate)

const ALLOWED_ROLES = ['SuperAdmin', 'HR', 'Manager', 'BusinessHead']

function checkAccess(req: AuthRequest, res: any): boolean {
  if (!ALLOWED_ROLES.includes(req.user?.roleName || '')) {
    res.status(403).json({ error: 'Access denied' })
    return false
  }
  return true
}

// ─── Job Openings ───

// List all job openings
router.get('/jobs', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { status, departmentId } = req.query
  const where: any = {}
  if (status) where.status = status
  if (departmentId) where.departmentId = departmentId

  const jobs = await prisma.jobOpening.findMany({
    where,
    include: {
      department: true,
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(jobs)
})

// Create job opening
router.post('/jobs', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { title, departmentId, designationId, location, employmentType, experience, skills, description, vacancies, status, postedDate, closingDate, hiringManagerId } = req.body
  if (!title || !departmentId) {
    return res.status(400).json({ error: 'title and departmentId are required' })
  }

  const job = await prisma.jobOpening.create({
    data: {
      title,
      departmentId,
      designationId: designationId || null,
      location: location || null,
      employmentType: employmentType || null,
      experience: experience || null,
      skills: skills || null,
      description: description || null,
      vacancies: vacancies ? parseInt(vacancies) : 1,
      status: status || 'Draft',
      postedDate: postedDate ? new Date(postedDate) : null,
      closingDate: closingDate ? new Date(closingDate) : null,
      hiringManagerId: hiringManagerId || null,
      createdById: req.user!.id,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Recruitment',
    entityId: job.id, newValue: { title, departmentId, status: job.status },
  })

  res.status(201).json(job)
})

// Update job opening
router.patch('/jobs/:id', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { id } = req.params
  const data = req.body

  const job = await prisma.jobOpening.update({
    where: { id: id as string },
    data,
  })

  if (data.status) {
    await logAudit({
      userId: req.user?.id, userName: req.user?.roleName, action: 'status_change', module: 'Recruitment',
      entityId: job.id, newValue: { status: data.status },
    })
  }

  res.json(job)
})

// ─── Candidates ───

// List candidates
router.get('/candidates', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { jobId, status } = req.query
  const where: any = {}
  if (jobId) where.jobId = jobId
  if (status) where.status = status

  const candidates = await prisma.candidate.findMany({
    where,
    include: { job: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(candidates)
})

// Create candidate
router.post('/candidates', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { name, email, phone, resumeUrl, currentCTC, expectedCTC, noticePeriod, experience, skills, source, jobId, remarks } = req.body
  if (!name || !email || !jobId) {
    return res.status(400).json({ error: 'name, email, and jobId are required' })
  }

  const candidate = await prisma.candidate.create({
    data: {
      name,
      email,
      phone: phone || null,
      resumeUrl: resumeUrl || null,
      currentCTC: currentCTC ? parseFloat(currentCTC) : null,
      expectedCTC: expectedCTC ? parseFloat(expectedCTC) : null,
      noticePeriod: noticePeriod || null,
      experience: experience || null,
      skills: skills || null,
      source: source || null,
      status: 'New',
      jobId,
      remarks: remarks || null,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Recruitment',
    entityId: candidate.id, newValue: { name, email, jobId },
  })

  res.status(201).json(candidate)
})

// Get single candidate with interviews and offers
router.get('/candidates/:id', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id as string },
    include: {
      job: true,
      interviews: { orderBy: { scheduledAt: 'asc' } },
      offers: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' })
  res.json(candidate)
})

// Update candidate
router.patch('/candidates/:id', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { id } = req.params
  const data = req.body

  const candidate = await prisma.candidate.update({
    where: { id: id as string },
    data,
  })

  if (data.status) {
    await logAudit({
      userId: req.user?.id, userName: req.user?.roleName, action: 'status_change', module: 'Recruitment',
      entityId: candidate.id, newValue: { status: data.status, name: candidate.name },
    })
  }

  res.json(candidate)
})

// ─── Interviews ───

// Create interview
router.post('/interviews', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { candidateId, round, interviewerId, scheduledAt, duration, mode, location, feedback, rating, result } = req.body
  if (!candidateId || !scheduledAt) {
    return res.status(400).json({ error: 'candidateId and scheduledAt are required' })
  }

  const interview = await prisma.interview.create({
    data: {
      candidateId,
      round: round || 1,
      interviewerId: interviewerId || null,
      scheduledAt: new Date(scheduledAt),
      duration: duration || null,
      mode: mode || null,
      location: location || null,
      feedback: feedback || null,
      rating: rating || null,
      result: result || 'Pending',
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Recruitment',
    entityId: interview.id, newValue: { candidateId, round: interview.round, scheduledAt },
  })

  res.status(201).json(interview)
})

// Update interview
router.patch('/interviews/:id', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { id } = req.params
  const data = req.body

  const interview = await prisma.interview.update({
    where: { id: id as string },
    data,
  })

  if (data.result) {
    await logAudit({
      userId: req.user?.id, userName: req.user?.roleName, action: 'status_change', module: 'Recruitment',
      entityId: interview.id, newValue: { result: data.result },
    })
  }

  res.json(interview)
})

// ─── Offers ───

// Create offer
router.post('/offers', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { candidateId, designation, department, offeredCTC, joiningDate, status, letterUrl, remarks } = req.body
  if (!candidateId || !offeredCTC) {
    return res.status(400).json({ error: 'candidateId and offeredCTC are required' })
  }

  const offer = await prisma.offer.create({
    data: {
      candidateId,
      designation: designation || null,
      department: department || null,
      offeredCTC: parseFloat(offeredCTC),
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      status: status || 'Draft',
      letterUrl: letterUrl || null,
      remarks: remarks || null,
      createdById: req.user!.id,
    },
  })

  await logAudit({
    userId: req.user?.id, userName: req.user?.roleName, action: 'create', module: 'Recruitment',
    entityId: offer.id, newValue: { candidateId, offeredCTC, designation },
  })

  res.status(201).json(offer)
})

// Update offer status
router.patch('/offers/:id', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return
  const { id } = req.params
  const data = req.body

  // Set sentAt/respondedAt automatically
  if (data.status === 'Sent' && !data.sentAt) data.sentAt = new Date()
  if (['Accepted', 'Declined'].includes(data.status) && !data.respondedAt) data.respondedAt = new Date()

  const offer = await prisma.offer.update({
    where: { id: id as string },
    data,
  })

  if (data.status) {
    await logAudit({
      userId: req.user?.id, userName: req.user?.roleName, action: 'status_change', module: 'Recruitment',
      entityId: offer.id, newValue: { status: data.status },
    })
  }

  res.json(offer)
})

// ─── Dashboard Stats ───

router.get('/stats', async (req: AuthRequest, res) => {
  if (!checkAccess(req, res)) return

  const [openJobs, candidatesByStatus, offersPending] = await Promise.all([
    prisma.jobOpening.count({ where: { status: 'Open' } }),
    prisma.candidate.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.offer.count({ where: { status: 'Sent' } }),
  ])

  res.json({
    openJobs,
    candidatesByStatus: candidatesByStatus.reduce((acc: any, item: any) => {
      acc[item.status] = item._count.id
      return acc
    }, {}),
    offersPending,
  })
})

export default router
