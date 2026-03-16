import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const updateLeadSchema = z.object({
  firstName: z.string().max(120).nullable().optional(),
  lastName: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  linkedin: z.string().max(500).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(120).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  status: z.string().max(80).optional(),
  pipelineStage: z.string().max(80).nullable().optional(),
  estimatedValue: z.number().nullable().optional(),
  probability: z.number().min(0).max(100).optional(),
  assignedToId: z.string().nullable().optional(),
  aiNextAction: z.string().max(500).optional(),
  customFields: z.record(z.string(), z.unknown()).nullable().optional(),
  touch: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const { id } = await params
      const lead = await db.lead.findFirst({
        where: { id, organizationId: context.organizationId },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      return NextResponse.json({ lead })
    })
  } catch (error) {
    console.error('Lead GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, { key: 'leads-update', limit: 160, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
      const { id } = await params
      const parsed = await parseJsonBody(request, updateLeadSchema)
      if (!parsed.success) return parsed.response
      const body = parsed.data

      const lead = await db.lead.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

      const data: Record<string, unknown> = {}
      if (body.firstName !== undefined) data.firstName = body.firstName
      if (body.lastName !== undefined) data.lastName = body.lastName
      if (body.email !== undefined) data.email = body.email?.toLowerCase() ?? null
      if (body.phone !== undefined) data.phone = body.phone
      if (body.company !== undefined) data.company = body.company
      if (body.title !== undefined) data.title = body.title
      if (body.website !== undefined) data.website = body.website
      if (body.linkedin !== undefined) data.linkedin = body.linkedin
      if (body.address !== undefined) data.address = body.address
      if (body.city !== undefined) data.city = body.city
      if (body.state !== undefined) data.state = body.state
      if (body.zip !== undefined) data.zip = body.zip
      if (body.country !== undefined) data.country = body.country
      if (body.source !== undefined) data.source = body.source
      if (typeof body.status === 'string') data.status = body.status
      if (body.pipelineStage !== undefined) data.pipelineStage = body.pipelineStage
      if (body.estimatedValue !== undefined) data.estimatedValue = body.estimatedValue
      if (body.probability !== undefined) data.probability = body.probability
      if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId
      if (typeof body.aiNextAction === 'string') data.aiNextAction = body.aiNextAction
      if (body.customFields !== undefined) data.customFields = body.customFields ?? undefined
      if (body.touch) data.lastContactedAt = new Date()

      const updated = await db.lead.update({
        where: { id },
        data,
      })

      if (typeof body.status === 'string' && body.status !== lead.status) {
        await db.activity.create({
          data: {
            organizationId: context.organizationId,
            leadId: id,
            type: 'status_change',
            title: `Lead moved to ${body.status}`,
            description: `Status updated to ${body.status}`,
          },
        })
      }

      return NextResponse.json({ lead: updated })
    })
  } catch (error) {
    console.error('Lead PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, { key: 'leads-delete', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
      const { id } = await params
      const lead = await db.lead.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

      await db.lead.delete({ where: { id } })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Lead DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
