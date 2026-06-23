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

      // в”Ђв”Ђ Ctrl+Z / Cmd+Z вЂ” Undo в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        if (history.length > 0) {
          undo()
        }
        return
      }

      // в”Ђв”Ђ Ctrl +/-/0 вЂ” Zoom в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

      if (isTyping()) return

      if (e.key === 'Escape') {
        if (tool === 'wall') {
          useStore.setState({ drawing: false, drawStart: null })
        }
        if (mode === 'constructor') {
          setTool('wall')
        }
        return
      }

      // в”Ђв”Ђ Delete/Backspace вЂ” РїРµСЂРµРјРєРЅСѓС‚Рё РЅР° Erase в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'constructor') {
        e.preventDefault()
        setTool('erase')
        return
      }

      // в”Ђв”Ђ Р†РЅСЃС‚СЂСѓРјРµРЅС‚Рё (С‚С–Р»СЊРєРё РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
      if (mode !== 'constructor') return

      const toolMap = {
        '1': 'wall', 'w': 'wall', 'W': 'wall', 'С†': 'wall', 'Р¦': 'wall',
        '2': 'door', 'd': 'door', 'D': 'door', 'РІ': 'door', 'Р’': 'door',
        '3': 'exit', 'e': 'exit', 'E': 'exit', 'Сѓ': 'exit', 'РЈ': 'exit',
        '4': 'stair', 's': 'stair', 'S': 'stair', 'С–': 'stair', 'Р†': 'stair',
        '5': 'erase', 'x': 'erase', 'X': 'erase', 'С‡': 'erase', 'Р§': 'erase',
        'g': 'window', 'G': 'window',
        'v': 'select', 'V': 'select', 'Рј': 'select', 'Рњ': 'select',
      }

      if (toolMap[e.key]) {
        e.preventDefault()
        setTool(toolMap[e.key])
      }
    }

    // capture: true вЂ” РїРµСЂРµС…РѕРїР»СЋС”РјРѕ РґРѕ С‚РѕРіРѕ СЏРє Р±СЂР°СѓР·РµСЂ РІСЃС‚РёРіРЅРµ РѕР±СЂРѕР±РёС‚Рё
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])
}
