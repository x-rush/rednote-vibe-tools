import { useState } from 'react'
import type { ChecklistCategory, ChecklistLocation, GeneratedChecklist } from '../content/schema'
import { getLocationRoute } from './checklistView'
import { AssetIcon } from './AssetIcon'
import { ChecklistRow } from './ChecklistRow'
import { handleLocationToggle } from './locationToggle'

type LocationRouteViewProps = {
  checklist: GeneratedChecklist
  categories: ChecklistCategory[]
  locations: ChecklistLocation[]
  onChecked: (entryId: string, checked: boolean) => void
  onDetail: (entryId: string) => void
  onEditCustom: (entryId: string) => void
}

export function LocationRouteView({
  checklist,
  categories,
  locations,
  onChecked,
  onDetail,
  onEditCustom,
}: LocationRouteViewProps) {
  const route = getLocationRoute(checklist, locations)
  const current = route.find((stop) => stop.current)
  const [expandedStops, setExpandedStops] = useState<Set<string>>(() => new Set())
  const categoryAssets = new Map(categories.map((category) => [category.categoryId, category.iconAssetId]))

  return (
    <section className="route-view" aria-labelledby="route-title">
      <header className="route-summary">
        <p>空间巡视 · 下一站</p>
        <h2 id="route-title">{current ? `先去${current.label}` : '关键位置已经走完'}</h2>
        <span>{current ? `这里还有 ${current.remaining} 项未完成` : '可以回看任意位置'}</span>
      </header>
      <ol className="route-stops">
        {route.map((stop) => (
          <li className={`${stop.current ? 'current' : ''} ${stop.complete ? 'complete' : ''}`} key={stop.id}>
            <details
              open={stop.current || expandedStops.has(stop.id)}
              onToggle={(event) => {
                if (stop.current) return
                handleLocationToggle(event, stop.id, setExpandedStops)
              }}
            >
              <summary>
                <span className="asset-tile small"><AssetIcon assetId={stop.iconAssetId ?? ''} /></span>
                <span><strong>{stop.label}</strong><small>{stop.complete ? '已经完成' : `还有 ${stop.remaining} 项`}</small></span>
              </summary>
              <ul className="entry-list">
                {stop.entries.map((entry) => (
                  <ChecklistRow
                    key={entry.entryId}
                    entry={entry}
                    categoryAssetId={categoryAssets.get(entry.categoryId)}
                    onChecked={onChecked}
                    onDetail={onDetail}
                    onEditCustom={onEditCustom}
                  />
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      <p className="inline-notice">路线来自常见拿取位置，不读取户型或设备位置。</p>
    </section>
  )
}
