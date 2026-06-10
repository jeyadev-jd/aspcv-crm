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
  status: 'Paid' | 'Unpaid' | 'Scheduled' | 'Processing'
  amount: number
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

export interface KanbanCard {
  id: string
  title: string
  category: string
  progress: number
  total: number
  date: string
  comments: number
  attachments: number
  assignees: number
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
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
