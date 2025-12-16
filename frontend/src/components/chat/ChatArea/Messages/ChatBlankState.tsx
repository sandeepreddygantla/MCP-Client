'use client'

import { motion } from 'framer-motion'
import Icon from '@/components/ui/icon'
import { IconType } from '@/components/ui/icon/types'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { toast } from 'sonner'

interface SamplePrompt {
  icon: IconType
  text: string
  description: string
}

const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    icon: 'message-circle',
    text: 'Hello! What can you do?',
    description: 'Learn about capabilities'
  },
  {
    icon: 'lightbulb',
    text: 'Tell me about your capabilities',
    description: 'Explore features'
  },
  {
    icon: 'code-xml',
    text: 'Show me an example of what you can help with',
    description: 'See practical examples'
  },
  {
    icon: 'rocket',
    text: 'Help me get started',
    description: 'Quick start guide'
  }
]

const ChatBlankState = () => {
  const { handleStreamResponse } = useAIChatStreamHandler()

  const handlePromptClick = async (promptText: string) => {
    try {
      await handleStreamResponse(promptText)
    } catch (error) {
      toast.error(
        `Error sending prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return (
    <section
      className="flex flex-col items-center text-center font-geist"
      aria-label="Sample prompts"
    >
      <div className="flex max-w-3xl flex-col gap-y-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-3xl font-[600] tracking-tight"
        >
          How can I help you today?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-sm text-foreground-secondary"
        >
          Try one of these prompts to get started
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {SAMPLE_PROMPTS.map((prompt, index) => (
            <motion.button
              key={index}
              onClick={() => handlePromptClick(prompt.text)}
              className="group relative flex flex-col items-start gap-2 rounded-xl border border-border/30 bg-accent p-4 text-left transition-all hover:border-border hover:bg-accent/80"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
            >
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon
                    type={prompt.icon}
                    size="xs"
                    className="text-primary"
                  />
                </div>
                <span className="text-xs font-medium text-foreground-secondary">
                  {prompt.description}
                </span>
              </div>
              <p className="text-sm font-medium text-accent-foreground group-hover:text-foreground">
                {prompt.text}
              </p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default ChatBlankState
