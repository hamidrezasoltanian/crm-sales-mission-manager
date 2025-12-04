'use client'

import EmployeeSidebar from './EmployeeSidebar'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <EmployeeSidebar />
      <main className="flex-1 mr-64 min-h-screen bg-gray-50 mobile-full md:mr-64">
        {children}
      </main>
    </div>
  )
}

