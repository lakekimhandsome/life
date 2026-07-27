import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as repository from '../core/repository'
import type {
  CreateObjectInput,
  LifeObject,
  ObjectType,
  Relationship,
  RelationshipKind,
  UpdateObjectInput,
} from '../core/types'
import { useAuth } from './AuthContext'

interface LifeContextValue {
  ready: boolean
  objects: LifeObject[]
  counts: Record<ObjectType, number>
  refresh: () => Promise<void>
  createObject: (input: CreateObjectInput) => Promise<LifeObject>
  updateObject: (id: string, input: UpdateObjectInput) => Promise<LifeObject | undefined>
  deleteObject: (id: string) => Promise<void>
  getObject: (id: string) => LifeObject | undefined
  listByType: (type: ObjectType) => LifeObject[]
  getRelationships: (objectId: string) => Promise<Relationship[]>
  linkObjects: (
    sourceId: string,
    targetId: string,
    kind?: RelationshipKind,
  ) => Promise<Relationship>
  unlink: (relationshipId: string) => Promise<void>
}

const LifeContext = createContext<LifeContextValue | null>(null)

const emptyCounts: Record<ObjectType, number> = {
  journal: 0,
  project: 0,
  workout: 0,
  study: 0,
  goal: 0,
  asset: 0,
}

export function LifeProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth()
  const [ready, setReady] = useState(false)
  const [objects, setObjects] = useState<LifeObject[]>([])
  const [counts, setCounts] = useState(emptyCounts)

  const refresh = useCallback(async () => {
    const [nextObjects, nextCounts] = await Promise.all([
      repository.listObjects(),
      repository.countByType(),
    ])
    setObjects(nextObjects)
    setCounts(nextCounts)
  }, [])

  useEffect(() => {
    if (!authReady) return

    let active = true
    setReady(false)
    ;(async () => {
      try {
        if (user) {
          await repository.migrateLocalToCloudIfNeeded()
        }
        await refresh()
      } catch (error) {
        console.error('Failed to load life data', error)
      } finally {
        if (active) setReady(true)
      }
    })()

    return () => {
      active = false
    }
  }, [authReady, user, refresh])

  const createObject = useCallback(
    async (input: CreateObjectInput) => {
      const created = await repository.createObject(input)
      await refresh()
      return created
    },
    [refresh],
  )

  const updateObject = useCallback(
    async (id: string, input: UpdateObjectInput) => {
      const updated = await repository.updateObject(id, input)
      await refresh()
      return updated
    },
    [refresh],
  )

  const deleteObject = useCallback(
    async (id: string) => {
      await repository.deleteObject(id)
      await refresh()
    },
    [refresh],
  )

  const getObject = useCallback(
    (id: string) => objects.find((object) => object.id === id),
    [objects],
  )

  const listByType = useCallback(
    (type: ObjectType) => objects.filter((object) => object.type === type),
    [objects],
  )

  const getRelationships = useCallback(async (objectId: string) => {
    return repository.listRelationshipsFor(objectId)
  }, [])

  const linkObjects = useCallback(
    async (
      sourceId: string,
      targetId: string,
      kind: RelationshipKind = 'supports',
    ) => {
      const relationship = await repository.createRelationship({
        sourceId,
        targetId,
        kind,
      })
      return relationship
    },
    [],
  )

  const unlink = useCallback(async (relationshipId: string) => {
    await repository.deleteRelationship(relationshipId)
  }, [])

  const value = useMemo(
    () => ({
      ready,
      objects,
      counts,
      refresh,
      createObject,
      updateObject,
      deleteObject,
      getObject,
      listByType,
      getRelationships,
      linkObjects,
      unlink,
    }),
    [
      ready,
      objects,
      counts,
      refresh,
      createObject,
      updateObject,
      deleteObject,
      getObject,
      listByType,
      getRelationships,
      linkObjects,
      unlink,
    ],
  )

  return <LifeContext.Provider value={value}>{children}</LifeContext.Provider>
}

export function useLife(): LifeContextValue {
  const context = useContext(LifeContext)
  if (!context) {
    throw new Error('useLife must be used within LifeProvider')
  }
  return context
}
