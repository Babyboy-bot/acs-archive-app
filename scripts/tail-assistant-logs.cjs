#!/usr/bin/env node
/*
 * Parse `assistant-telemetry` lines from stdin and display them in a compact table.
 * Usage examples:
 *   npm run dev | npm run logs:assistant
 *   node ./scripts/tail-assistant-logs.cjs < server.log
 */

const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
})

function formatDuration(ms) {
  if (Number.isNaN(ms)) return '–'
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

rl.on('line', (line) => {
  if (!line.includes('assistant-telemetry')) return

  const start = line.indexOf('{')
  if (start === -1) {
    console.log(line)
    return
  }

  try {
    const payload = JSON.parse(line.slice(start))
    const { event, metrics, timestamp } = payload
    const time = new Date(timestamp ?? Date.now()).toISOString()

    if (event.type === 'request') {
      console.log(
        `${time} ▶️  intent=${event.intent} len=${event.questionLength} total=${metrics.totalRequests} uptime=${metrics.uptimeSeconds}s`
      )
      return
    }

    if (event.type === 'response') {
      console.log(
        `${time} ✅ intent=${event.intent} duration=${formatDuration(event.durationMs)} pieces=${event.pieces ?? '–'} llm=${event.llmUsed}`
      )
      return
    }

    if (event.type === 'error') {
      console.warn(
        `${time} ❌ intent=${event.intent ?? 'n/a'} status=${event.status ?? 'n/a'} message="${event.message}"`
      )
      return
    }

    console.log(`${time} ${JSON.stringify(event)}`)
  } catch (error) {
    console.error('assistant-logs parser error', error)
    console.log(line)
  }
})
