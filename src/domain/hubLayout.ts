import { LIFE_MODULES, type LifeModule, type ModuleId } from './modules'

export type HubLayout = {
  /** 홈에 보이는 카드 순서 */
  order: ModuleId[]
  /** 홈에서 뺀 카드 */
  excluded: ModuleId[]
}

const ALL_IDS = LIFE_MODULES.map((module) => module.id)

export function defaultHubLayout(): HubLayout {
  return {
    order: [...ALL_IDS],
    excluded: [],
  }
}

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && ALL_IDS.includes(value as ModuleId)
}

/** 알 수 없는 id 제거, 빠진 모듈은 order 끝에 붙임, 중복 제거. */
export function normalizeHubLayout(input: unknown): HubLayout {
  const raw =
    input && typeof input === 'object'
      ? (input as { order?: unknown; excluded?: unknown })
      : {}

  const orderRaw = Array.isArray(raw.order) ? raw.order.filter(isModuleId) : []
  const excludedRaw = Array.isArray(raw.excluded)
    ? raw.excluded.filter(isModuleId)
    : []

  const seen = new Set<ModuleId>()
  const order: ModuleId[] = []
  for (const id of orderRaw) {
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
  }

  const excluded: ModuleId[] = []
  for (const id of excludedRaw) {
    if (seen.has(id)) continue
    seen.add(id)
    excluded.push(id)
  }

  for (const id of ALL_IDS) {
    if (seen.has(id)) continue
    order.push(id)
  }

  return { order, excluded }
}

export function resolveHubModules(layout: HubLayout): LifeModule[] {
  const catalog = new Map(LIFE_MODULES.map((module) => [module.id, module]))
  return layout.order
    .map((id) => catalog.get(id))
    .filter((module): module is LifeModule => Boolean(module))
}

export function resolveExcludedModules(layout: HubLayout): LifeModule[] {
  const catalog = new Map(LIFE_MODULES.map((module) => [module.id, module]))
  return layout.excluded
    .map((id) => catalog.get(id))
    .filter((module): module is LifeModule => Boolean(module))
}

export function removeHubModule(layout: HubLayout, id: ModuleId): HubLayout {
  if (!layout.order.includes(id)) return layout
  return normalizeHubLayout({
    order: layout.order.filter((item) => item !== id),
    excluded: [...layout.excluded, id],
  })
}

export function addHubModule(layout: HubLayout, id: ModuleId): HubLayout {
  if (!layout.excluded.includes(id)) return layout
  return normalizeHubLayout({
    order: [...layout.order, id],
    excluded: layout.excluded.filter((item) => item !== id),
  })
}

export function reorderHubModules(
  layout: HubLayout,
  nextOrder: ModuleId[],
): HubLayout {
  const allowed = new Set(layout.order)
  const order = nextOrder.filter((id) => allowed.has(id))
  for (const id of layout.order) {
    if (!order.includes(id)) order.push(id)
  }
  return normalizeHubLayout({ order, excluded: layout.excluded })
}
