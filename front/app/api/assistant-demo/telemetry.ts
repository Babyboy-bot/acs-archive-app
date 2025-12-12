export type AssistantIntent = 'documents' | 'statistiques'

export type AssistantMetrics = {
  startedAt: number
  totalRequests: number
  documentsRequests: number
  statistiquesRequests: number
  errors: number
  llmSuccess: number
  llmFallback: number
}

const assistantMetrics: AssistantMetrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  documentsRequests: 0,
  statistiquesRequests: 0,
  errors: 0,
  llmSuccess: 0,
  llmFallback: 0,
}

export type AssistantLogEvent =
  | {
      type: 'request'
      intent: AssistantIntent
      questionLength: number
    }
  | {
      type: 'response'
      intent: AssistantIntent
      durationMs: number
      pieces?: number
      llmUsed: boolean
    }
  | {
      type: 'error'
      intent?: AssistantIntent
      durationMs: number
      message: string
      status?: number
    }
  | {
      type: 'security'
      intent?: AssistantIntent
      riskLevel: 'low' | 'medium' | 'high'
      flags: { promptInjectionSuspect?: boolean; piiSuspect?: boolean }
      message?: string
    }

export function incrementRequest(intent: AssistantIntent) {
  assistantMetrics.totalRequests += 1
  if (intent === 'documents') {
    assistantMetrics.documentsRequests += 1
  } else {
    assistantMetrics.statistiquesRequests += 1
  }
}

export function incrementLlmSuccess() {
  assistantMetrics.llmSuccess += 1
}

export function incrementLlmFallback() {
  assistantMetrics.llmFallback += 1
}

export function incrementErrors() {
  assistantMetrics.errors += 1
}

export function metricsSnapshot(): AssistantMetrics & { uptimeSeconds: number } {
  const uptimeSeconds = Math.round((Date.now() - assistantMetrics.startedAt) / 1000)
  return { ...assistantMetrics, uptimeSeconds }
}

export function journaliserAssistant(event: AssistantLogEvent) {
  const payload = {
    event,
    metrics: metricsSnapshot(),
    timestamp: new Date().toISOString(),
  }
  console.info('assistant-telemetry', JSON.stringify(payload))
}
