'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'
import jalaali from 'jalaali-js'
import { toPersianDate, fromPersianDate } from '../lib/dateUtils'

interface PersianDateTimePickerProps {
  value?: Date | string | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showTime?: boolean
}

export default function PersianDateTimePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ و ساعت',
  className = '',
  disabled = false,
  showTime = true
}: PersianDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null)
  const [selectedTime, setSelectedTime] = useState<{ hour: number; minute: number }>({ hour: 0, minute: 0 })
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
        setSelectedTime({ hour: d.getHours(), minute: d.getMinutes() })
      }
    } else {
      setSelectedDate(null)
      setSelectedTime({ hour: 0, minute: 0 })
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
    return jalaali.isLeapJalaaliYear(year) ? 30 : 29
  }

  const getFirstDayOfMonth = (year: number, month: number): number => {
    const gDate = jalaali.toGregorian(year, month, 1)
    const date = new Date(gDate.gy, gDate.gm - 1, gDate.gd)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 6 ? 0 : dayOfWeek + 1
  }

  const handleDateSelect = (day: number) => {
    const newDate = { year: currentMonth.year, month: currentMonth.month, day }
    setSelectedDate(newDate)
  }

  const handleTimeChange = (type: 'hour' | 'minute', value: number) => {
    setSelectedTime(prev => ({
      ...prev,
      [type]: value
    }))
  }

  const handleConfirm = () => {
    if (selectedDate) {
      const gDate = fromPersianDate(selectedDate.year, selectedDate.month, selectedDate.day)
      gDate.setHours(selectedTime.hour, selectedTime.minute, 0, 0)
      onChange(gDate)
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setSelectedDate(null)
    setSelectedTime({ hour: 0, minute: 0 })
    onChange(null)
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

  const formatDisplayValue = () => {
    if (!value) return placeholder
    const d = typeof value === 'string' ? new Date(value) : value
    if (isNaN(d.getTime())) return placeholder
    const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
    const dateStr = `${jDate.jd} ${monthNames[jDate.jm - 1]} ${jDate.jy}`
    if (showTime) {
      const hour = d.getHours().toString().padStart(2, '0')
      const minute = d.getMinutes().toString().padStart(2, '0')
      return `${dateStr} - ${hour}:${minute}`
    }
    return dateStr
  }

  const days = []
  const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month)
  const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month)

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-md text-right flex items-center gap-2 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Calendar size={18} className="text-gray-400" />
        <span className="flex-1 text-sm">{formatDisplayValue()}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border rounded-lg shadow-xl p-4 w-80">
          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ‹
              </button>
              <span className="font-semibold">
                {monthNames[currentMonth.month - 1]} {currentMonth.year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 p-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="p-2" />
                }
                const isSelected = selectedDate?.day === day &&
                  selectedDate?.month === currentMonth.month &&
                  selectedDate?.year === currentMonth.year
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`p-2 text-sm rounded hover:bg-blue-50 ${
                      isSelected ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Picker */}
          {showTime && (
            <div className="mb-4 border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm font-medium">ساعت:</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTime.hour}
                  onChange={(e) => handleTimeChange('hour', parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">:</span>
                <select
                  value={selectedTime.minute}
                  onChange={(e) => handleTimeChange('minute', parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              تایید
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

