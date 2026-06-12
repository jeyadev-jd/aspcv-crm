import { useAuthStore } from '../lib/authStore'

export function usePermission(resource: string, action: string): boolean {
  return useAuthStore((s) => s.can(resource, action))
}

export function usePermissions(): (resource: string, action: string) => boolean {
  return useAuthStore((s) => s.can)
}
