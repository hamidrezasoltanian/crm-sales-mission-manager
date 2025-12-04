'use client'

import { useState, useEffect } from 'react'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(80) // Default to collapsed (80px)

  useEffect(() => {
    const handleStorageChange = () => {
      const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true'
      setSidebarWidth(isCollapsed ? 80 : 256)
    }
    
    // Also listen for hover events on sidebar
    const handleMouseEnter = () => {
      setSidebarWidth(256)
    }
    
    const handleMouseLeave = () => {
      const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true'
      setSidebarWidth(isCollapsed ? 80 : 256)
    }
    
    // Check initial state
    handleStorageChange()

    // Listen for changes
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically (for same-tab changes)
    const interval = setInterval(handleStorageChange, 100)

    // Custom event listener for same-tab updates
    const handleCustomEvent = () => {
      handleStorageChange()
    }
    window.addEventListener('sidebar-toggle', handleCustomEvent)

    // Listen for hover events on sidebar
    const sidebar = document.querySelector('aside')
    if (sidebar) {
      sidebar.addEventListener('mouseenter', handleMouseEnter)
      sidebar.addEventListener('mouseleave', handleMouseLeave)
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('sidebar-toggle', handleCustomEvent)
      clearInterval(interval)
      if (sidebar) {
        sidebar.removeEventListener('mouseenter', handleMouseEnter)
        sidebar.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [])

  return (
    <div className="flex-1 min-h-screen bg-white transition-all duration-300" style={{ marginRight: `${sidebarWidth}px` }}>
      {children}
    </div>
  )
}

