import { LanguageModelV1 } from '@ai-sdk/provider'
import {
  generateObject,
  generateText,
  streamObject,
  UserContent,
  Schema,
} from 'ai'
import { z } from 'zod'
import { ScraperLLMOptions, ScraperGenerateOptions } from './index.js'
import { PreProcessResult } from './preprocess.js'
import { zodToJsonSchema } from 'zod-to-json-schema'

const defaultPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

const defaultCodePrompt =
  "Provide a scraping function in JavaScript that extracts and returns data according to a schema from the current page. The function must be IIFE. No comments or imports. No console.log. The code you generate will be executed straight away, you shouldn't output anything besides runnable code."

function stripMarkdownBackticks(text: string) {
  let trimmed = text.trim()
  trimmed = trimmed.replace(/^```(?:javascript)?\s*/i, '')
  trimmed = trimmed.replace(/\s*```$/i, '')
  return trimmed
}

function prepareAISDKPage(page: PreProcessResult): UserContent {
  if (page.format === 'image') {
    return [
      {
        type: 'image',
        image: page.content,
      },
    ]
  }

  return [{ type: 'text', text: page.content }]
}

export async function generateAISDKCompletions<T>(
  model: LanguageModelV1,
  page: PreProcessResult,
  schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
  options?: ScraperLLMOptions
) {
  const content = prepareAISDKPage(page)
  const result = await generateObject<T>({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    mode: options?.mode,
    output: options?.output,
  })

  return {
    data: result.object,
    url: page.url,
  }
}

export function streamAISDKCompletions<T>(
  model: LanguageModelV1,
  page: PreProcessResult,
  schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
  options?: ScraperLLMOptions
) {
  const content = prepareAISDKPage(page)
  const { partialObjectStream } = streamObject<T>({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema,
    output: options?.output,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    mode: options?.mode,
  })

  return {
    stream: partialObjectStream,
    url: page.url,
  }
}

export async function generateAISDKCode<T>(
  model: LanguageModelV1,
  page: PreProcessResult,
  schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
  options?: ScraperGenerateOptions
) {
  const parsedSchema =
    schema instanceof z.ZodType ? zodToJsonSchema(schema) : schema

  const result = await generateText({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultCodePrompt },
      {
        role: 'user',
        content: `Website: ${page.url}
        Schema: ${JSON.stringify(parsedSchema)}
        Content: ${page.content}`,
      },
    ],
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
  })

  return {
    code: stripMarkdownBackticks(result.text),
    url: page.url,
  }
}
