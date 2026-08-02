import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Products
  await prisma.product.createMany({
    data: [
      { name: "MacbookAir11'2017", sku: 'SKU-345-097', price: 2700, quantity: 1550, category: 'Electronics', rating: 4.9, sales: 2600 },
      { name: 'MacbookPro 2019', sku: 'SKU-234-081', price: 2550, quantity: 1200, category: 'Electronics', rating: 4.6, sales: 1900 },
      { name: 'iPad Pro 2020', sku: 'SKU-123-045', price: 2150, quantity: 980, category: 'Electronics', rating: 4.9, sales: 1450 },
      { name: 'iPhone 12 Pro', sku: 'SKU-456-123', price: 1550, quantity: 2100, category: 'Electronics', rating: 4.6, sales: 3200 },
      { name: 'Apple Watch S6', sku: 'SKU-789-234', price: 1150, quantity: 890, category: 'Electronics', rating: 4.5, sales: 1100 },
    ],
    skipDuplicates: true,
  })

  // Invoices
  const inv1 = await prisma.invoice.upsert({
    where: { number: 'AA-04-19-1890' },
    update: {},
    create: {
      number: 'AA-04-19-1890',
      date: new Date('2019-05-18'),
      customer: 'Sophia Wagner',
      status: 'Paid',
      amount: 1890,
      fromName: 'WhiteOnWhite',
      toName: 'Dropbox Inc.',
      items: { create: [{ item: 'CRM UI design', hours: 356, rate: 10, amount: 3560 }] },
      activities: { create: [{ text: 'Created invoice #AA-04-19-1890' }] },
    },
  })

  // Tasks
  await prisma.task.createMany({
    data: [
      { title: 'Budget and contract', status: 'Done', subtasks: 3, completed: 3, comments: 0, attachments: 5, checked: true },
      { title: 'Search for a UI kit', status: 'Done', subtasks: 9, completed: 2, comments: 7, attachments: 3, checked: true },
      { title: 'Design new dashboard', status: 'Done', subtasks: 5, completed: 3, comments: 2, attachments: 2, checked: true },
      { title: 'Design search page', status: 'Pending', subtasks: 6, completed: 4, comments: 8, attachments: 6 },
      { title: 'Prepare HTML & CSS', status: 'Pending', subtasks: 2, completed: 0, comments: 1, attachments: 1 },
      { title: 'Fix issues', status: 'OnHold', subtasks: 9, completed: 5, comments: 2, attachments: 3 },
    ],
    skipDuplicates: false,
  })

  // Calendar events
  await prisma.calendarEvent.createMany({
    data: [
      { title: 'Meeting with a client', date: new Date('2026-05-05'), startTime: '10:00', endTime: '11:00', color: 'blue' },
      { title: 'Design new pages', date: new Date('2026-05-08'), startTime: '10:00', endTime: '11:00', color: 'green' },
      { title: 'Design new UI and check sales', date: new Date('2026-05-19'), startTime: '9:00', endTime: '13:00', color: 'yellow' },
    ],
  })

  console.log('Seed complete')
  void inv1
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
