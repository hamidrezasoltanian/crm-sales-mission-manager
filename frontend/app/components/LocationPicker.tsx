'use client'

import { useState } from 'react'
import { MapPin, Navigation, X } from 'lucide-react'
import { showToast } from './Toast'

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  initialLocation?: { lat: number, lng: number, address?: string }
  centerLocation?: { lat: number, lng: number } // Location of the center for distance calculation
}

export default function LocationPicker({ 
  onLocationSelect, 
  initialLocation,
  centerLocation 
}: LocationPickerProps) {
  const [location, setLocation] = useState<{ lat: number, lng: number, address: string } | null>(
    initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng, address: initialLocation.address || '' } : null
  )
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('موقعیت‌یابی در مرورگر شما پشتیبانی نمی‌شود', 'error')
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        try {
          // Try to get address from reverse geocoding
          // Using a simple approach - in production you might want to use a geocoding service
          const address = `موقعیت: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          
          const newLocation = { lat, lng, address }
          setLocation(newLocation)
          onLocationSelect(lat, lng, address)
          showToast('موقعیت با موفقیت دریافت شد', 'success')
        } catch (error) {
          console.error('Error getting address:', error)
          const newLocation = { lat, lng, address: `موقعیت: ${lat.toFixed(6)}, ${lng.toFixed(6)}` }
          setLocation(newLocation)
          onLocationSelect(lat, lng, newLocation.address)
          showToast('موقعیت دریافت شد اما آدرس یافت نشد', 'warning')
        } finally {
          setLoading(false)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        let errorMessage = 'خطا در دریافت موقعیت'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'دسترسی به موقعیت رد شد. لطفاً مجوز را فعال کنید'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'اطلاعات موقعیت در دسترس نیست'
            break
          case error.TIMEOUT:
            errorMessage = 'زمان دریافت موقعیت به پایان رسید'
            break
        }
        showToast(errorMessage, 'error')
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const handleManualInput = () => {
    const latStr = prompt('عرض جغرافیایی (Latitude):')
    const lngStr = prompt('طول جغرافیایی (Longitude):')
    const address = prompt('آدرس (اختیاری):') || ''

    if (latStr && lngStr) {
      const lat = parseFloat(latStr)
      const lng = parseFloat(lngStr)

      if (!isNaN(lat) && !isNaN(lng)) {
        const newLocation = { lat, lng, address: address || `موقعیت: ${lat.toFixed(6)}, ${lng.toFixed(6)}` }
        setLocation(newLocation)
        onLocationSelect(lat, lng, newLocation.address)
        showToast('موقعیت ثبت شد', 'success')
      } else {
        showToast('مقادیر وارد شده معتبر نیستند', 'error')
      }
    }
  }

  const handleClear = () => {
    setLocation(null)
    onLocationSelect(0, 0, '')
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Navigation size={18} className={loading ? 'animate-spin' : ''} />
          {loading ? 'در حال دریافت...' : 'استفاده از موقعیت فعلی'}
        </button>
        <button
          type="button"
          onClick={handleManualInput}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ورود دستی
        </button>
      </div>

      {location && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-green-600" size={18} />
                <span className="font-semibold text-gray-900">موقعیت ثبت شده</span>
              </div>
              {location.address && (
                <p className="text-sm text-gray-700 mb-2">{location.address}</p>
              )}
              <p className="text-xs text-gray-600">
                عرض: {location.lat.toFixed(6)}, طول: {location.lng.toFixed(6)}
              </p>
              {centerLocation && (
                <p className="text-xs text-blue-600 mt-2">
                  فاصله از مرکز: {calculateDistance(location.lat, location.lng, centerLocation.lat, centerLocation.lng).toFixed(2)} کیلومتر
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

