import { useState, useCallback, useMemo } from 'react'

/**
 * Selection state for a list with bulk actions. Tracks a set of ids and offers
 * toggle / select-all / clear helpers plus derived flags for the header checkbox.
 */
export function useBulkSelect(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const idsKey = allIds.join(',')
  const toggleAll = useCallback(() => {
    setSelected(prev => {
      // If everything currently listed is selected, clear; otherwise select all.
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(allIds)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selectedIds.length > 0 && !allSelected

  return {
    selected,
    selectedIds,
    count: selectedIds.length,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  }
}
