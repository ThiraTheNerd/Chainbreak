import { useEffect, useRef, useCallback } from 'react'
import { io }        from 'socket.io-client'
import { Terminal }  from '@xterm/xterm'
import { FitAddon }  from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPane({
  sessionId,
  challengeIds,
  token,
  onFlagCaptured,
  onConnected,
  onError,
}) {
  const containerRef = useRef(null)
  const termRef      = useRef(null)
  const socketRef    = useRef(null)
  const fitRef       = useRef(null)

  const writeToTerminal = useCallback((text, color) => {
    const term = termRef.current
    if (!term) return
    if (color === 'green')  term.write(`\r\n\x1b[32m${text}\x1b[0m\r\n`)
    else if (color === 'red') term.write(`\r\n\x1b[31m${text}\x1b[0m\r\n`)
    else term.write(text)
  }, [])

  useEffect(() => {
    if (!containerRef.current || !sessionId || !token) return

    const terminal = new Terminal({
      cursorBlink:  true,
      fontSize:     14,
      lineHeight:   1.2,
      fontFamily:   '"JetBrains Mono", "Fira Code", "Menlo", monospace',
      theme: {
        background:   '#0D1117',
        foreground:   '#E6EDF3',
        cursor:       '#388BFD',
        cursorAccent: '#0D1117',
        black:        '#30363D',
        red:          '#F85149',
        green:        '#2EA043',
        yellow:       '#D29922',
        blue:         '#388BFD',
        magenta:      '#BC8CFF',
        cyan:         '#2EA043',
        white:        '#E6EDF3',
        brightBlack:  '#484F58',
        brightWhite:  '#F0F6FC',
      },
      scrollback: 1000,
      allowTransparency: false,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

    termRef.current = terminal
    fitRef.current  = fitAddon

    terminal.write('\x1b[32m[ChainBreak] Connecting to container...\x1b[0m\r\n')

    terminal.onData((data) => {
      socketRef.current?.emit('terminal:input', data)
    })

    let disposed     = false
    let resizeTimer   = null

    // Single source of truth for "measure + tell the backend": every
    // trigger (initial connect, the delayed post-fonts correction, live
    // resizes) funnels through this, so the emitted cols/rows always come
    // from FitAddon's own measurement.
    function fitAndEmit() {
      if (disposed || !fitRef.current) return
      fitRef.current.fit()
      socketRef.current?.emit('terminal:resize', {
        cols: terminal.cols,
        rows: terminal.rows,
      })
    }
    function scheduleFitAndEmit(delayMs = 100) {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(fitAndEmit, delayMs)
    }

    // The initial fit has to wait on document.fonts.ready as well as layout:
    // "JetBrains Mono" loads asynchronously, and measuring before it swaps
    // in uses the fallback font's character width. The pty's COLUMNS would
    // then be set from that measurement permanently, while xterm visually
    // wraps at the real font's (different) width — the two disagree, which
    // is what caused character-overwrite corruption on long lines.
    const fontsReady = document.fonts?.ready ?? Promise.resolve()

    requestAnimationFrame(() => {
      if (disposed) return

      fontsReady.then(() => {
        if (disposed) return
        fitAddon.fit()

        const socket = io(window.location.origin, {
          auth: {
            token,
            sessionId,
            challengeIds: challengeIds || [],
            cols: terminal.cols,
            rows: terminal.rows,
          },
          transports: ['websocket'],
          timeout:    10_000,
        })

        socketRef.current = socket

        socket.on('connect', () => {
          terminal.write('\x1b[32m[ChainBreak] Connected\x1b[0m\r\n\r\n')
          onConnected?.()
        })

        socket.on('connect_error', (err) => {
          terminal.write(`\x1b[31m[Connection error] ${err.message}\x1b[0m\r\n`)
          onError?.(err.message)
        })

        socket.on('disconnect', (reason) => {
          terminal.write(`\r\n\x1b[33m[Disconnected: ${reason}]\x1b[0m\r\n`)
        })

        socket.on('terminal:output', (data) => {
          terminal.write(data)
        })

        socket.on('terminal:error', (msg) => {
          terminal.write(`\r\n\x1b[31m[Terminal error] ${msg}\x1b[0m\r\n`)
          onError?.(msg)
        })

        // No trailing \r\n on the last line: the server follows this event
        // with a prompt-redraw nudge sent through the pty (nudgePromptRedraw
        // in terminal.js), whose own echoed newline moves the cursor down.
        socket.on('flag:captured', (data) => {
          terminal.write(
            `\r\n\x1b[32m[+] Flag captured: ${data.flag}\x1b[0m\r\n` +
            `\x1b[32m[+] +${data.pointsAwarded} points — ${data.layer} layer\x1b[0m`
          )
          onFlagCaptured?.(data)
        })

        socket.on('flag:already_captured', (data) => {
          terminal.write(`\r\n\x1b[33m[!] ${data.flag} already captured\x1b[0m`)
        })

        scheduleFitAndEmit(300)
      })
    })

    const observer = new ResizeObserver(() => {
      scheduleFitAndEmit()
    })

    observer.observe(containerRef.current)

    return () => {
      disposed = true
      clearTimeout(resizeTimer)
      observer.disconnect()
      socketRef.current?.disconnect()
      terminal.dispose()
      termRef.current  = null
      socketRef.current = null
      fitRef.current   = null
    }
  }, [sessionId, token, JSON.stringify(challengeIds)])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ overflow: 'hidden' }}
    />
  )
}
