'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Target, 
  Phone,
  BarChart3,
  LogOut,
  Plus,
  List,
  Building2,
  CheckCircle2
} from 'lucide-react'

export default function EmployeeSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isManager } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const menuItems = [
    { href: '/my-dashboard', icon: LayoutDashboard, label: 'داشبورد من' },
    { 
      href: '/my-dashboard/missions', 
      icon: Target, 
      label: 'ماموریت‌های من',
      subItems: [
        { href: '/my-dashboard/missions', icon: List, label: 'لیست ماموریت‌ها' },
        { href: '/my-dashboard/missions/new', icon: Plus, label: 'ثبت ماموریت جدید' }
      ]
    },
    { 
      href: '/my-dashboard/contacts', 
      icon: Phone, 
      label: 'تماس‌های من',
      subItems: [
        { href: '/my-dashboard/contacts', icon: List, label: 'لیست تماس‌ها' },
        { href: '/my-dashboard/contacts/new', icon: Plus, label: 'ثبت تماس استان' },
        { href: '/my-dashboard/contacts/new/tehran', icon: Plus, label: 'ثبت تماس تهران' }
      ]
    },
    { href: '/my-dashboard/reports', icon: BarChart3, label: 'گزارش‌های من' },
    { href: '/my-dashboard/centers', icon: Building2, label: 'لیست مراکز' },
  ]

  return (
    <aside className="w-64 bg-gradient-to-b from-green-900 to-green-800 text-white h-screen fixed right-0 top-0 shadow-2xl">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-green-700">
          <h1 className="text-2xl font-bold text-white">
            👤 پنل کارمند
          </h1>
          <p className="text-green-200 text-sm mt-1">داشبورد شخصی</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.subItems && item.subItems.some(sub => pathname === sub.href))
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive 
                      ? 'bg-white text-green-900 shadow-lg transform scale-105' 
                      : 'text-green-100 hover:bg-green-700 hover:text-white'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
                {item.subItems && isActive && (
                  <div className="mt-2 mr-4 space-y-1">
                    {item.subItems.map((subItem) => {
                      const SubIcon = subItem.icon
                      const isSubActive = pathname === subItem.href
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all
                            ${isSubActive
                              ? 'bg-green-700 text-white'
                              : 'text-green-200 hover:bg-green-600'
                            }
                          `}
                        >
                          <SubIcon size={16} />
                          <span>{subItem.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-green-700">
          {user && (
            <div className="mb-3 px-4 py-2 text-sm">
              <div className="text-green-200">کاربر:</div>
              <div className="text-white font-semibold">{user.name}</div>
              <div className="text-green-300 text-xs mt-1">
                {user.role === 'admin' ? 'مدیر' : user.role === 'manager' ? 'مدیر فروش' : 'کارمند'}
              </div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-green-100 hover:bg-green-700 hover:text-white transition-all w-full"
          >
            <LogOut size={20} />
            <span className="font-medium">خروج</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

