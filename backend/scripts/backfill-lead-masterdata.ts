// Phase 1 backfill: auto-create master rows from every distinct existing Lead.region /
// Lead.commercialType / Lead.source value, then point the new FK columns at them.
// Legacy string columns are left untouched (dropped later, after regression passes).
// Run: npx tsx scripts/backfill-lead-masterdata.ts
import prisma from '../src/lib/prisma'

async function main() {
  const leads = await prisma.lead.findMany({ select: { id: true, region: true, commercialType: true, source: true } })
  console.log(`Found ${leads.length} leads to backfill.`)

  const regionMap = new Map<string, string>()
  const modelMap = new Map<string, string>()
  const sourceMap = new Map<string, string>()

  let updated = 0
  for (const lead of leads) {
    let regionId: string | undefined
    let commercialModelId: string | undefined
    let leadSourceId: string | undefined

    if (lead.region) {
      if (!regionMap.has(lead.region)) {
        const r = await prisma.region.upsert({ where: { name: lead.region }, update: {}, create: { name: lead.region } })
        regionMap.set(lead.region, r.id)
      }
      regionId = regionMap.get(lead.region)
    }
    if (lead.commercialType) {
      if (!modelMap.has(lead.commercialType)) {
        const m = await prisma.commercialModel.upsert({ where: { name: lead.commercialType }, update: {}, create: { name: lead.commercialType } })
        modelMap.set(lead.commercialType, m.id)
      }
      commercialModelId = modelMap.get(lead.commercialType)
    }
    if (lead.source) {
      if (!sourceMap.has(lead.source)) {
        const s = await prisma.leadSourceMaster.upsert({ where: { name: lead.source }, update: {}, create: { name: lead.source } })
        sourceMap.set(lead.source, s.id)
      }
      leadSourceId = sourceMap.get(lead.source)
    }

    await prisma.lead.update({ where: { id: lead.id }, data: { regionId, commercialModelId, leadSourceId } })
    updated++
  }

  console.log(`Backfilled ${updated} leads.`)
  console.log(`Master rows created — Regions: ${regionMap.size}, CommercialModels: ${modelMap.size}, LeadSources: ${sourceMap.size}`)

  // Verification: region/commercialType/source are non-nullable strings today, so every
  // lead has a legacy value — confirm every lead now also has the matching FK set.
  const unmigrated = await prisma.lead.count({
    where: { OR: [{ regionId: null }, { commercialModelId: null }, { leadSourceId: null }] },
  })
  if (unmigrated > 0) {
    console.error(`❌ ${unmigrated} leads failed to migrate — a legacy value has no matching FK. Investigate before dropping legacy columns.`)
    process.exit(1)
  }
  console.log('✅ Verification passed — every lead with a legacy value now has a matching FK.')
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
