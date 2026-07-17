// Assign leadNumber (via the concurrency-safe DB sequence) to any pre-existing lead
// that doesn't have one yet. New leads get it at creation time going forward.
// Run: npx tsx scripts/backfill-lead-numbers.ts
import prisma from '../src/lib/prisma'
import { nextLeadNumber } from '../src/lib/sequences'

async function main() {
  const leads = await prisma.lead.findMany({ where: { leadNumber: null }, select: { id: true }, orderBy: { createdAt: 'asc' } })
  console.log(`Assigning lead numbers to ${leads.length} leads...`)
  for (const l of leads) {
    const leadNumber = await nextLeadNumber()
    await prisma.lead.update({ where: { id: l.id }, data: { leadNumber } })
  }
  console.log('Done.')
}
main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
