import { useState, useRef } from 'react'
import { Copy, Check } from 'lucide-react'

export function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // Clipboard API unavailable (e.g. insecure context).
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-lg border border-border bg-[#0A0D12] overflow-hidden">
      {label && (
        <div className="px-3 py-1.5 border-b border-border bg-surface-2">
          <p className="text-text-3 text-[11px]">{label}</p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 px-3.5 py-3">
        <pre className="text-text-1 text-[13px] font-mono leading-relaxed
                        whitespace-pre-wrap break-words flex-1 min-w-0">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          title="Copy command"
          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md
                     text-[11px] font-mono transition-colors border
                     ${copied
                       ? 'text-success border-success/30 bg-success/10'
                       : 'text-text-3 border-transparent hover:text-text-1 hover:border-border hover:bg-surface-2'
                     }`}
        >
          {copied
            ? <><Check size={12} /> Copied</>
            : <><Copy size={12} /> Copy</>
          }
        </button>
      </div>
    </div>
  )
}
