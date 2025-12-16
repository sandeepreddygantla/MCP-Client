'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null

    if (savedTheme) {
      setTheme(savedTheme)
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    } else {
      setTheme('light')
      localStorage.setItem('theme', 'light')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        disabled
      >
        <Icon type="sun" size="xs" />
      </Button>
    )
  }

  return (
    <div className="flex items-center justify-between w-full rounded-xl border border-border/20 bg-accent p-2">
      <span className="text-xs font-medium uppercase text-accent-foreground">
        {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="h-7 w-7 hover:bg-accent transition-colors"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <Icon type="moon" size="xs" />
        ) : (
          <Icon type="sun" size="xs" />
        )}
      </Button>
    </div>
  )
}
