'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'

interface DashboardCustomizerProps {
  visibleCards: string[]
  onCardsChange: (cards: string[]) => void
}

const availableCards = [
  { id: 'totalAssignments', label: 'کل ماموریت‌ها', icon: '🎯' },
  { id: 'pendingAssignments', label: 'در انتظار تایید', icon: '⏳' },
  { id: 'completedAssignments', label: 'تکمیل شده', icon: '✅' },
  { id: 'totalCost', label: 'کل هزینه', icon: '💰' },
  { id: 'statusChart', label: 'نمودار وضعیت', icon: '📊' },
  { id: 'monthlyChart', label: 'نمودار ماهانه', icon: '📈' },
  { id: 'recentAssignments', label: 'ماموریت‌های اخیر', icon: '📋' }
]

export default function DashboardCustomizer({ visibleCards, onCardsChange }: DashboardCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCards, setSelectedCards] = useState<string[]>(visibleCards)

  useEffect(() => {
    setSelectedCards(visibleCards)
  }, [visibleCards])

  const handleToggle = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId))
    } else {
      setSelectedCards([...selectedCards, cardId])
    }
  }

  const handleApply = () => {
    onCardsChange(selectedCards)
    setIsOpen(false)
    // ذخیره در localStorage
    localStorage.setItem('dashboardCards', JSON.stringify(selectedCards))
  }

  const handleReset = () => {
    const defaultCards = availableCards.map(c => c.id)
    setSelectedCards(defaultCards)
    onCardsChange(defaultCards)
    localStorage.setItem('dashboardCards', JSON.stringify(defaultCards))
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="سفارشی‌سازی داشبورد"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-2xl p-6 z-50 w-80">
            <h3 className="text-lg font-bold text-gray-900 mb-4">سفارشی‌سازی داشبورد</h3>
            <p className="text-sm text-gray-600 mb-4">کارت‌های مورد نظر را انتخاب کنید:</p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {availableCards.map(card => (
                <label
                  key={card.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCards.includes(card.id)}
                    onChange={() => handleToggle(card.id)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-2xl">{card.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{card.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                اعمال
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                بازنشانی
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                لغو
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

