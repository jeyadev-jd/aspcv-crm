import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DiscussionParticipant {
  id: string
  userId?: string
  contactId?: string
  user?: { id: string; name: string }
  contact?: { id: string; name: string; designation?: string }
}

export interface Discussion {
  id: string
  entityType: string
  entityId: string
  type: 'VoiceCall' | 'VideoCall' | 'Meeting' | 'WhatsApp' | 'Email' | 'SiteVisit' | 'ManualDiscussion'
  category?: string
  title: string
  scheduledAt?: string
  summary?: string
  decisions?: string
  nextActions?: string
  followUpAt?: string
  participants: DiscussionParticipant[]
  attachments: any[]
  projectLinks?: { projectId: string }[]
  createdAt: string
}

export const DISCUSSION_TYPES = [
  { value: 'VoiceCall',        label: 'Voice Call'   },
  { value: 'VideoCall',        label: 'Video Call'   },
  { value: 'Meeting',          label: 'Meeting'      },
  { value: 'WhatsApp',         label: 'WhatsApp'     },
  { value: 'Email',            label: 'Email'        },
  { value: 'SiteVisit',        label: 'Site Visit'   },
  { value: 'ManualDiscussion', label: 'Manual Note'  },
]

export const DISCUSSION_CATEGORIES = [
  { value: 'General',         label: 'General',                     color: '#8C8C8C', bg: '#F4F5F9' },
  { value: 'Enquiry',         label: 'Enquiry Discussion',          color: '#5D78FF', bg: '#E8EDFF' },
  { value: 'ProspectiveLead', label: 'Prospective Lead Discussion', color: '#FF9B52', bg: '#FFF5EE' },
  { value: 'ProjectHold',     label: 'Project Hold Discussion',     color: '#8B5CF6', bg: '#F3EEFF' },
  { value: 'Hibernated',      label: 'Hibernated Discussion',       color: '#8C8C8C', bg: '#F4F5F9' },
  { value: 'OrderWon',        label: 'Order Won',                   color: '#2BC155', bg: '#E7FAF0' },
  { value: 'OrderLost',       label: 'Order Lost',                  color: '#FF5353', bg: '#FFEEEE' },
]

export function useDiscussions(entityType: string, entityId: string) {
  return useQuery<Discussion[]>({
    queryKey: ['discussions', entityType, entityId],
    queryFn: () => api.get('/discussions', { params: { entityType, entityId } }).then(r => r.data),
    enabled: !!entityId,
  })
}

export function useCreateDiscussion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/discussions', data).then(r => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['discussions', vars.entityType as string, vars.entityId as string] }),
  })
}

export function useDeleteDiscussion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; entityType: string; entityId: string }) => api.delete(`/discussions/${id}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['discussions', vars.entityType, vars.entityId] }),
  })
}

// Optional, non-destructive: surfaces a Deal/Lead discussion on a Project too — the
// discussion keeps its original entityType/entityId. Sales Manager can do this at
// handover time or any time later.
export function useLinkDiscussionToProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ discussionId, projectId }: { discussionId: string; projectId: string; entityType: string; entityId: string }) =>
      api.post(`/discussions/${discussionId}/link-project`, { projectId }).then(r => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['discussions', vars.entityType, vars.entityId] })
      qc.invalidateQueries({ queryKey: ['discussions', 'Project', vars.projectId] })
    },
  })
}

export function useUnlinkDiscussionFromProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ discussionId, projectId }: { discussionId: string; projectId: string; entityType: string; entityId: string }) =>
      api.delete(`/discussions/${discussionId}/link-project/${projectId}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['discussions', vars.entityType, vars.entityId] })
      qc.invalidateQueries({ queryKey: ['discussions', 'Project', vars.projectId] })
    },
  })
}
