import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/upload — List CSV upload history for the org.
 * POST /api/upload — Upload a CSV file, parse it, and bulk-import leads.
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

      const uploads = await db.cSVUpload.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return NextResponse.json({ uploads })
    })
  } catch (error) {
    console.error('Upload GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'csv-upload', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const source = String(formData.get('source') || 'csv_upload')
      const aiAutoScore = formData.get('aiAutoScore') === 'true'

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const fileName = file.name
      const fileSize = file.size
      const fileType = file.type || 'text/csv'

      if (!fileName.endsWith('.csv') && !fileType.includes('csv') && !fileType.includes('text')) {
        return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
      }

      if (fileSize > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
      }

      const csvUpload = await db.cSVUpload.create({
        data: {
          organizationId: context.organizationId,
          fileName,
          fileSize,
          fileType,
          status: 'processing',
          defaultSource: source,
        },
      })

      // Parse CSV
      const text = await file.text()
      const { rows, headers } = parseCSV(text)

      let successfulRows = 0
      let failedRows = 0
      let duplicateRows = 0
      const errors: { row: number; error: string }[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row || Object.values(row).every((v) => !v)) continue

        try {
          const firstName = getField(row, headers, ['firstname', 'first_name', 'first name', 'name']) || null
          const lastName = getField(row, headers, ['lastname', 'last_name', 'last name', 'surname']) || null
          const email = getField(row, headers, ['email', 'email address', 'emailaddress']) || null
          const phone = cleanPhone(getField(row, headers, ['phone', 'phone number', 'mobile', 'cell']) || '')
          const company = getField(row, headers, ['company', 'organization', 'employer', 'business']) || null
          const title = getField(row, headers, ['title', 'job title', 'jobtitle', 'position', 'role']) || null
          const website = getField(row, headers, ['website', 'url', 'web']) || null
          const linkedin = getField(row, headers, ['linkedin', 'linkedin url', 'profile']) || null
          const estimatedValueStr = getField(row, headers, ['value', 'estimated value', 'deal value', 'revenue'])
          const estimatedValue = estimatedValueStr ? parseFloat(estimatedValueStr.replace(/[^0-9.]/g, '')) : null
          const city = getField(row, headers, ['city']) || null
          const state = getField(row, headers, ['state', 'province']) || null
          const zip = getField(row, headers, ['zip', 'postal', 'postcode']) || null
          const country = getField(row, headers, ['country']) || null

          if (!email && !phone && !firstName && !lastName) {
            failedRows++
            errors.push({ row: i + 2, error: 'Row has no identifiable contact information' })
            continue
          }

          // Check for duplicate by email
          if (email) {
            const existing = await db.lead.findFirst({
              where: { organizationId: context.organizationId, email: email.toLowerCase() },
              select: { id: true },
            })
            if (existing) {
              duplicateRows++
              continue
            }
          }

          // Calculate a basic score
          let aiScore = 25
          if (email) aiScore += 10
          if (phone) aiScore += 9
          if (company) aiScore += 8
          if (title) {
            const tl = title.toLowerCase()
            if (['ceo', 'cfo', 'coo', 'vp', 'director', 'owner', 'founder'].some((t) => tl.includes(t))) {
              aiScore += 14
            } else {
              aiScore += 6
            }
          }
          if (estimatedValue) {
            if (estimatedValue > 100000) aiScore += 12
            else if (estimatedValue > 50000) aiScore += 9
            else if (estimatedValue > 10000) aiScore += 5
          }
          const sourceScore: Record<string, number> = { referral: 14, linkedin: 10, website: 8, google: 5, csv_upload: 2 }
          aiScore += sourceScore[source] || 2
          aiScore = Math.min(100, aiScore)

          await db.lead.create({
            data: {
              organizationId: context.organizationId,
              firstName: firstName ? firstName.trim() : null,
              lastName: lastName ? lastName.trim() : null,
              email: email ? email.toLowerCase().trim() : null,
              phone: phone || null,
              company: company ? company.trim() : null,
              title: title ? title.trim() : null,
              website: website ? website.trim() : null,
              linkedin: linkedin ? linkedin.trim() : null,
              city,
              state,
              zip,
              country,
              source,
              status: 'new',
              estimatedValue: isNaN(estimatedValue as number) ? null : (estimatedValue || null),
              aiScore: aiAutoScore ? aiScore : null,
              aiConfidence: aiAutoScore ? 0.7 : null,
              aiLastAnalyzed: aiAutoScore ? new Date() : null,
              aiNextAction: aiAutoScore
                ? aiScore >= 70
                  ? 'Send personalized outreach and propose 2 call slots'
                  : 'Move to nurture sequence with AI follow-up'
                : null,
              csvUploadId: csvUpload.id,
              rowNumber: i + 2,
            },
          })

          successfulRows++
        } catch (rowError) {
          failedRows++
          errors.push({ row: i + 2, error: rowError instanceof Error ? rowError.message : 'Unknown error' })
        }
      }

      const upload = await db.cSVUpload.update({
        where: { id: csvUpload.id },
        data: {
          status: failedRows === rows.length ? 'failed' : 'completed',
          totalRows: rows.length,
          processedRows: rows.length,
          successfulRows,
          failedRows,
          duplicateRows,
          errors: errors.length > 0 ? errors : null,
          aiAutoScored: aiAutoScore,
          completedAt: new Date(),
          columnMapping: { headers },
        },
      })

      return NextResponse.json({
        upload,
        message: `Successfully imported ${successfulRows} leads${duplicateRows > 0 ? ` (${duplicateRows} duplicates skipped)` : ''}${failedRows > 0 ? ` (${failedRows} failed)` : ''}`,
      })
    })
  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function parseCSV(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim())

  if (lines.length < 2) return { rows: [], headers: [] }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.every((v) => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return { rows, headers }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function getField(row: Record<string, string>, headers: string[], candidates: string[]): string {
  for (const candidate of candidates) {
    const key = headers.find((h) => h === candidate || h.replace(/\s+/g, '_') === candidate.replace(/\s+/g, '_'))
    if (key && row[key]) return row[key].trim()
  }
  return ''
}

function cleanPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 ? digits : ''
}
