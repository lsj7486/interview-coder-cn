import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'

// The system prompt is fully managed by the renderer (prompt scenes in the
// settings store) and synced here via updateAppSettings on app startup
function getSystemPrompt(extra?: string) {
  return [settings.customPrompt, extra].filter(Boolean).join('\n\n') || undefined
}

function getModel(_settings: AppSettings): string {
  if (_settings.model) return _settings.model

  // 用户没选模型时，按 API 服务商推断一个默认值。
  // 不能无条件回退到 gpt-5-mini：@ai-sdk/openai 会把以 `o` / `gpt-5` 开头的模型
  // 当成 reasoning 模型，并把 system 消息写成 `developer` role，第三方 OpenAI
  // 兼容服务（DeepSeek 等）不认识该 role，会直接返回 400。
  const baseURL = settings.apiBaseURL.toLowerCase()
  if (baseURL.includes('siliconflow')) return 'Qwen/Qwen3-VL-32B-Instruct'
  if (baseURL.includes('deepseek')) return 'deepseek-flash'
  if (baseURL.includes('openrouter')) return 'qwen/qwen3-vl-32b-instruct'
  if (baseURL.includes('dashscope') || baseURL.includes('aliyuncs')) return 'qwen3-vl-plus'
  if (!baseURL || baseURL.includes('openai.com')) return 'gpt-5-mini'

  throw new Error(`未配置模型：请在设置中填入「${settings.apiBaseURL}」支持的视觉模型`)
}

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system: getSystemPrompt(),
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

export function getFollowUpStream(
  messages: ModelMessage[],
  userQuestion: string,
  abortSignal?: AbortSignal
) {
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  // Add the user's follow-up question to the conversation
  const updatedMessages: ModelMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userQuestion
        }
      ]
    }
  ]

  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system: getSystemPrompt(),
    messages: updatedMessages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

export function getGeneralStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system: getSystemPrompt(
      '注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。'
    ),
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}
