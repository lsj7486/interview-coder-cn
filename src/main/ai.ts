import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'
import { buildRequestHeaders } from '../shared/request-headers'
import { createThinkingOffFetch } from './thinking'

// The system prompt is fully managed by the renderer (prompt scenes in the
// settings store) and synced here via updateAppSettings on app startup
function getSystemPrompt(extra?: string) {
  return [settings.customPrompt, extra].filter(Boolean).join('\n\n') || undefined
}

/** Tell the user once that the active model ignores the profile's 「关闭思考」 */
function reportThinkingRefused(model: string) {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('thinking-unsupported', model)
}

function createProvider() {
  return createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey,
    headers: buildRequestHeaders(settings.apiKey, settings.apiHeaders),
    // Only when asked for: a plain request is the one every platform accepts
    ...(settings.disableThinking
      ? { fetch: createThinkingOffFetch(settings.apiBaseURL, reportThinkingRefused) }
      : {})
  })
}

/**
 * The model to send. The renderer owns model selection: its `lib/providers.ts`
 * knows each platform's spelling of the same model and picks a default when the
 * API Base URL changes, so this only runs when nothing was chosen at all — a
 * `.env`-only setup, or a base URL the renderer does not recognize.
 *
 * Falling back to `gpt-5-mini` unconditionally is not safe: `@ai-sdk/openai`
 * treats ids starting with `o` / `gpt-5` as reasoning models and writes the
 * system message as a `developer` role, which third-party OpenAI-compatible
 * services (DeepSeek and others) reject with a 400.
 */
function getModel(_settings: AppSettings): string {
  if (_settings.model) return _settings.model

  const baseURL = settings.apiBaseURL.toLowerCase()
  if (baseURL.includes('siliconflow')) return 'Qwen/Qwen3-VL-32B-Instruct'
  if (baseURL.includes('deepseek')) return 'deepseek-flash'
  if (baseURL.includes('openrouter')) return 'openai/gpt-6-luna'
  if (baseURL.includes('dashscope') || baseURL.includes('aliyuncs')) return 'qwen3-vl-plus'
  if (!baseURL || baseURL.includes('openai.com')) return 'gpt-6-luna'

  throw new Error(`未配置模型：请在设置中填入「${settings.apiBaseURL}」支持的视觉模型`)
}

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const openai = createProvider()

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
  const openai = createProvider()

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
  const openai = createProvider()

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
