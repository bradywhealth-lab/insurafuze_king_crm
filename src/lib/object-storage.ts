import { createClient } from '@supabase/supabase-js'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), '.local-object-storage')
const LOCAL_STORAGE_PREFIX = 'local://'

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function getStorageClient() {
  const supabaseUrl = getOptionalEnv('SUPABASE_URL')
  const serviceRoleKey = getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return null
  if (!/^https?:\/\//i.test(supabaseUrl)) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function toLocalStoragePath(storagePath: string): string {
  const trimmed = storagePath.startsWith(LOCAL_STORAGE_PREFIX)
    ? storagePath.slice(LOCAL_STORAGE_PREFIX.length)
    : storagePath
  return path.join(LOCAL_STORAGE_ROOT, trimmed)
}

async function uploadToLocalStorage(input: {
  organizationId: string
  carrierId: string
  originalFileName: string
  buffer: Buffer
}): Promise<{ fileUrl: string; storagePath: string }> {
  const safeFileName = input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const relativePath = path.join(
    'carriers',
    input.organizationId,
    input.carrierId,
    `${Date.now()}-${safeFileName}`,
  )
  const filePath = path.join(LOCAL_STORAGE_ROOT, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, input.buffer)

  const storagePath = `${LOCAL_STORAGE_PREFIX}${relativePath}`
  return {
    fileUrl: storagePath,
    storagePath,
  }
}

export async function uploadToObjectStorage(input: {
  organizationId: string
  carrierId: string
  originalFileName: string
  contentType: string
  buffer: Buffer
}): Promise<{ fileUrl: string; storagePath: string }> {
  const bucket = getOptionalEnv('SUPABASE_STORAGE_BUCKET')
  const client = getStorageClient()
  if (bucket && client) {
    const safeFileName = input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `carriers/${input.organizationId}/${input.carrierId}/${Date.now()}-${safeFileName}`

    try {
      const uploadResult = await client.storage.from(bucket).upload(storagePath, input.buffer, {
        contentType: input.contentType || 'application/octet-stream',
        upsert: false,
      })

      if (uploadResult.error) {
        throw new Error(`Object storage upload failed: ${uploadResult.error.message}`)
      }

      const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
      if (!data?.publicUrl) {
        throw new Error('Object storage upload succeeded but no public URL was returned')
      }

      return {
        fileUrl: data.publicUrl,
        storagePath,
      }
    } catch (error) {
      console.warn('Object storage upload failed, falling back to local storage:', error)
    }
  }

  return uploadToLocalStorage({
    organizationId: input.organizationId,
    carrierId: input.carrierId,
    originalFileName: input.originalFileName,
    buffer: input.buffer,
  })
}

export async function deleteFromObjectStorage(storagePath: string): Promise<void> {
  if (storagePath.startsWith(LOCAL_STORAGE_PREFIX)) {
    try {
      await unlink(toLocalStoragePath(storagePath))
    } catch {
      // Best-effort cleanup for local fallback files.
    }
    return
  }

  const bucket = getOptionalEnv('SUPABASE_STORAGE_BUCKET')
  const client = getStorageClient()
  if (!bucket || !client) return

  const removeResult = await client.storage.from(bucket).remove([storagePath])
  if (removeResult.error) {
    throw new Error(`Object storage delete failed: ${removeResult.error.message}`)
  }
}
