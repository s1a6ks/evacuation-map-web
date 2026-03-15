import { useEffect } from 'react'
import useStore from '../store/useStore'

export default function useKeyboardShortcuts() {
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }

    function handleKeyDown(e) {
      const { undo, tool, setTool, mode, history, scale, offset, setTransform, resetTransform } = useStore.getState()

      // ── Ctrl+Z / Cmd+Z — Undo ────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        if (history.length > 0) {
          undo()
        }
        return
      }

      // ── Ctrl +/-/0 — Zoom ─────────────────────────────────
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          setTransform(Math.min(scale * 1.2, 8), offset)
          return
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          setTransform(Math.max(scale / 1.2, 0.2), offset)
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          resetTransform()
          return
        }
      }

      // Решта shortcuts — не спрацьовують у полях вводу
      if (isTyping()) return

      // ── Escape — скасувати малювання ─────────────────────
      if (e.key === 'Escape') {
        if (tool === 'wall') {
          useStore.setState({ drawing: false, drawStart: null })
        }
        if (mode === 'constructor') {
          setTool('wall')
        }
        return
      }

      // ── Delete/Backspace — перемкнути на Erase ───────────
      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'constructor') {
        e.preventDefault()
        setTool('erase')
        return
      }

      // ── Інструменти (тільки конструктор) ─────────────────
      if (mode !== 'constructor') return

      const toolMap = {
        '1': 'wall', 'w': 'wall', 'W': 'wall', 'ц': 'wall', 'Ц': 'wall',
        '2': 'door', 'd': 'door', 'D': 'door', 'в': 'door', 'В': 'door',
        '3': 'exit', 'e': 'exit', 'E': 'exit', 'у': 'exit', 'У': 'exit',
        '4': 'stair', 's': 'stair', 'S': 'stair', 'і': 'stair', 'І': 'stair',
        '5': 'erase', 'x': 'erase', 'X': 'erase', 'ч': 'erase', 'Ч': 'erase',
        'v': 'select', 'V': 'select', 'м': 'select', 'М': 'select',
      }

      if (toolMap[e.key]) {
        e.preventDefault()
        setTool(toolMap[e.key])
      }
    }

    // capture: true — перехоплюємо до того як браузер встигне обробити
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])
}