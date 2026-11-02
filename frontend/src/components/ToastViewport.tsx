import { useEffect } from 'react'
import type { ToastMessage } from '../types'

interface ToastViewportProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastViewport({ messages, onDismiss }: ToastViewportProps) {
  useEffect(() => {
    const timers = messages.map((message) => window.setTimeout(() => onDismiss(message.id), 4800))
    return () => timers.forEach(window.clearTimeout)
  }, [messages, onDismiss])

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
      {messages.map((message) => (
        <div className={`toast toast-${message.tone}`} key={message.id} role="status">
          <span className="toast-mark" aria-hidden="true">{message.tone === 'success' ? '✓' : message.tone === 'error' ? '!' : 'i'}</span>
          <div className="toast-text"><strong>{message.title}</strong><span>{message.detail}</span></div>
          <button className="toast-dismiss" type="button" onClick={() => onDismiss(message.id)} aria-label="Tutup notifikasi">×</button>
        </div>
      ))}
    </div>
  )
}
