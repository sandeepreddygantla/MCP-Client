import { type ElementType } from 'react'

export type IconType =
  | 'mistral'
  | 'gemini'
  | 'aws'
  | 'azure'
  | 'anthropic'
  | 'groq'
  | 'fireworks'
  | 'deepseek'
  | 'cohere'
  | 'ollama'
  | 'xai'
  | 'agno'
  | 'user'
  | 'agent'
  | 'open-ai'
  | 'sheet'
  | 'nextjs'
  | 'shadcn'
  | 'tailwind'
  | 'reasoning'
  | 'agno-tag'
  | 'refresh'
  | 'edit'
  | 'save'
  | 'x'
  | 'arrow-down'
  | 'arrow-left'
  | 'send'
  | 'download'
  | 'hammer'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'plus-icon'
  | 'references'
  | 'trash'
  | 'copy'
  | 'list'
  | 'alert-triangle'
  | 'clock'
  | 'moon'
  | 'sun'
  | 'eye'
  | 'eye-off'
  | 'server'
  | 'globe'
  | 'settings'
  | 'message-circle'
  | 'lightbulb'
  | 'code-xml'
  | 'rocket'

export interface IconProps {
  type: IconType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'dot' | 'xxs' | 'default'
  className?: string
  color?: string
  disabled?: boolean
}

export type IconTypeMap = {
  [key in IconType]: ElementType
}
