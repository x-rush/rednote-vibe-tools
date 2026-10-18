import { membraneContour, membranePoint, type MembraneSilhouette } from '../domain/membrane'

const paths = new Map<string, { atMs: number; path: Path2D }>()
/** Exact retained vectors, never a raster sprite or a lower-resolution outline. */
export function membranePath(silhouette: MembraneSilhouette, atMs: number, id: string, cueSamples?: number): Path2D | undefined {
  if (typeof Path2D === 'undefined') return undefined
  const shared = silhouette === 'pearl' || silhouette === 'colony' || silhouette === 'ciliate' || silhouette === 'swimmer'
    || silhouette.startsWith('dart-') || silhouette.startsWith('bastion-') || silhouette.startsWith('bloom-')
  const key = `${silhouette}:${cueSamples ?? 'body'}:${shared ? '' : id}`
  const cached = paths.get(key)
  if (cached?.atMs === atMs) return cached.path
  const points = cueSamples === undefined ? membraneContour(silhouette, atMs, id)
    : Array.from({ length: cueSamples + 1 }, (_, index) => membranePoint(silhouette, index / cueSamples * Math.PI * 2, atMs, id))
  const path = new Path2D()
  path.moveTo(points[0]!.x, points[0]!.y)
  for (let index = 1; index < points.length; index += 1) path.lineTo(points[index]!.x, points[index]!.y)
  if (cueSamples === undefined) path.closePath()
  if (!cached && paths.size >= 512) paths.delete(paths.keys().next().value!)
  paths.set(key, { atMs, path })
  return path
}
