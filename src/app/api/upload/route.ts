import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000

type LeadDraft = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  source?: string
  estimatedValue?: number
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  fields.push(current.trim())
  return fields
}

function parseCsvText(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map(parseCsvLine).slice(0, MAX_ROWS)
  return { headers, rows }
}

function mapColumns(headers: string[]): Record<string, number> {
  const aliases: Record<string, string[]> = {
    firstName: ['firstname', 'first', 'givenname'],
    lastName: ['lastname', 'last', 'surname', 'familyname'],
    email: ['email', 'emailaddress'],
    phone: ['phone', 'phonenumber', 'mobile', 'cell'],
    company: ['company', 'companyname', 'business'],
    title: ['title', 'jobtitle', 'role', 'position'],
    source: ['source', 'leadsource'],
    estimatedValue: ['estimatedvalue', 'value', 'dealvalue', 'amount'],
  }

  const normalizedHeaders = headers.map(normalizeHeader)
  const mapping: Record<string, number> = {}

  for (const [field, candidates] of Object.entries(aliases)) {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header))
    if (index >= 0) mapping[field] = index
  }

  return mapping
}

function extractLeadDraft(
  row: string[],
  mapping: Record<string, number>,
  defaultSource: string,
): LeadDraft {
  const read = (key: string) => {
    const idx = mapping[key]
    if (idx === undefined || idx >= row.length) return ''
    return (row[idx] || '').trim()
  }

  const firstName = read('firstName')
  const lastName = read('lastName')
  const email = read('email').toLowerCase()
  const phone = normalizePhone(read('phone'))
  const company = read('company')
  const title = read('title')
  const source = read('source') || defaultSource
  const estimatedRaw = read('estimatedValue')
  const estimatedValue = estimatedRaw ? Number.parseFloat(estimatedRaw.replace(/[$,]/g, '')) : undefined

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email: email || undefined,
    phone: phone || undefined,
    company: company || undefined,
    title: title || undefined,
    source: source || undefined,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const requested = Number.parseInt(searchParams.get('limit') || '100', 10)
      const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 100

      const uploads = await db.cSVUpload.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return NextResponse.json({ uploads })
    })
  } catch (error) {
    console.error('Upload GET error:', error)
    return NextResponse.json({ error: 'Failed to load CSV uploads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'csv-upload', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const formData = await request.formData()
      const file = formData.get('file')
      const source = String(formData.get('source') || 'csv_upload').trim() || 'csv_upload'
      const aiAutoScored = String(formData.get('aiAutoScore') || 'false').toLowerCase() === 'true'

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
      }

      if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'CSV must be between 1B and 10MB' }, { status: 400 })
      }

      const csvText = await file.text()
      const { headers, rows } = parseCsvText(csvText)
      if (headers.length === 0 || rows.length === 0) {
        return NextResponse.json({ error: 'CSV must include a header row and at least one data row' }, { status: 400 })
      }

      const mapping = mapColumns(headers)
      const upload = await db.cSVUpload.create({
        data: {
          organizationId: context.organizationId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'text/csv',
          status: 'processing',
          totalRows: rows.length,
          processedRows: 0,
          successfulRows: 0,
          failedRows: 0,
          duplicateRows: 0,
          defaultSource: source,
          aiAutoScored,
          columnMapping: {
            headers,
            mappedFields: mapping,
          } as Prisma.InputJsonValue,
        },
      })

      const errors: Array<{ row: number; message: string }> = []
      const warnings: Array<{ row: number; message: string }> = []
      let successfulRows = 0
      let failedRows = 0
      let duplicateRows = 0

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2
        const draft = extractLeadDraft(rows[i], mapping, source)
        const hasIdentity = Boolean(draft.email || draft.phone || draft.firstName || draft.lastName)

        if (!hasIdentity) {
          failedRows++
          errors.push({ row: rowNumber, message: 'Row is empty or missing lead identity fields' })
          continue
        }

        if (draft.email && !looksLikeEmail(draft.email)) {
          failedRows++
          errors.push({ row: rowNumber, message: `Invalid email format: ${draft.email}` })
          continue
        }

        const duplicate = await db.lead.findFirst({
          where: {
            organizationId: context.organizationId,
            OR: [
              ...(draft.email ? [{ email: draft.email }] : []),
              ...(draft.phone ? [{ phone: draft.phone }] : []),
            ],
          },
          select: { id: true },
        })

        if (duplicate) {
          duplicateRows++
          warnings.push({ row: rowNumber, message: 'Skipped duplicate lead (matched by email or phone)' })
          continue
        }

        await db.lead.create({
          data: {
            organizationId: context.organizationId,
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            phone: draft.phone,
            company: draft.company,
            title: draft.title,
            source: draft.source || source,
            status: 'new',
            estimatedValue: draft.estimatedValue,
            csvUploadId: upload.id,
            rowNumber,
            aiScore: aiAutoScored ? 50 : 0,
            aiConfidence: aiAutoScored ? 0.6 : null,
            aiLastAnalyzed: aiAutoScored ? new Date() : null,
          },
        })

        successfulRows++
      }

      const processedRows = successfulRows + failedRows + duplicateRows
      const status = failedRows > 0 && successfulRows === 0 ? 'failed' : 'completed'

      const completed = await db.cSVUpload.update({
        where: { id: upload.id },
        data: {
          status,
          processedRows,
          successfulRows,
          failedRows,
          duplicateRows,
          errors: errors as unknown as Prisma.InputJsonValue,
          warnings: warnings as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        upload: completed,
        message: `Processed ${processedRows} rows: ${successfulRows} imported, ${duplicateRows} duplicates, ${failedRows} failed`,
      })
    })
  } catch (error) {
    console.error('Upload POST error:', error)
    return NextResponse.json({ error: 'Failed to process CSV upload' }, { status: 500 })
  }
}
