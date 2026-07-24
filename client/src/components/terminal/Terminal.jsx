import { useEffect, useRef, useCallback } from 'react'
import { io }        from 'socket.io-client'
import { Terminal }  from '@xterm/xterm'
import { FitAddon }  from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPane({
  sessionId,
  challengeIds,   // array of all challenge IDs in the module
  token,
  onFlagCaptured, // ({ flag, layer, challengeId, pointsAwarded }) => void
  onConnected,    // () => void
  onError,        // (message) => void
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

    // ── 1. Create terminal ────────────────────────────────────────────────
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

    // ── 2. Keystroke forwarding ─────────────────────────────────────────────
    // Registered now, but reads socketRef (populated below, once fit settles)
    // — a keystroke landing before the socket connects isn't realistically
    // possible.
    terminal.onData((data) => {
      socketRef.current?.emit('terminal:input', data)
    })

    let disposed     = false
    let resizeTimer   = null

    // Single source of truth for "measure + tell the backend": every trigger
    // below (initial connect, the delayed post-fonts correction, and live
    // resizes) funnels through this, so the emitted cols/rows always come
    // straight from FitAddon's own measurement — never a separate constant.
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

    // The INITIAL fit — which drives the socket handshake that sets the
    // pty's starting cols/rows — has to wait for two things, not one:
    //  (a) layout: a bare requestAnimationFrame after mount, so the
    //      container has real, non-zero dimensions to measure.
    //  (b) FONTS: "JetBrains Mono" loads asynchronously (Google Fonts
    //      @import in index.css). Measuring before it's swapped in uses the
    //      FALLBACK font's character width — fit() computes a cols count
    //      that's accurate for what's on screen AT THAT INSTANT but wrong
    //      for what renders moments later once the real font swaps in. The
    //      reported `stty size` then reflects the fallback-font measurement
    //      forever after, while xterm visually wraps at wherever the REAL
    //      font's (different) character width actually lands — bash's own
    //      line-editing cursor math (driven by the pty's COLUMNS) and
    //      xterm's actual wrap point disagree, which is exactly the
    //      character-overwrite corruption on long lines. Short lines never
    //      reach the mismatched column, so they always looked fine — which
    //      is why this was so precisely reproducible.
    // document.fonts.ready resolves once every requested font has settled
    // (success OR fallback), so waiting on it is always safe.
    const fontsReady = document.fonts?.ready ?? Promise.resolve()

    requestAnimationFrame(() => {
      if (disposed) return

      fontsReady.then(() => {
        if (disposed) return
        fitAddon.fit()

        // ── 3. Connect Socket.io — now carrying the REAL fitted size ───────
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

        // ── 4. Socket events ──────────────────────────────────────────────
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

        // No trailing \r\n after the last line here (or below): the server
        // follows this event with a prompt-redraw nudge sent straight
        // through the pty (see nudgePromptRedraw in terminal.js) — its own
        // echoed newline is what moves the cursor down before the prompt
        // reappears. Adding our own trailing newline here too would leave a
        // blank line between the message and the prompt.
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

        // Belt-and-suspenders: re-measure once more shortly after connect,
        // in case the browser hadn't fully committed the font-swap reflow
        // right at the fonts.ready/first-paint boundary.
        scheduleFitAndEmit(300)
      })
    })

    // ── 5. Resize observer ────────────────────────────────────────────────
    // Every resize AFTER the initial one above (window resize, pane drag,
    // etc.) — debounced so a continuous drag doesn't spam the backend.
    const observer = new ResizeObserver(() => {
      scheduleFitAndEmit()
    })

    observer.observe(containerRef.current)

    // ── 6. Cleanup ────────────────────────────────────────────────────────
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
