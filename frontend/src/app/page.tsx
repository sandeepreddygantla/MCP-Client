'use client'
import Sidebar from '@/components/chat/Sidebar/Sidebar'
import { ChatArea } from '@/components/chat/ChatArea'
import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMigration } from '@/hooks/useMigration'
import { useStore } from '@/store'

export default function Home() {
  const router = useRouter()
  const connections = useStore((state) => state.connections)
  const hydrated = useStore((state) => state.hydrated)

  // Run migration from legacy endpoint to connections
  useMigration()

  // Redirect to settings if no connections are configured
  useEffect(() => {
    // Only check after hydration is complete to avoid false redirects
    if (hydrated && connections.length === 0) {
      router.push('/settings?firstRun=true')
    }
  }, [hydrated, connections.length, router])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <ChatArea />
      </div>
    </Suspense>
  )
}
