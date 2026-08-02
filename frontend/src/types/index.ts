export interface Product {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  category: string
  rating: number
  sales: number
  image?: string
}

export interface Invoice {
  id: string
  number: string
  date: string
  customer: string
  customerAvatar?: string
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Generated' | 'Sent' | 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Closed' | 'Cancelled' | 'Scheduled' | 'Processing'
  invoiceType?: 'TaxInvoice' | 'BillOfSupply' | 'CreditNote' | 'DebitNote' | 'ProformaInvoice' | 'ExportInvoice'
  amount: number
  grandTotal?: number
  subTotal?: number
  totalCgst?: number
  totalSgst?: number
  totalIgst?: number
  totalCess?: number
  totalTax?: number
  roundOff?: number
  paidAmount?: number
  financialYear?: string
}

export interface Task {
  id: string
  title: string
  status: 'All' | 'Done' | 'Pending' | 'On Hold'
  subtasks: number
  completedSubtasks: number
  comments: number
  attachments: number
  assignee?: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  date: string
  color: string
}
