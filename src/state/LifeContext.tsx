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
  const objectsRef = useRef<LifeObject[]>([])
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
    replaceObjects(nextObjects)
    setCounts(nextCounts)
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
      const created = await repository.createObject(input)
      await refresh()
      return created
    },
    [refresh],
  )

  const updateObject = useCallback(
    async (id: string, input: UpdateObjectInput) => {
      const previous = objectsRef.current.find((object) => object.id === id)
      if (!previous) return undefined

      const version = (updateVersions.current.get(id) ?? 0) + 1
      updateVersions.current.set(id, version)

      const optimistic: LifeObject = {
        ...previous,
        title: input.title?.trim() ?? previous.title,
        body: input.body !== undefined ? input.body.trim() : previous.body,
        occurredAt: input.occurredAt ?? previous.occurredAt,
        meta: input.meta ?? previous.meta,
        updatedAt: new Date().toISOString(),
      }
      replaceObjects(
        objectsRef.current.map((object) => (object.id === id ? optimistic : object)),
      )

      const pending = updateQueues.current.get(id) ?? Promise.resolve()
      const operation = pending
        .catch(() => undefined)
        .then(() => repository.updateObject(id, input))
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
