import type { Dispatch, SetStateAction, SyntheticEvent } from 'react'

export const handleLocationToggle = (
  event: SyntheticEvent<HTMLDetailsElement>,
  stopId: string,
  setExpandedStops: Dispatch<SetStateAction<Set<string>>>,
) => {
  const isOpen = event.currentTarget.open
  setExpandedStops((previous) => {
    const next = new Set(previous)
    if (isOpen) next.add(stopId)
    else next.delete(stopId)
    return next
  })
}
