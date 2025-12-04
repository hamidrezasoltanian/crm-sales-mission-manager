'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import jalaali from 'jalaali-js'
import { toPersianDate, fromPersianDate } from '../lib/dateUtils'

interface PersianDatePickerProps {
  value?: Date | string | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function PersianDatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ',
  className = '',
  disabled = false
}: PersianDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null)
  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>(() => {
    const today = new Date()
    const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate())
    return { year: jToday.jy, month: jToday.jm }
  })
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const d = typeof value === 'string' ? new Date(value) : value
      if (!isNaN(d.getTime())) {
        const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
        setSelectedDate({ year: jDate.jy, month: jDate.jm, day: jDate.jd })
        setCurrentMonth({ year: jDate.jy, month: jDate.jm })
      }
    } else {
      setSelectedDate(null)
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ]

  const dayNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

  const getDaysInMonth = (year: number, month: number): number => {
    if (month <= 6) return 31
    if (month <= 11) return 30
    // اسفند: 29 یا 30 (سال کبیسه)
    return jalaali.isLeapJalaaliYear(year) ? 30 : 29
  }

  const getFirstDayOfMonth = (year: number, month: number): number => {
    const gDate = jalaali.toGregorian(year, month, 1)
    const date = new Date(gDate.gy, gDate.gm - 1, gDate.gd)
    const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
    // تبدیل به تقویم شمسی (شروع از شنبه = 0)
    return dayOfWeek === 6 ? 0 : dayOfWeek + 1
  }

  const handleDateSelect = (day: number) => {
    const newDate = { year: currentMonth.year, month: currentMonth.month, day }
    setSelectedDate(newDate)
    const gDate = fromPersianDate(newDate.year, newDate.month, newDate.day)
    onChange(gDate)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    if (currentMonth.month === 1) {
      setCurrentMonth({ year: currentMonth.year - 1, month: 12 })
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month - 1 })
    }
  }

  const handleNextMonth = () => {
    if (currentMonth.month === 12) {
      setCurrentMonth({ year: currentMonth.year + 1, month: 1 })
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month + 1 })
    }
  }

  const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month)
  const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  
  // Adjust for Persian week (starts on Saturday = 0)
  const adjustedFirstDay = firstDay

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-2 border border-gray-300 rounded-lg 
          flex items-center justify-between
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-500'}
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? toPersianDate(value) : placeholder}
        </span>
        <Calendar size={20} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 w-80">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <div className="text-lg font-semibold text-gray-900">
              {monthNames[currentMonth.month - 1]} {currentMonth.year}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              →
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day, index) => (
              <div key={index} className="text-center text-sm font-medium text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: adjustedFirstDay }, (_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Days of month */}
            {days.map((day) => {
              const isSelected = selectedDate?.year === currentMonth.year &&
                selectedDate?.month === currentMonth.month &&
                selectedDate?.day === day
              
              return (
                <button
                  key={day}
                  onClick={() => handleDateSelect(day)}
                  className={`
                    aspect-square rounded-lg text-sm transition-colors
                    ${isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'hover:bg-blue-50 text-gray-700'
                    }
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                const today = new Date()
                const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate())
                handleDateSelect(jToday.jd)
                setCurrentMonth({ year: jToday.jy, month: jToday.jm })
              }}
              className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

