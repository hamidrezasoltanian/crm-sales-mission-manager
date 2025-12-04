'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, MapPin, X, Loader2, Filter, User } from 'lucide-react'
import { getCenters } from '../lib/api'

interface Center {
  id: number
  name: string
  city?: string
  province?: string
  latitude?: number
  longitude?: number
  responsiblePersonnelId?: number
  responsiblePersonnelName?: string
  type?: string
  tags?: string
  address?: string
}

interface CenterSearchProps {
  onSelect: (center: Center) => void
  selectedCenter?: Center | null
  filters?: {
    province?: string
    expert?: string
    responsiblePersonnelId?: number
    type?: 'province' | 'tehran'
  }
  placeholder?: string
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function CenterSearch({ 
  onSelect, 
  selectedCenter, 
  filters,
  placeholder = "جستجو در مراکز..." 
}: CenterSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [centers, setCenters] = useState<Center[]>([])
  const [filteredCenters, setFilteredCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [localFilters, setLocalFilters] = useState({
    province: filters?.province || '',
    expert: filters?.expert || ''
  })

  // Debounce search term (300ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Load centers function
  const loadCenters = useCallback(async () => {
    setLoading(true)
    try {
      // Convert filters to API format
      const apiFilters: any = {}
      if (filters?.responsiblePersonnelId) {
        apiFilters.responsiblePersonnelId = filters.responsiblePersonnelId
      }
      if (filters?.province) {
        apiFilters.province = filters.province
      }
      if (filters?.type === 'tehran') {
        apiFilters.city = 'تهران'
      }
      
      // Use search API if search term exists (only when debounced)
      if (debouncedSearchTerm.trim()) {
        apiFilters.search = debouncedSearchTerm.trim()
      }
      
      // Apply local filters to API
      if (localFilters.province && !filters?.province) {
        apiFilters.province = localFilters.province
      }
      if (localFilters.expert) {
        apiFilters.responsiblePersonnelId = parseInt(localFilters.expert)
      }
      
      const response = await getCenters(apiFilters)
      const data = Array.isArray(response) ? response : (response?.data || [])
      
      setCenters(data)
    } catch (error) {
      console.error('Error loading centers:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, localFilters, debouncedSearchTerm])

  // Filter and sort centers client-side for better UX
  const filterCenters = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredCenters([])
      return
    }

    const termLower = term.toLowerCase()
    
    // Score-based filtering and sorting
    const scored = centers.map(center => {
      let score = 0
      const nameLower = center.name?.toLowerCase() || ''
      const cityLower = center.city?.toLowerCase() || ''
      const provinceLower = center.province?.toLowerCase() || ''
      const addressLower = center.address?.toLowerCase() || ''
      
      // Exact match in name (highest priority)
      if (nameLower === termLower) score += 100
      else if (nameLower.startsWith(termLower)) score += 50
      else if (nameLower.includes(termLower)) score += 30
      
      // Match in city
      if (cityLower.includes(termLower)) score += 20
      
      // Match in province
      if (provinceLower.includes(termLower)) score += 15
      
      // Match in address
      if (addressLower.includes(termLower)) score += 10
      
      return { center, score }
    })
    
    // Filter by score > 0 and sort by score descending
    const filtered = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15) // Show top 15 results
      .map(item => item.center)
    
    setFilteredCenters(filtered)
  }, [centers])

  // Load centers on mount and when filters change
  useEffect(() => {
    loadCenters()
  }, [loadCenters])

  // Filter and sort centers client-side for better UX
  useEffect(() => {
    if (debouncedSearchTerm.trim() === '') {
      setFilteredCenters([])
      return
    }

    filterCenters(debouncedSearchTerm)
  }, [debouncedSearchTerm, filterCenters])

  const handleSelect = (center: Center) => {
    onSelect(center)
    setSearchTerm('')
    setShowResults(false)
  }

  const handleClear = () => {
    setSearchTerm('')
    setFilteredCenters([])
    setShowResults(false)
    onSelect(null as any)
  }

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'))
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === searchTerm.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  // Get unique provinces and experts for filters
  const availableProvinces = useMemo(() => {
    const provinces = new Set<string>()
    centers.forEach(c => {
      if (c.province) provinces.add(c.province)
      if (c.city && !c.province) provinces.add(c.city)
    })
    return Array.from(provinces).sort()
  }, [centers])

  const availableExperts = useMemo(() => {
    const experts = new Map<number, string>()
    centers.forEach(c => {
      if (c.responsiblePersonnelId && c.responsiblePersonnelName) {
        experts.set(c.responsiblePersonnelId, c.responsiblePersonnelName)
      }
    })
    return Array.from(experts.entries()).map(([id, name]) => ({ id, name }))
  }, [centers])

  return (
    <div className="relative">
      <div className="relative">
        <Search className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${loading ? 'text-blue-500' : 'text-gray-400'}`} size={20} />
        {loading && (
          <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 animate-spin text-blue-500" size={16} />
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={selectedCenter ? selectedCenter.name : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => {
            if (searchTerm || filteredCenters.length > 0) {
              setShowResults(true)
            }
          }}
          onBlur={(e) => {
            // Delay hiding results to allow click
            setTimeout(() => {
              const currentTarget = e.currentTarget
              const activeElement = document.activeElement
              if (currentTarget && activeElement && !currentTarget.contains(activeElement)) {
                setShowResults(false)
              } else if (currentTarget && !activeElement) {
                // If no active element, hide results
                setShowResults(false)
              }
            }, 200)
          }}
          className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!!selectedCenter}
        />
        {selectedCenter && (
          <button
            onClick={handleClear}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            title="پاک کردن"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      {!selectedCenter && centers.length > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter size={14} />
            فیلترها
          </button>
          {localFilters.province && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-lg">
              استان: {localFilters.province}
              <button
                onClick={() => setLocalFilters({ ...localFilters, province: '' })}
                className="mr-1 hover:text-blue-600"
              >
                ×
              </button>
            </span>
          )}
          {localFilters.expert && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-lg">
              کارشناس: {availableExperts.find(e => e.id.toString() === localFilters.expert)?.name}
              <button
                onClick={() => setLocalFilters({ ...localFilters, expert: '' })}
                className="mr-1 hover:text-purple-600"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && !selectedCenter && (
        <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">استان</label>
              <select
                value={localFilters.province}
                onChange={(e) => {
                  setLocalFilters({ ...localFilters, province: e.target.value })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">همه استان‌ها</option>
                {availableProvinces.map(province => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">کارشناس مسئول</label>
              <select
                value={localFilters.expert}
                onChange={(e) => {
                  setLocalFilters({ ...localFilters, expert: e.target.value })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">همه کارشناسان</option>
                {availableExperts.map(expert => (
                  <option key={expert.id} value={expert.id.toString()}>{expert.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Dropdown */}
      {showResults && filteredCenters.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            {filteredCenters.length} نتیجه یافت شد
          </div>
          {filteredCenters.map((center) => (
            <button
              key={center.id}
              onClick={() => handleSelect(center)}
              className="w-full text-right px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
              onMouseDown={(e) => e.preventDefault()} // Prevent blur
            >
              <div className="flex items-start gap-3">
                <MapPin className="text-blue-500 mt-1 flex-shrink-0" size={18} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {highlightText(center.name, searchTerm)}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {(center.city || center.province) && (
                      <span className="text-xs text-gray-600">
                        📍 {highlightText([center.city, center.province].filter(Boolean).join('، '), searchTerm)}
                      </span>
                    )}
                    {center.responsiblePersonnelName && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={12} />
                        {center.responsiblePersonnelName}
                      </span>
                    )}
                    {center.type && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {center.type}
                      </span>
                    )}
                  </div>
                  {center.address && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {center.address}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && searchTerm && filteredCenters.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-6 text-center">
          <p className="text-gray-500 mb-2">مرکزی یافت نشد</p>
          <p className="text-xs text-gray-400">لطفاً عبارت جستجو را تغییر دهید</p>
        </div>
      )}
    </div>
  )
}
