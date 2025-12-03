import { NextResponse } from 'next/server'
import { metricsSnapshot } from '../telemetry'

export async function GET() {
  return NextResponse.json(metricsSnapshot())
}
