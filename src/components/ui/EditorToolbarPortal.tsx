import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EditorToolbarTargetContext } from './editorToolbarTarget'

export function EditorToolbarPortal({ children }: { children: ReactNode }) {
  const target = useContext(EditorToolbarTargetContext)
  return target ? createPortal(children, target) : children
}
