'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAssignments } from '../lib/api'
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Target, 
  BarChart3, 
  Settings,
  LogOut,
  Phone,
  Bell,
  FileText,
  Stethoscope,
  ShieldCheck,
  TrendingUp,
  Columns,
  User,
  Activity,
  Calendar,
  FolderKanban
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout, isManager, isSuperAdmin, isAdmin } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  
  // Sidebar state - only controlled by click, not hover
  // Initialize with default value to avoid hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  
  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
    const userPreference = localStorage.getItem('sidebarCollapsed')
    if (userPreference === 'false') {
      setIsCollapsed(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', isCollapsed.toString())
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { isCollapsed } }))
      window.dispatchEvent(new Event('storage'))
    }
  }, [isCollapsed])

  useEffect(() => {
    if (isManager) {
      loadPendingCount()
      const interval = setInterval(loadPendingCount, 30000)
      return () => clearInterval(interval)
    }
  }, [isManager])

  const loadPendingCount = async () => {
    try {
      const response = await getAssignments({ status: 'pending' })
      const data = Array.isArray(response) ? response : (response?.data || [])
      setPendingCount(data.length)
    } catch (error) {
      console.error('Error loading pending count:', error)
    }
  }

  const handleLogout = () => {
    logout()
  }

  // Menu items
  const menuItems = [
    { href: '/', icon: LayoutDashboard, label: 'داشبورد', roles: ['all'] },
    { href: '/profile', icon: User, label: 'پروفایل', roles: ['all'] },
  ]

  const operationalItems = [
    { href: '/inbox', icon: Bell, label: 'کارتابل', badge: isManager ? pendingCount : undefined, roles: ['all'] },
    { href: '/assignments', icon: Target, label: 'ماموریت‌ها', roles: ['all'] },
    { href: '/contacts', icon: Phone, label: 'گزارش تماس‌ها', roles: ['all'] },
    { href: '/workflow', icon: Columns, label: 'برد عملیات', roles: ['all'] },
    { href: '/workspaces', icon: FolderKanban, label: 'Workspace ها', roles: ['all'] },
    { href: '/centers', icon: MapPin, label: 'مدیریت مراکز', roles: ['all'] },
  ]

  const managerItems = [
    { href: '/reports', icon: BarChart3, label: 'گزارش‌ها', roles: ['manager', 'admin', 'super_admin'] },
    { href: '/kpi', icon: TrendingUp, label: 'KPI و آنالیز', roles: ['manager', 'admin', 'super_admin'] },
  ]

  const adminItems = [
    { href: '/settings', icon: Settings, label: 'تنظیمات سیستم', roles: ['admin', 'super_admin'] },
    { href: '/activity', icon: Activity, label: 'لاگ فعالیت‌ها', roles: ['admin', 'super_admin', 'manager'] },
  ]

  const hrItems = [
    { href: '/hr/leaves', icon: FileText, label: 'مدیریت مرخصی', roles: ['hr', 'admin', 'super_admin'] },
  ]

  const medicalItems = [
    { href: '/medical/files', icon: Stethoscope, label: 'تاییدیه‌های پزشکان', roles: ['expert', 'admin', 'super_admin'] },
  ]

  const integratedSystems = [
    { href: '/sales-analysis', icon: BarChart3, label: 'داشبورد آنالیز فروش', roles: ['admin', 'manager'], external: false },
    { href: '/ez-dashboard', icon: LayoutDashboard, label: 'EZ Dashboard', roles: ['admin'], external: false },
    { href: '/leave-management', icon: Calendar, label: 'سیستم مرخصی و حضور', roles: ['admin', 'manager', 'staff'], external: false },
    { href: '/recruitment', icon: FileText, label: 'داشبورد استخدام', roles: ['admin', 'manager', 'hr'], external: false },
  ]

  // Legacy external systems (old dashboards)
  const legacySystems = [
    { 
      href: 'http://localhost:3001', 
      icon: BarChart3, 
      label: 'داشبورد آنالیز فروش (قدیمی)', 
      roles: ['admin', 'manager'], 
      external: true,
      onClick: () => {
        const token = localStorage.getItem('token')
        if (token) {
          window.open(`http://localhost:3001?token=${token}`, '_blank')
        } else {
          window.open('http://localhost:3001', '_blank')
        }
      }
    },
    { 
      href: 'http://localhost:5173', 
      icon: LayoutDashboard, 
      label: 'EZ Dashboard (قدیمی)', 
      roles: ['admin'], 
      external: true,
      onClick: () => {
        const token = localStorage.getItem('token')
        if (token) {
          window.open(`http://localhost:5173?token=${token}`, '_blank')
        } else {
          window.open('http://localhost:5173', '_blank')
        }
      }
    },
    { 
      href: 'http://localhost:8007', 
      icon: Calendar, 
      label: 'سیستم مرخصی (قدیمی)', 
      roles: ['admin', 'manager', 'staff'], 
      external: true,
      onClick: () => {
        const token = localStorage.getItem('token')
        if (token) {
          window.open(`http://localhost:8007?token=${token}`, '_blank')
        } else {
          window.open('http://localhost:8007', '_blank')
        }
      }
    },
  ]

  const userRole = user?.role || 'staff'
  
  // Helper function to check if user has access to an item
  const hasAccess = (item: any) => {
    if (item.roles.includes('all')) return true
    if (item.roles.includes(userRole)) return true
    if (isManager && item.roles.includes('manager')) return true
    if (isAdmin && item.roles.includes('admin')) return true
    if (isSuperAdmin && item.roles.includes('super_admin')) return true
    return false
  }
  
  const allItems = [
    ...menuItems,
    ...operationalItems,
    ...managerItems, // Always include, will be filtered
    ...adminItems, // Always include, will be filtered
    ...hrItems, // Always include, will be filtered
    ...medicalItems, // Always include, will be filtered
    ...integratedSystems,
    ...legacySystems, // Always include, will be filtered
  ].filter(hasAccess)
  
  const uniqueItems = Array.from(new Set(allItems.map(a => a.href)))
    .map(href => allItems.find(a => a.href === href))
    .filter(Boolean) // Remove any undefined items

  const isExpanded = !isCollapsed

  return (
    <aside 
      className={`
        fixed right-0 top-0 h-screen z-50
        bg-white border-l border-gray-200
        shadow-xl
        transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-72' : 'w-20'}
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`
            w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 
            flex items-center justify-center shadow-lg
            transition-all duration-300
            ${isMounted && isExpanded ? 'scale-100' : 'scale-90'}
          `}>
            <ShieldCheck className="text-white" size={24} />
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-right duration-300">
              <h1 className="text-lg font-bold text-gray-900 truncate">پورتال مرکزی</h1>
              <p className="text-xs text-gray-500 truncate">مدیریت یکپارچه</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
          title={isCollapsed ? 'باز کردن' : 'بستن'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {uniqueItems.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              در حال بارگذاری منو...
            </div>
          )}
          {uniqueItems.map((item: any, index) => {
            const Icon = item.icon
            const isActive = !item.external && (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
            
            if (item.external && item.onClick) {
              return (
                <button
                  key={`${item.href}-${index}`}
                  onClick={item.onClick}
                  className={`
                    group relative flex items-center gap-3 px-3 py-2.5 rounded-lg w-full
                    transition-all duration-300 ease-out
                    ${isExpanded ? 'justify-start' : 'justify-center'}
                    text-gray-700 hover:bg-gray-100 hover:text-gray-900
                  `}
                  title={isExpanded ? '' : item.label}
                >
                  <div className={`
                    flex items-center justify-center
                    transition-all duration-300
                    group-hover:scale-105
                  `}>
                    <Icon 
                      size={22} 
                      className="text-gray-600 group-hover:text-gray-900"
                    />
                  </div>
                  
                  {isExpanded && (
                    <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-right duration-300">
                      <span className="block text-sm font-medium truncate text-gray-700 group-hover:text-gray-900">
                        {item.label}
                      </span>
                    </div>
                  )}
                </button>
              )
            }
            
            return (
              <Link
                key={`${item.href}-${index}`}
                href={item.href}
                className={`
                  group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-300 ease-out
                  ${isExpanded ? 'justify-start' : 'justify-center'}
                  ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                title={isExpanded ? '' : item.label}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-400 rounded-l-full shadow-lg" />
                )}
                
                <div className={`
                  flex items-center justify-center
                  transition-all duration-300
                  ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                `}>
                  <Icon 
                    size={22} 
                    className={`
                      transition-all duration-300
                      ${isActive ? 'text-white drop-shadow-sm' : 'text-gray-600 group-hover:text-gray-900'}
                    `}
                  />
                </div>
                
                {isExpanded && (
                  <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-right duration-300">
                    <span className={`
                      block text-sm font-medium truncate
                      transition-all duration-300
                      ${isActive ? 'text-white font-semibold' : 'text-gray-700 group-hover:text-gray-900'}
                    `}>
                      {item.label}
                    </span>
                  </div>
                )}
                
                {/* Badge */}
                {item.badge > 0 && (
                  <span className={`
                    flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold
                    transition-all duration-300
                    ${isActive 
                      ? 'bg-yellow-400 text-gray-900' 
                      : 'bg-red-500 text-white'
                    }
                    ${isExpanded ? 'ml-auto' : 'absolute top-1 left-1'}
                  `}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        {user && (
          <>
            {isExpanded ? (
              <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {user.role === 'super_admin' ? 'مدیر ارشد' : 
                       user.role === 'admin' ? 'مدیر سیستم' : 
                       user.role === 'manager' ? 'مدیر فروش' : 'کارشناس'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex justify-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md" title={user.name}>
                  {user.name.charAt(0)}
                </div>
              </div>
            )}
          </>
        )}
        <button 
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-red-600 hover:bg-red-50 hover:text-red-700
            transition-all duration-300
            ${isExpanded ? 'justify-start' : 'justify-center'}
          `}
          title={isExpanded ? '' : 'خروج'}
        >
          <LogOut size={20} />
          {isExpanded && (
            <span className="text-sm font-medium animate-in fade-in slide-in-from-right duration-300">
              خروج از حساب
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
