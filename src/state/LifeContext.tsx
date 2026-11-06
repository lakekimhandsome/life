import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  note: 0,
  plan: 0,
  goal: 0,
  asset: 0,
}

export function LifeProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth()
  const [ready, setReady] = useState(false)
  const [objects, setObjects] = useState<LifeObject[]>([])
  const [counts, setCounts] = useState(emptyCounts)
  const objectsRef = useRef<LifeObject[]>([])
  const pendingCreates = useRef(new Map<string, Promise<LifeObject>>())
  const pendingDeletes = useRef(new Set<string>())
  const updateQueues = useRef(new Map<string, Promise<void>>())
  const updateVersions = useRef(new Map<string, number>())

  const replaceObjects = useCallback((next: LifeObject[]) => {
    objectsRef.current = next
    setObjects(next)
  }, [])

  const refresh = useCallback(async () => {
    const [nextObjects, nextCounts] = await Promise.all([
      repository.listObjects(),
      repository.countByType(),
    ])
    const merged = [
      ...nextObjects.filter((object) => !pendingCreates.current.has(object.id) && !pendingDeletes.current.has(object.id)),
      ...objectsRef.current.filter((object) => pendingCreates.current.has(object.id)),
    ]
    replaceObjects(merged)
    setCounts({ ...nextCounts, plan: merged.filter((object) => object.type === 'plan').length })
  }, [replaceObjects])

  useEffect(() => {
    if (!authReady) return

    let active = true

    if (!user) {
      replaceObjects([])
      setCounts(emptyCounts)
      setReady(true)
      return () => {
        active = false
      }
    }

    setReady(false)
    ;(async () => {
      try {
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
  }, [authReady, user, refresh, replaceObjects])

  const createObject = useCallback(
    async (input: CreateObjectInput) => {
      if (input.type === 'plan') {
        const optimistic = repository.prepareObject(input)
        const operation = repository.insertObject(optimistic)
        pendingCreates.current.set(optimistic.id, operation)
        replaceObjects([...objectsRef.current, optimistic])
        setCounts((current) => ({ ...current, plan: current.plan + 1 }))
        try {
          return await operation
        } catch (error) {
          if (objectsRef.current.some((object) => object.id === optimistic.id)) {
            replaceObjects(objectsRef.current.filter((object) => object.id !== optimistic.id))
            setCounts((current) => ({ ...current, plan: Math.max(0, current.plan - 1) }))
          }
          throw error
        } finally {
          pendingCreates.current.delete(optimistic.id)
        }
      }
      const created = await repository.createObject(input)
      await refresh()
      return created
    },
    [refresh, replaceObjects],
  )

  const updateObject = useCallback(
    async (id: string, input: UpdateObjectInput) => {
      const previous = objectsRef.current.find((object) => object.id === id)
      if (!previous) return undefined

      const version = (updateVersions.current.get(id) ?? 0) + 1
      updateVersions.current.set(id, version)

      const optimistic: LifeObject = {
        ...previous,
        folderId: input.folderId !== undefined ? input.folderId : previous.folderId,
        title: input.title?.trim() ?? previous.title,
        body: input.body !== undefined ? input.body.trim() : previous.body,
        occurredAt: input.occurredAt ?? previous.occurredAt,
        visibility: input.visibility ?? previous.visibility,
        meta: input.meta ?? previous.meta,
        updatedAt: new Date().toISOString(),
      }
      replaceObjects(
        objectsRef.current.map((object) => (object.id === id ? optimistic : object)),
      )

      const pending = updateQueues.current.get(id) ?? Promise.resolve()
      const operation = pending
        .catch(() => undefined)
        .then(async () => {
          await pendingCreates.current.get(id)
          return repository.updateObject(id, input)
        })
      const queueTail = operation.then(
        () => undefined,
        () => undefined,
      )
      updateQueues.current.set(id, queueTail)

      try {
        const updated = await operation
        if (updated && updateVersions.current.get(id) === version) {
          replaceObjects(
            objectsRef.current.map((object) => (object.id === id ? updated : object)),
          )
        }
        return updated
      } catch (error) {
        if (updateVersions.current.get(id) === version) {
          replaceObjects(
            objectsRef.current.map((object) => (object.id === id ? previous : object)),
          )
        }
        throw error
      } finally {
        if (updateQueues.current.get(id) === queueTail) {
          updateQueues.current.delete(id)
        }
      }
    },
    [replaceObjects],
  )

  const deleteObject = useCallback(
    async (id: string) => {
      const previous = objectsRef.current.find((object) => object.id === id)
      if (!previous) return
      if (previous.type !== 'plan') {
        await repository.deleteObject(id)
        await refresh()
        return
      }

      pendingDeletes.current.add(id)
      replaceObjects(objectsRef.current.filter((object) => object.id !== id))
      setCounts((current) => ({ ...current, plan: Math.max(0, current.plan - 1) }))
      try {
        try {
          await pendingCreates.current.get(id)
        } catch {
          // A failed creation has no saved plan to delete or restore.
          return
        }
        await updateQueues.current.get(id)
        await repository.deleteObject(id)
      } catch (error) {
        replaceObjects([...objectsRef.current, previous])
        setCounts((current) => ({ ...current, plan: current.plan + 1 }))
        throw error
      } finally {
        pendingDeletes.current.delete(id)
      }
    },
    [refresh, replaceObjects],
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
