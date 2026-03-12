import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ORGANIZATION_ID = 'demo-org-1'

type PlaybookResponse = {
  recommendedCarrier: {
    id: string | null
    name: string
    rationale: string
    confidence: number
  }
  backupCarriers: Array<{
    id: string | null
    name: string
    rationale: string
  }>
  suggestedPlanType: string
  qualificationSummary: string[]
  objectionHandling: string[]
  followUpScripts: {
    callOpening: string
    sms: string
    emailSubject: string
    emailBody: string
  }
  nextActions: string[]
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function fallbackPlaybook(lead: {
  id: string
  firstName: string | null
  lastName: string | null
  status: string
  aiScore: number
  company: string | null
  title: string | null
  source: string | null
  aiNextAction: string | null
}, carriers: Array<{ id: string; name: string }>): PlaybookResponse {
  const primary = carriers[0]
  const backup = carriers.slice(1, 3)
  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'this lead'
  const scoreBand = lead.aiScore >= 85 ? 'high-intent' : lead.aiScore >= 65 ? 'mid-intent' : 'early-intent'

  return {
    recommendedCarrier: {
      id: primary?.id || null,
      name: primary?.name || 'General Carrier Match',
      rationale: `Best available match from current carrier library for a ${scoreBand} profile based on lead status, role, and available underwriting docs.`,
      confidence: Math.max(0.55, Math.min(0.9, 0.55 + lead.aiScore / 200)),
    },
    backupCarriers: backup.map((c) => ({
      id: c.id,
      name: c.name,
      rationale: 'Keep as fallback if underwriting fit or pricing alignment is stronger during discovery.',
    })),
    suggestedPlanType: 'Life + health protection bundle (to be finalized after underwriting Q&A)',
    qualificationSummary: [
      `Lead status: ${lead.status}`,
      `AI score: ${lead.aiScore}`,
      lead.company ? `Company context: ${lead.company}` : 'Company context pending',
      lead.title ? `Role context: ${lead.title}` : 'Role context pending',
      lead.source ? `Lead source: ${lead.source}` : 'Lead source unknown',
    ],
    objectionHandling: [
      'Price concern: compare total protection value and long-term cost of waiting.',
      'Need to think about it: book a firm follow-up and summarize key risk gaps now.',
      'Already have coverage: position this as a coverage-gap review, not a replacement pitch.',
    ],
    followUpScripts: {
      callOpening: `Hey ${lead.firstName || 'there'}, this is your broker following up with a quick strategy based on your profile. I found a carrier-plan fit that may reduce risk exposure while keeping underwriting realistic. Can I take 2 minutes to walk you through it?`,
      sms: `Hi ${lead.firstName || ''}, quick update: I mapped your profile to a strong carrier option and a backup plan if underwriting shifts. Want me to send the summary before our call?`,
      emailSubject: `Your tailored coverage strategy options`,
      emailBody: `Hi ${fullName},\n\nI reviewed your profile and prepared a recommended carrier strategy plus backup options based on qualification signals and underwriting fit.\n\nIf helpful, I can walk you through the recommended route and why it is likely to be the best match.\n\nBest,\nYour Broker`,
    },
    nextActions: [
      'Run underwriting checklist questions and update lead notes.',
      'Send SMS summary and request preferred call slot.',
      lead.aiNextAction || 'Execute the next best follow-up in CRM.',
    ],
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { leadId, extraContext = '' } = body as { leadId?: string; extraContext?: string }

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId: ORGANIZATION_ID },
      include: {
        notes: {
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const carriers = await db.carrier.findMany({
      where: { organizationId: ORGANIZATION_ID },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    })

    if (carriers.length === 0) {
      return NextResponse.json({
        error: 'No carriers configured yet. Add carriers and underwriting documents first.',
      }, { status: 400 })
    }

    const compactLead = {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      source: lead.source,
      status: lead.status,
      aiScore: lead.aiScore,
      aiNextAction: lead.aiNextAction,
      estimatedValue: lead.estimatedValue,
      customFields: lead.customFields,
      aiInsights: lead.aiInsights,
      notes: lead.notes.map((n) => n.content).slice(0, 8),
      activities: lead.activities.map((a) => ({
        type: a.type,
        title: a.title,
        description: a.description,
      })),
    }

    const compactCarriers = carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.name,
      website: carrier.website,
      notes: carrier.notes,
      documents: carrier.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        name: doc.name,
        description: doc.description,
        version: doc.version,
      })),
    }))

    const prompt = `You are an elite life and health insurance broker assistant.
Given lead qualification context plus carrier underwriting materials metadata, return:
1) best carrier recommendation
2) backup carriers
3) suggested plan type
4) qualification summary bullets
5) objection handling bullets
6) personalized follow-up scripts (call opening, SMS, email subject/body)
7) immediate next actions

Lead context:
${JSON.stringify(compactLead)}

Carrier library context:
${JSON.stringify(compactCarriers)}

Additional broker context:
${extraContext || 'N/A'}

Respond as strict JSON only using this schema:
{
  "recommendedCarrier": { "id": "string|null", "name": "string", "rationale": "string", "confidence": 0.0 },
  "backupCarriers": [{ "id": "string|null", "name": "string", "rationale": "string" }],
  "suggestedPlanType": "string",
  "qualificationSummary": ["string"],
  "objectionHandling": ["string"],
  "followUpScripts": {
    "callOpening": "string",
    "sms": "string",
    "emailSubject": "string",
    "emailBody": "string"
  },
  "nextActions": ["string"]
}`

    try {
      const { LLM } = await import('z-ai-web-dev-sdk')
      const result = await LLM.chat({
        messages: [{ role: 'user', content: prompt }],
        model: 'claude-3-5-sonnet-20241022',
      })
      const content = typeof result.content === 'string' ? result.content : ''
      const jsonCandidate = content.match(/\{[\s\S]*\}/)?.[0] || ''
      const parsed = safeJsonParse<PlaybookResponse>(jsonCandidate)

      if (parsed && parsed.recommendedCarrier?.name && parsed.followUpScripts?.sms) {
        return NextResponse.json({ playbook: parsed, source: 'llm' })
      }
    } catch (error) {
      console.error('Carrier playbook LLM fallback triggered:', error)
    }

    const fallback = fallbackPlaybook(
      {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        status: lead.status,
        aiScore: lead.aiScore,
        company: lead.company,
        title: lead.title,
        source: lead.source,
        aiNextAction: lead.aiNextAction,
      },
      carriers.map((c) => ({ id: c.id, name: c.name }))
    )
    return NextResponse.json({ playbook: fallback, source: 'fallback' })
  } catch (error) {
    console.error('Carrier playbook error:', error)
    return NextResponse.json({ error: 'Failed to generate carrier playbook' }, { status: 500 })
  }
}
