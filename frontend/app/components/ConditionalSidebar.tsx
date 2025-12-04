'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function ConditionalSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarWidth, setSidebarWidth] = useState(80) // Default to collapsed (80px)
  
  // Hide sidebar on login and auth pages
  const hideSidebar = pathname?.startsWith('/login') || 
                      pathname?.startsWith('/auth') || 
                      pathname?.startsWith('/magic-link')

  useEffect(() => {
    if (hideSidebar) return

    const updateSidebarWidth = () => {
      const sidebar = document.querySelector('aside')
      if (sidebar) {
        const width = sidebar.offsetWidth
        setSidebarWidth(width)
      }
    }
    
    // Check initial state
    setTimeout(updateSidebarWidth, 100)

    // Listen for sidebar changes
    const handleSidebarToggle = () => {
      setTimeout(updateSidebarWidth, 550) // Wait for animation to complete
    }
    
    window.addEventListener('sidebar-toggle', handleSidebarToggle)
    
    // Also check periodically for hover state
    const interval = setInterval(updateSidebarWidth, 200)

    return () => {
      window.removeEventListener('sidebar-toggle', handleSidebarToggle)
      clearInterval(interval)
    }
  }, [hideSidebar])

  if (hideSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-h-screen transition-all duration-500 ease-in-out" style={{ marginRight: `${sidebarWidth}px` }}>
        {children}
      </main>
    </div>
  )
}

