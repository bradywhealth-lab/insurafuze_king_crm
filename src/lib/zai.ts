type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ZaiClient = {
  chat: {
    completions: {
      create: (body: {
        model?: string
        messages: ChatMessage[]
        thinking?: { type: 'enabled' | 'disabled' }
      }) => Promise<unknown>
    }
  }
}

let zaiClientPromise: Promise<ZaiClient | null> | null = null

async function loadZaiClient(): Promise<ZaiClient | null> {
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    if (!ZAI || typeof ZAI.create !== 'function') return null
    return await ZAI.create()
  } catch (error) {
    console.error('ZAI client unavailable:', error)
    return null
  }
}

async function getZaiClient(): Promise<ZaiClient | null> {
  if (!zaiClientPromise) {
    zaiClientPromise = loadZaiClient()
  }
  return zaiClientPromise
}

function extractAssistantText(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null

  const candidate = result as {
    content?: unknown
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>
      }
    }>
  }

  if (typeof candidate.content === 'string' && candidate.content.trim()) {
    return candidate.content
  }

  const choiceContent = candidate.choices?.[0]?.message?.content
  if (typeof choiceContent === 'string' && choiceContent.trim()) {
    return choiceContent
  }

  if (Array.isArray(choiceContent)) {
    const combined = choiceContent
      .map((item) => (item && typeof item.text === 'string' ? item.text : ''))
      .join('\n')
      .trim()
    return combined || null
  }

  return null
}

export async function zaiChatJson(prompt: string, model = 'glm-4.5-air'): Promise<string | null> {
  const client = await getZaiClient()
  if (!client) return null

  try {
    const result = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'disabled' },
    })
    return extractAssistantText(result)
  } catch (error) {
    console.error('ZAI chat failed:', error)
    return null
  }
}

export async function zaiChatMessages(
  messages: ChatMessage[],
  model = 'glm-4.5-air'
): Promise<string | null> {
  const client = await getZaiClient()
  if (!client) return null

  try {
    const result = await client.chat.completions.create({
      model,
      messages,
      thinking: { type: 'disabled' },
    })
    return extractAssistantText(result)
  } catch (error) {
    console.error('ZAI chat failed:', error)
    return null
  }
}
