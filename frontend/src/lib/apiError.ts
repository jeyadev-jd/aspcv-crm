// Turns an axios/API error into a message safe to show a user — never the raw
// "Request failed with status code 403" axios default, and never a stack trace.
export function friendlyError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { error?: unknown } }; message?: string; request?: unknown }
  const status = e?.response?.status
  const backendMessage = typeof e?.response?.data?.error === 'string' ? e.response.data.error : undefined

  if (status === 403) return backendMessage && backendMessage !== 'Insufficient permissions'
    ? backendMessage
    : "You don't have permission to do that."
  if (status === 401) return 'Your session has expired. Please log in again.'
  if (status === 404) return backendMessage ?? "That record couldn't be found — it may have been deleted."
  if (status === 400) return backendMessage ?? 'Please check the information you entered and try again.'
  if (status === 409) return backendMessage ?? 'This conflicts with existing data.'
  if (status && status >= 500) return "Something went wrong on our end. Please try again — if it keeps happening, contact support."
  if (e?.request && !e?.response) return "Can't reach the server. Check your connection and try again."
  return backendMessage ?? 'Something went wrong. Please try again.'
}
