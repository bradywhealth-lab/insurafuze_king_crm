import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isInternalRunnerAuthorized } from '@/lib/internal-runner'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'

const runAutomationsSchema = z.object({
  trigger: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  triggeredBy: z.string().min(1).optional(),
})

type JsonRecord = Record<string, unknown>

function evaluateConditions(conditions: JsonRecord | null | undefined, input: JsonRecord) {
  if (!conditions || Object.keys(conditions).length === 0) return true

  for (const [key, condition] of Object.entries(conditions)) {
    const value = input[key]
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const ops = condition as JsonRecord
      if (typeof ops.equals !== 'undefined' && value !== ops.equals) return false
      if (typeof ops.gte !== 'undefined' && typeof value === 'number' && value < Number(ops.gte)) return false
      if (typeof ops.gte !== 'undefined' && typeof value !== 'number') return false
      if (typeof ops.lte !== 'undefined' && typeof value === 'number' && value > Number(ops.lte)) return false
      if (typeof ops.lte !== 'undefined' && typeof value !== 'number') return false
      if (typeof ops.contains !== 'undefined') {
        if (typeof value !== 'string' || !value.includes(String(ops.contains))) return false
      }
      continue
    }

    if (value !== condition) return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automation-runner', limit: 40, windowMs: 60_000 })
    if (limited) return limited

    if (!isInternalRunnerAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized runner request' }, { status: 401 })
    }

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, runAutomationsSchema)
      if (!parsed.success) return parsed.response

      const payload = parsed.data
      const input = payload.input ?? {}
      const where = {
        organizationId: context.organizationId,
        isActive: true,
        ...(payload.trigger ? { trigger: payload.trigger.trim() } : {}),
      }

      const dueAutomations = await db.automation.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 100,
      })

      let processed = 0
      let succeeded = 0
      let failed = 0

      for (const automation of dueAutomations) {
        const startedAt = Date.now()
        let success = false
        let errorMessage: string | null = null
        let output: JsonRecord = {}

        try {
          const matched = evaluateConditions((automation.conditions as JsonRecord | null) ?? null, input)
          if (!matched) {
            output = { skipped: true, reason: 'conditions_not_matched' }
          } else {
            // Placeholder executor: records intended action execution for now.
            const actions = Array.isArray(automation.actions) ? automation.actions : []
            output = { executedActions: actions.length, actions }

            await db.automation.update({
              where: { id: automation.id },
              data: {
                executionCount: { increment: 1 },
                lastExecutedAt: new Date(),
              },
            })
            success = true
            succeeded++
          }
        } catch (error) {
          success = false
          failed++
          errorMessage = error instanceof Error ? error.message : 'Unknown automation execution error'
        }

        const duration = Date.now() - startedAt
        await db.automationLog.create({
          data: {
            automationId: automation.id,
            triggeredBy: payload.triggeredBy ?? 'system',
            entityType: payload.entityType ?? null,
            entityId: payload.entityId ?? null,
            input,
            output,
            success,
            duration,
            error: errorMessage,
          },
        })

        processed++
      }

      return NextResponse.json({ processed, succeeded, failed, totalDue: dueAutomations.length })
    })
  } catch (error) {
    console.error('Automation runner error:', error)
    return NextResponse.json({ error: 'Failed to execute automations' }, { status: 500 })
  }
}
