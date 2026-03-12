import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const ORGANIZATION_ID = 'demo-org-1'
type Params = { params: Promise<{ id: string }> }
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const documents = await db.carrierDocument.findMany({
      where: { carrierId: id, organizationId: ORGANIZATION_ID },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Carrier documents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch carrier documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const name = String(formData.get('name') || '')
    const type = String(formData.get('type') || 'other')
    const description = String(formData.get('description') || '')
    const version = String(formData.get('version') || '')

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const now = Date.now()
    const relativeDir = path.join('uploads', 'carriers', id)
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir)
    await mkdir(absoluteDir, { recursive: true })

    const savedFileName = `${now}-${safeName}`
    const absolutePath = path.join(absoluteDir, savedFileName)
    await writeFile(absolutePath, buffer)

    const fileUrl = `/${relativeDir}/${savedFileName}`
    const extractedText = await extractCarrierText(file, buffer)
    const normalizedText = normalizeText(extractedText)

    const document = await db.carrierDocument.create({
      data: {
        organizationId: ORGANIZATION_ID,
        carrierId: id,
        type,
        name: name.trim() || file.name,
        description: description.trim() || null,
        fileUrl,
        fileType: file.type || null,
        fileSize: file.size || null,
        version: version.trim() || null,
        extractedText: normalizedText || null,
        indexedAt: normalizedText ? new Date() : null,
      },
    })

    let chunkCount = 0
    if (normalizedText) {
      const chunks = chunkText(normalizedText, CHUNK_SIZE, CHUNK_OVERLAP)
      chunkCount = chunks.length
      if (chunks.length > 0) {
        await db.carrierDocumentChunk.createMany({
          data: chunks.map((content, index) => ({
            organizationId: ORGANIZATION_ID,
            carrierDocumentId: document.id,
            chunkIndex: index,
            content,
            contentPreview: content.slice(0, 180),
            metadata: {
              charCount: content.length,
              sourceFileName: file.name,
            },
          })),
        })
      }
    }

    return NextResponse.json({
      document,
      indexing: {
        extracted: !!normalizedText,
        chunkCount,
      },
    })
  } catch (error) {
    console.error('Carrier documents POST error:', error)
    return NextResponse.json({ error: 'Failed to upload carrier document' }, { status: 500 })
  }
}

async function extractCarrierText(file: File, buffer: Buffer): Promise<string> {
  const fileName = file.name.toLowerCase()
  const fileType = (file.type || '').toLowerCase()

  if (
    fileType.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json')
  ) {
    return buffer.toString('utf8')
  }

  if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
    try {
      const pdfParseModule = await import('pdf-parse')
      const pdfParse = (pdfParseModule.default || pdfParseModule) as unknown as (input: Buffer) => Promise<{ text?: string }>
      const parsed = await pdfParse(buffer)
      return parsed.text || ''
    } catch (pdfError) {
      console.error('PDF extraction failed:', pdfError)
      return ''
    }
  }

  return ''
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize)
    const slice = text.slice(start, end).trim()
    if (slice) chunks.push(slice)

    if (end >= text.length) break
    start = Math.max(start + 1, end - overlap)
  }

  return chunks.slice(0, 200)
}
