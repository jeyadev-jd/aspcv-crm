import React from 'react'
import { usePermission } from '../../hooks/usePermission'

interface CanProps {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Can({ resource, action, children, fallback = null }: CanProps) {
  const allowed = usePermission(resource, action)
  return allowed ? <>{children}</> : <>{fallback}</>
}
