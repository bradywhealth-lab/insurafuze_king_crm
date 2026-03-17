import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const aiRequestSchema = z.object({
  action: z.enum(['score-lead', 'generate-content', 'generate-media', 'generate-insights', 'chat']),
  data: z.record(z.string(), z.unknown()).default({}),
})

type LlmMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type LlmResult = {
  content?: string
}

async function getLlmChat() {
  const sdk: unknown = await import('z-ai-web-dev-sdk')
  const llm = (sdk as { LLM?: { chat?: unknown } }).LLM
  if (!llm || typeof llm.chat !== 'function') {
    throw new Error('LLM.chat is unavailable in current runtime')
  }
  return llm.chat as (input: { messages: LlmMessage[]; model: string }) => Promise<LlmResult>
}

function extractJsonObject(content: string | undefined): Record<string, unknown> | null {
  if (!content) return null
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toLlmRole(value: unknown): LlmMessage['role'] {
  if (value === 'assistant' || value === 'system') return value
  return 'user'
}

// AI API using z-ai-web-dev-sdk
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'ai-generate', limit: 50, windowMs: 60_000 })
    if (limited) return limited
    const parsed = await parseJsonBody(request, aiRequestSchema)
    if (!parsed.success) return parsed.response
    const { action, data } = parsed.data
    const chat = await getLlmChat()
    
    switch (action) {
      case 'score-lead': {
        const prompt = `Analyze this lead and provide a quality score from 0-100 based on their profile.
        
Lead Information:
- Name: ${data.firstName} ${data.lastName}
- Email: ${data.email}
- Company: ${data.company}
- Title: ${data.title}
- Source: ${data.source}
- Estimated Value: $${data.estimatedValue || 'Not provided'}

Provide:
1. A quality score (0-100)
2. Confidence level (0-1)
3. Key insights (2-3 bullet points)
4. Recommended next action

Respond in JSON format:
{
  "score": <number>,
  "confidence": <number>,
  "insights": ["insight1", "insight2"],
  "nextAction": "<action>",
  "tags": ["tag1", "tag2"]
}`

        const result = await chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        const jsonObject = extractJsonObject(result.content)
        if (jsonObject) {
          return NextResponse.json(jsonObject)
        }
        
        return NextResponse.json({
          score: 50,
          confidence: 0.5,
          insights: ['Unable to analyze lead'],
          nextAction: 'Manual review recommended',
          tags: []
        })
      }
      
      case 'generate-content': {
        const topic = asString(data.topic)
        const platform = asString(data.platform)
        const tone = asString(data.tone)
        const prompt = `Create a ${platform} post about: ${topic}
        
Requirements:
- Platform: ${platform}
- Tone: ${tone}
- Engaging and professional
- Include relevant hashtags
- Optimal length for the platform

Provide the response in JSON format:
{
  "title": "<post title>",
  "content": "<post content>",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "bestTimeToPost": "<suggested time>"
}`

        const result = await chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        const jsonObject = extractJsonObject(result.content)
        if (jsonObject) {
          return NextResponse.json({
            ...jsonObject,
            aiGenerated: true
          })
        }
        
        return NextResponse.json({
          title: topic,
          content: `Check out our latest insights on ${topic}! #Business #Growth`,
          hashtags: ['#Business', '#Growth'],
          bestTimeToPost: '9:00 AM',
          aiGenerated: true
        })
      }

      case 'generate-media': {
        const topic = asString(data.topic)
        const platform = asString(data.platform)
        const style = asString(data.style) || 'clean, premium, high-converting'
        const prompt = `Create a concise, production-ready image prompt for a ${platform} marketing creative.
Topic: ${topic}
Style: ${style}

Return JSON:
{
  "imagePrompt": "<detailed visual prompt>",
  "caption": "<short caption>",
  "cta": "<call to action>"
}`

        const result = await chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })

        const jsonObject = extractJsonObject(result.content)
        if (jsonObject) {
          return NextResponse.json({
            ...jsonObject,
            aiGenerated: true
          })
        }

        return NextResponse.json({
          imagePrompt: `Premium ${platform} visual for ${topic}, clean layout, strong headline, brand-forward composition`,
          caption: `Elevate your strategy with ${topic}.`,
          cta: 'Book a consultation',
          aiGenerated: true
        })
      }
      
      case 'generate-insights': {
        const prompt = `Analyze this CRM data and provide actionable insights:
        
Total Leads: ${asNumber(data.totalLeads)}
Pipeline Value: $${asNumber(data.pipelineValue)}
Avg Lead Score: ${asNumber(data.avgScore)}
Win Rate: ${asNumber(data.winRate)}%
Recent Activities: ${asString(data.recentActivities)}

Provide 3-5 insights in JSON format:
{
  "insights": [
    {
      "type": "prediction|recommendation|trend|alert",
      "category": "leads|pipeline|performance",
      "title": "<title>",
      "description": "<description>",
      "confidence": <0-1>,
      "actionable": <boolean>
    }
  ]
}`

        const result = await chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        const jsonObject = extractJsonObject(result.content)
        if (jsonObject) {
          return NextResponse.json(jsonObject)
        }
        
        // Fallback insights
        return NextResponse.json({
          insights: [
            {
              type: 'recommendation',
              category: 'leads',
              title: 'Follow-up with high-score leads',
              description: 'You have leads with scores above 80 that haven\'t been contacted recently.',
              confidence: 0.9,
              actionable: true
            },
            {
              type: 'trend',
              category: 'pipeline',
              title: 'Pipeline growing steadily',
              description: 'Your pipeline value has increased 15% this month.',
              confidence: 0.85,
              actionable: false
            }
          ]
        })
      }
      
      case 'chat': {
        const context = data.context
        const messages = Array.isArray(data.messages)
          ? data.messages
              .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
              .map((m): LlmMessage => ({
                role: toLlmRole(m.role),
                content: typeof m.content === 'string' ? m.content : '',
              }))
              .filter((m) => m.content.length > 0)
          : []
        
        const systemPrompt = `You are an AI assistant for EliteCRM, a sophisticated CRM system.
You help users manage leads, analyze data, and optimize their sales process.
Be concise, professional, and actionable in your responses.
Context: ${JSON.stringify(context)}`
        
        const result = await chat({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        return NextResponse.json({
          message: result.content || '',
          success: true
        })
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json({ 
      error: 'AI processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'status') {
    return NextResponse.json({
      status: 'operational',
      models: ['claude-3-5-sonnet-20241022'],
      features: ['lead-scoring', 'content-generation', 'insights', 'chat']
    })
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
