import { createContext } from 'react'

export const ImageRemovalContext = createContext<WeakMap<HTMLImageElement, () => void> | null>(null)
