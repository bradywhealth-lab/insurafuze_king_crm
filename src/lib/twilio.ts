import { createHmac } from 'node:crypto'
import { db } from '@/lib/db'

export type TwilioConfig = {
  accountSid: string
  authToken: string
  fromPhone: string
}

type TwilioMessageResult = {
  sid: string
  status: string
  from: string
  to: string
}

export async function getTwilioConfigForOrganization(organizationId: string): Promise<TwilioConfig | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: 'twilio',
      },
    },
  })

  const config = integration?.config
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null

  const accountSid = typeof config.accountSid === 'string' ? config.accountSid.trim() : ''
  const authToken = typeof config.authToken === 'string' ? config.authToken.trim() : ''
  const fromPhone = typeof config.fromPhone === 'string' ? config.fromPhone.trim() : ''

  if (!accountSid || !authToken || !fromPhone || integration?.isActive === false) return null

  return {
    accountSid,
    authToken,
    fromPhone,
  }
}

export async function sendTwilioSms({
  config,
  to,
  body,
  mediaUrl,
  statusCallbackUrl,
}: {
  config: TwilioConfig
  to: string
  body: string
  mediaUrl?: string
  statusCallbackUrl?: string
}): Promise<TwilioMessageResult> {
  const params = new URLSearchParams()
  params.set('To', to)
  params.set('From', config.fromPhone)
  params.set('Body', body)
  if (mediaUrl) params.set('MediaUrl', mediaUrl)
  if (statusCallbackUrl) params.set('StatusCallback', statusCallbackUrl)

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data.message === 'string'
        ? data.message
        : `Twilio request failed with status ${response.status}`
    throw new Error(message)
  }

  return {
    sid: typeof data.sid === 'string' ? data.sid : '',
    status: typeof data.status === 'string' ? data.status : 'queued',
    from: typeof data.from === 'string' ? data.from : config.fromPhone,
    to: typeof data.to === 'string' ? data.to : to,
  }
}

export function normalizePhone(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '')
}

export function buildTwilioStatusCallbackUrl({
  appBaseUrl,
  organizationId,
  messageId,
  threadId,
}: {
  appBaseUrl: string | undefined
  organizationId: string
  messageId: string
  threadId: string
}) {
  if (!appBaseUrl) return null
  const base = appBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({ messageId, threadId })
  return `${base}/api/webhooks/twilio/${organizationId}?${params.toString()}`
}

export function verifyTwilioSignature({
  authToken,
  url,
  params,
  signature,
}: {
  authToken: string
  url: string
  params: URLSearchParams
  signature: string | null
}) {
  if (!signature) return false

  const sortedEntries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const payload = sortedEntries.reduce((acc, [key, value]) => acc + key + value, url)
  const expected = createHmac('sha1', authToken).update(payload).digest('base64')

  return signature === expected
}

export function redactTwilioConfig(config: Record<string, unknown> | null) {
  if (!config) return null
  return {
    accountSid: typeof config.accountSid === 'string' ? config.accountSid : '',
    fromPhone: typeof config.fromPhone === 'string' ? config.fromPhone : '',
    hasAuthToken: typeof config.authToken === 'string' && config.authToken.length > 0,
  }
}
