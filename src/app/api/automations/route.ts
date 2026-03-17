import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const automationActionSchema = z.object({
  type: z.string().min(1),
}).passthrough()

const jsonRecordSchema = z.record(z.string(), z.unknown())

const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(3000).optional(),
  trigger: z.string().min(1).max(120),
  triggerConfig: jsonRecordSchema.optional(),
  conditions: jsonRecordSchema.nullable().optional(),
  actions: z.array(automationActionSchema).min(1),
  isActive: z.boolean().optional(),
})

const updateAutomationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(3000).nullable().optional(),
  trigger: z.string().min(1).max(120).optional(),
  triggerConfig: jsonRecordSchema.nullable().optional(),
  conditions: jsonRecordSchema.nullable().optional(),
  actions: z.array(automationActionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-list', limit: 100, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const automations = await db.automation.findMany({
        where: { organizationId: context.organizationId },
        include: {
          logs: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ automations })
    })
  } catch (error) {
    console.error('Automations GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-create', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createAutomationSchema)
      if (!parsed.success) return parsed.response

      const automation = await db.automation.create({
        data: {
          organizationId: context.organizationId,
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          trigger: parsed.data.trigger.trim(),
          triggerConfig: parsed.data.triggerConfig ?? null,
          conditions: parsed.data.conditions ?? null,
          actions: parsed.data.actions,
          isActive: parsed.data.isActive ?? true,
        },
      })

      return NextResponse.json({ automation })
    })
  } catch (error) {
    console.error('Automations POST error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-update', limit: 80, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, updateAutomationSchema)
      if (!parsed.success) return parsed.response

      const { id, ...updates } = parsed.data
      const existing = await db.automation.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

      const automation = await db.automation.update({
        where: { id },
        data: {
          name: updates.name?.trim(),
          description: updates.description === undefined ? undefined : updates.description?.trim() || null,
          trigger: updates.trigger?.trim(),
          triggerConfig: updates.triggerConfig,
          conditions: updates.conditions,
          actions: updates.actions,
          isActive: updates.isActive,
        },
      })

      return NextResponse.json({ automation })
    })
  } catch (error) {
    console.error('Automations PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-delete', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const existing = await db.automation.findFirst({ where: { id, organizationId: context.organizationId } })
      if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

      await db.automation.delete({ where: { id } })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Automations DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
