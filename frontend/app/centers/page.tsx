'use client'

import { useState, useEffect } from 'react'
import { getCenters, createCenter, updateCenter, deleteCenter, getPersonnel, getCustomerSources, createCustomerSource } from '../lib/api'
import { exportToExcel, exportToPDF } from '../lib/exportUtils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CentersPage() {
  type AddressInput = {
    title: string
    addressLine: string
    city: string
    province: string
    district: string
    postalCode: string
    latitude: string
    longitude: string
    sortOrder: number
  }

  type PhoneInput = {
    label: string
    phone: string
    extension: string
    type: 'mobile' | 'landline' | string
    isPrimary: boolean
  }

  type CustomFieldInput = {
    fieldKey: string
    fieldLabel: string
    fieldType: string
    fieldValue: string
  }

  type DeliveryContactInput = {
    fullName: string
    position?: string
    title?: string
    mobile: string
    phone: string
    extension: string
    nationalId: string
    notes: string
    addressId?: number | null
    addressIndex: number | null
  }

  const createEmptyAddress = (sortOrder = 0): AddressInput => ({
    title: '',
    addressLine: '',
    city: '',
    province: '',
    district: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    sortOrder
  })

  const createEmptyPhone = (isPrimary = false): PhoneInput => ({
    label: '',
    phone: '',
    extension: '',
    type: 'landline',
    isPrimary
  })

  const createEmptyCustomField = (): CustomFieldInput => ({
    fieldKey: '',
    fieldLabel: '',
    fieldType: 'text',
    fieldValue: ''
  })

  const createEmptyDeliveryContact = (): DeliveryContactInput => ({
    fullName: '',
    position: '',
    title: '',
    mobile: '',
    phone: '',
    extension: '',
    nationalId: '',
    notes: '',
    addressIndex: null
  })

  const MAX_ADDRESSES = 3
  const [centers, setCenters] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCenter, setEditingCenter] = useState<any>(null)
  
  // فیلترها و جستجو
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvince, setFilterProvince] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterResponsible, setFilterResponsible] = useState('')
  const [showIncomplete, setShowIncomplete] = useState(false)
  
  // Bulk operations
  const [selectedCenters, setSelectedCenters] = useState<Set<string>>(new Set<string>())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [selectedCenterDetail, setSelectedCenterDetail] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [addressInputs, setAddressInputs] = useState<AddressInput[]>([createEmptyAddress()])
  const [phoneInputs, setPhoneInputs] = useState<PhoneInput[]>([createEmptyPhone(true)])
  const [customFieldsInputs, setCustomFieldsInputs] = useState<CustomFieldInput[]>([createEmptyCustomField()])
  const [deliveryContacts, setDeliveryContacts] = useState<DeliveryContactInput[]>([])
  const [customerSources, setCustomerSources] = useState<any[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [newSourceName, setNewSourceName] = useState('')

  useEffect(() => {
    fetchCenters()
    fetchPersonnel()
    fetchCustomerSources()
  }, [])

  const initializeFormState = (center?: any) => {
    const hydratedAddresses = Array.isArray(center?.addresses) && center.addresses.length
      ? center.addresses.slice(0, MAX_ADDRESSES).map((addr: any, idx: number) => ({
          title: addr.title || `آدرس ${idx + 1}`,
          addressLine: addr.addressLine || addr.address || '',
          city: addr.city || center?.city || '',
          province: addr.province || center?.province || '',
          district: addr.district || center?.district || '',
          postalCode: addr.postalCode || '',
          latitude: addr.latitude?.toString() || '',
          longitude: addr.longitude?.toString() || '',
          sortOrder: idx
        }))
      : center?.address
        ? [{
            title: 'آدرس اصلی',
            addressLine: center.address,
            city: center.city || '',
            province: center.province || '',
            district: center.district || '',
            postalCode: center.postal_code || center.postalCode || '',
            latitude: center.latitude?.toString() || '',
            longitude: center.longitude?.toString() || '',
            sortOrder: 0
          }]
        : [createEmptyAddress()]

    const hydratedPhones = Array.isArray(center?.phones) && center.phones.length
      ? center.phones.map((phone: any, idx: number) => ({
          label: phone.label || (phone.type === 'mobile' ? 'موبایل' : 'تلفن ثابت'),
          phone: phone.phone || '',
          extension: phone.extension || '',
          type: phone.type || 'landline',
          isPrimary: phone.isPrimary ?? idx === 0
        }))
      : [
          createEmptyPhone(true)
        ]

    if (!hydratedPhones.some((phone: any) => phone.isPrimary)) {
      hydratedPhones[0].isPrimary = true
    }

    const hydratedCustomFields = Array.isArray(center?.customFields) && center.customFields.length
      ? center.customFields.map((field: any) => ({
          fieldKey: field.fieldKey || '',
          fieldLabel: field.fieldLabel || '',
          fieldType: field.fieldType || 'text',
          fieldValue: field.fieldValue || ''
        }))
      : [createEmptyCustomField()]

    const hydratedDeliveryContacts = Array.isArray(center?.deliveryContacts) && center.deliveryContacts.length
      ? center.deliveryContacts.map((contact: any) => ({
          fullName: contact.fullName || '',
          position: contact.position || '',
          title: contact.title || '',
          mobile: contact.mobile || '',
          phone: contact.phone || '',
          extension: contact.extension || '',
          nationalId: contact.nationalId || '',
          notes: contact.notes || '',
          addressId: contact.addressId || null,
          addressIndex: contact.address?.sortOrder ?? null
        }))
      : [createEmptyDeliveryContact()]

    setAddressInputs(hydratedAddresses.slice(0, MAX_ADDRESSES))
    setPhoneInputs(hydratedPhones)
    setCustomFieldsInputs(hydratedCustomFields)
    setDeliveryContacts(hydratedDeliveryContacts)
    setSelectedSourceId(
      center?.source?.id?.toString() ||
      center?.sourceId?.toString() ||
      ''
    )
    setNewSourceName('')
  }

  const handleOpenForm = (center?: any) => {
    initializeFormState(center)
    setEditingCenter(center || null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingCenter(null)
  }

  const updateAddressField = (index: number, field: keyof AddressInput, value: string) => {
    setAddressInputs((prev) =>
      prev.map((addr, idx) => (idx === index ? { ...addr, [field]: value } : addr))
    )
  }

  const addAddressInput = () => {
    setAddressInputs((prev) => {
      if (prev.length >= MAX_ADDRESSES) return prev
      return [...prev, createEmptyAddress(prev.length)]
    })
  }

  const removeAddressInput = (index: number) => {
    setAddressInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const updatePhoneField = (index: number, field: keyof PhoneInput, value: string | boolean) => {
    setPhoneInputs((prev) =>
      prev.map((phone, idx) => {
        if (idx !== index) {
          return field === 'isPrimary' && value === true
            ? { ...phone, isPrimary: false }
            : phone
        }
        return {
          ...phone,
          [field]: value
        }
      })
    )
  }

  const addPhoneInput = () => {
    setPhoneInputs((prev) => [...prev, createEmptyPhone(prev.length === 0)])
  }

  const removePhoneInput = (index: number) => {
    setPhoneInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const updateCustomField = (index: number, field: keyof CustomFieldInput, value: string) => {
    setCustomFieldsInputs((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    )
  }

  const addCustomField = () => {
    setCustomFieldsInputs((prev) => [...prev, createEmptyCustomField()])
  }

  const removeCustomField = (index: number) => {
    setCustomFieldsInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const updateDeliveryContact = (index: number, field: keyof DeliveryContactInput, value: string | number | null) => {
    setDeliveryContacts((prev) =>
      prev.map((contact, idx) =>
        idx === index
          ? {
              ...contact,
              [field]: value
            }
          : contact
      )
    )
  }

  const addDeliveryContact = () => {
    setDeliveryContacts((prev) => [...prev, createEmptyDeliveryContact()])
  }

  const removeDeliveryContact = (index: number) => {
    setDeliveryContacts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const fetchPersonnel = async () => {
    try {
      const data = await getPersonnel()
      setPersonnel(data || [])
    } catch (error: any) {
      console.error('[Centers] Error fetching personnel:', error)
    }
  }

  const fetchCustomerSources = async () => {
    try {
      const data = await getCustomerSources()
      setCustomerSources(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('[Centers] Error fetching customer sources:', error)
    }
  }

  const fetchCenters = async () => {
    setLoading(true)
    // Safety timeout - force loading to false after 65 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('[Centers] Loading timeout - forcing state to false')
      setLoading(false)
    }, 65000)
    
    try {
      console.log('[Centers] Fetching centers...')
      // Load all centers with pagination - fetch all pages
      let allCenters: any[] = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        try {
          const data = await getCenters({ page, limit: 100 })
          const centersData = Array.isArray(data) ? data : (data?.data || [])
          
          if (centersData.length > 0) {
            allCenters = [...allCenters, ...centersData]
            // Check if there are more pages
            if (data.pagination) {
              hasMore = page < data.pagination.totalPages
              page++
            } else {
              // If no pagination info, assume we got all if less than limit
              hasMore = centersData.length === 100
              page++
            }
          } else {
            hasMore = false
          }
        } catch (err) {
          console.error(`[Centers] Error loading page ${page}:`, err)
          hasMore = false
        }
      }
      
      console.log('[Centers] Centers loaded:', allCenters.length)
      setCenters(Array.isArray(allCenters) ? allCenters : [])
    } catch (error: any) {
      console.error('[Centers] Error fetching centers:', error)
      setCenters([])
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        alert('خطا: درخواست به مدت زمان زیادی نیاز دارد. لطفاً دوباره تلاش کنید.')
      } else {
        alert('خطا در دریافت اطلاعات: ' + (error.response?.data?.error || error.message))
      }
    } finally {
      clearTimeout(safetyTimeout)
      setLoading(false)
      console.log('[Centers] Loading finished')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const sanitizedAddresses = addressInputs
      .map((addr, index) => ({
        title: (addr.title || '').trim() || `آدرس ${index + 1}`,
        addressLine: (addr.addressLine || '').trim(),
        city: (addr.city || '').trim(),
        province: (addr.province || '').trim(),
        district: (addr.district || '').trim(),
        postalCode: (addr.postalCode || '').trim(),
        latitude: addr.latitude ? (isNaN(parseFloat(addr.latitude)) ? null : parseFloat(addr.latitude)) : null,
        longitude: addr.longitude ? (isNaN(parseFloat(addr.longitude)) ? null : parseFloat(addr.longitude)) : null,
        sortOrder: index
      }))
      .filter((addr) => addr.addressLine.length > 0)
      .slice(0, MAX_ADDRESSES)

    if (!sanitizedAddresses.length) {
      alert('حداقل یک آدرس معتبر لازم است')
      return
    }

    const sanitizedPhones = phoneInputs
      .map((phone) => ({
        label: (phone.label || '').trim(),
        phone: (phone.phone || '').trim(),
        extension: (phone.extension || '').trim(),
        type: phone.type || 'landline',
        isPrimary: phone.isPrimary
      }))
      .filter((phone) => phone.phone.length > 0)

    if (sanitizedPhones.length && !sanitizedPhones.some((phone) => phone.isPrimary)) {
      sanitizedPhones[0].isPrimary = true
    }

    const sanitizedCustomFields = customFieldsInputs
      .map((field) => ({
        fieldKey: (field.fieldKey || '').trim(),
        fieldLabel: (field.fieldLabel || '').trim(),
        fieldType: field.fieldType || 'text',
        fieldValue: (field.fieldValue || '').trim()
      }))
      .filter((field) => field.fieldKey.length > 0 && field.fieldValue.length > 0)

    const sanitizedDeliveryContacts = deliveryContacts
      .map((contact) => ({
        fullName: (contact.fullName || '').trim(),
        position: (contact.position || '').trim() || null,
        title: (contact.title || '').trim() || null,
        mobile: (contact.mobile || '').trim(),
        phone: (contact.phone || '').trim(),
        extension: (contact.extension || '').trim(),
        nationalId: (contact.nationalId || '').trim(),
        notes: (contact.notes || '').trim(),
        addressIndex: contact.addressIndex !== null && contact.addressIndex !== undefined
          ? contact.addressIndex
          : null
      }))
      .filter((contact) => contact.fullName.length > 0)

    let sourceIdValue = selectedSourceId
    const newSource = newSourceName.trim()
    if (newSource) {
      try {
        const createdSource = await createCustomerSource({ name: newSource })
        sourceIdValue = createdSource?.id?.toString() || sourceIdValue
        await fetchCustomerSources()
        setNewSourceName('')
      } catch (error: any) {
        alert('خطا در ایجاد منبع مشتری: ' + (error.response?.data?.error || error.message))
        return
      }
    }

    const responsibleId = formData.get('responsiblePersonnelId')
    const financialCreditValue = formData.get('financialCredit')
    const payload: any = {
      name: (formData.get('name') || '').toString().trim(),
      type: (formData.get('type') || 'lead').toString(),
      customerType: (formData.get('customerType') || 'individual').toString(),
      legalType: (formData.get('legalType') || '').toString() || null,
      mobile: (formData.get('mobile') || '').toString().trim() || null,
      website: (formData.get('website') || '').toString().trim() || null,
      economicCode: (formData.get('economicCode') || '').toString().trim() || null,
      nationalId: (formData.get('nationalId') || '').toString().trim() || null,
      financialCredit: financialCreditValue
        ? isNaN(parseFloat(financialCreditValue as string))
          ? null
          : parseFloat(financialCreditValue as string)
        : null,
      creditRating: (formData.get('creditRating') || '').toString().trim() || null,
      potentialLevel: (formData.get('potentialLevel') || '').toString().trim() || null,
      potentialNotes: (formData.get('potentialNotes') || '').toString().trim() || null,
      bankInfo: (formData.get('bankInfo') || '').toString().trim() || null,
      warehouseReceiver: (formData.get('warehouseReceiver') || '').toString().trim() || null,
      description: (formData.get('description') || '').toString().trim() || null,
      responsiblePersonnelId: responsibleId ? parseInt(responsibleId as string) : null,
      sourceId: sourceIdValue ? parseInt(sourceIdValue) : null,
      addresses: sanitizedAddresses,
      phones: sanitizedPhones,
      customFields: sanitizedCustomFields,
      deliveryContacts: sanitizedDeliveryContacts
    }

    const primaryAddress = sanitizedAddresses[0]
    if (primaryAddress) {
      payload.address = primaryAddress.addressLine
      payload.city = primaryAddress.city
      payload.province = primaryAddress.province
      payload.district = primaryAddress.district
      payload.postal_code = primaryAddress.postalCode
      payload.latitude = primaryAddress.latitude
      payload.longitude = primaryAddress.longitude
    }

    try {
      if (editingCenter) {
        await updateCenter((editingCenter._id || editingCenter.id).toString(), payload)
      } else {
        await createCenter(payload)
      }
      await fetchCenters()
      handleCloseForm()
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('آیا مطمئن هستید؟')) {
      try {
        await deleteCenter(id.toString())
        await fetchCenters()
        setSelectedCenters(new Set())
      } catch (error: any) {
        alert('خطا: ' + (error.response?.data?.error || error.message))
      }
    }
  }

  // Bulk operations
  const handleSelectCenter = (id: string) => {
    const newSelected = new Set(selectedCenters)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedCenters(newSelected)
    setShowBulkActions(newSelected.size > 0)
  }

  const handleSelectAll = () => {
    const filtered = getFilteredCenters()
    
    if (selectedCenters.size === filtered.length) {
      setSelectedCenters(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedCenters(new Set<string>(filtered.map((c: any) => (c._id || c.id).toString())))
      setShowBulkActions(true)
    }
  }

  const handleBulkUpdateType = async (type: string) => {
    if (!confirm(`آیا مطمئن هستید که می‌خواهید نوع ${selectedCenters.size} مرکز را تغییر دهید؟`)) {
      return
    }
    
    try {
      const centerIds = Array.from(selectedCenters.values())
      for (const id of centerIds) {
        const center = centers.find((c: any) => (c._id || c.id).toString() === id)
        if (center) {
          await updateCenter(id, { ...center, type })
        }
      }
      await fetchCenters()
      setSelectedCenters(new Set())
      setShowBulkActions(false)
      alert('نوع مراکز با موفقیت تغییر کرد')
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleBulkUpdateResponsible = async (responsibleId: string) => {
    if (!confirm(`آیا مطمئن هستید که می‌خواهید مسئول ${selectedCenters.size} مرکز را تغییر دهید؟`)) {
      return
    }
    
    try {
      const centerIds = Array.from(selectedCenters.values())
      for (const id of centerIds) {
        const center = centers.find((c: any) => (c._id || c.id).toString() === id)
        if (center) {
          await updateCenter(id, { 
            ...center, 
            responsiblePersonnelId: responsibleId ? parseInt(responsibleId) : null 
          })
        }
      }
      await fetchCenters()
      setSelectedCenters(new Set())
      setShowBulkActions(false)
      alert('مسئول مراکز با موفقیت تغییر کرد')
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleBulkAssignByProvince = async (province: string) => {
    // فیلتر مراکز انتخاب شده که استان مشخص شده دارند
    const filteredCenters = centers.filter((c: any) => 
      selectedCenters.has((c._id || c.id).toString()) && c.province === province
    )
    
    if (filteredCenters.length === 0) {
      alert(`هیچ مرکز انتخاب شده‌ای با استان "${province}" یافت نشد`)
      return
    }
    
    const responsibleId = prompt(`مسئول جدید را برای ${filteredCenters.length} مرکز استان "${province}" انتخاب کنید:\n\nلطفاً ID مسئول را وارد کنید (یا Enter برای بدون مسئول):`)
    if (responsibleId === null) return
    
    if (!confirm(`آیا مطمئن هستید که می‌خواهید مسئول ${filteredCenters.length} مرکز استان "${province}" را تغییر دهید؟`)) {
      return
    }
    
    try {
      for (const center of filteredCenters) {
        const id = (center._id || center.id).toString()
        await updateCenter(id, { 
          ...center, 
          responsiblePersonnelId: responsibleId ? parseInt(responsibleId) : null 
        })
      }
      await fetchCenters()
      setSelectedCenters(new Set())
      setShowBulkActions(false)
      alert(`${filteredCenters.length} مرکز استان "${province}" با موفقیت جابجا شدند`)
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`آیا مطمئن هستید که می‌خواهید ${selectedCenters.size} مرکز را حذف کنید؟\n\nاین عمل غیر قابل بازگشت است!`)) {
      return
    }
    
    try {
      const centerIds = Array.from(selectedCenters.values())
      for (const id of centerIds) {
        await deleteCenter(id)
      }
      await fetchCenters()
      setSelectedCenters(new Set())
      setShowBulkActions(false)
      alert('مراکز با موفقیت حذف شدند')
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  // Helper: فیلتر کردن مراکز
  const getFilteredCenters = () => {
    return centers.filter((c: any) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!c.name?.toLowerCase().includes(query) && 
            !c.address?.toLowerCase().includes(query) &&
            !c.city?.toLowerCase().includes(query) &&
            !c.province?.toLowerCase().includes(query)) {
          return false
        }
      }
      if (filterProvince && c.city !== filterProvince) return false
      if (filterType && c.type !== filterType) return false
      if (filterResponsible) {
        if (filterResponsible === 'none' && c.responsiblePersonnelId) return false
        if (filterResponsible !== 'none' && c.responsiblePersonnelId !== parseInt(filterResponsible)) return false
      }
      if (showIncomplete && c.address && c.city) return false
      return true
    })
  }

  // Pagination helpers
  const getPaginatedCenters = () => {
    const filtered = getFilteredCenters()
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return {
      data: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage),
      currentPage,
      itemsPerPage
    }
  }

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [searchQuery, filterProvince, filterType, filterResponsible, showIncomplete])

  // Export functions
  const handleExportExcel = () => {
    const filtered = getFilteredCenters()
    
    const data = filtered.map((c: any) => ({
      'نام': c.name,
      'نوع': c.type === 'lead' ? 'سرنخ' : c.type === 'opportunity' ? 'فرصت' : c.type === 'customer' ? 'مشتری' : 'قدیمی',
      'آدرس': c.address || '-',
      'شهر': c.city || '-',
      'منطقه': c.district || '-',
      'مسئول': c.responsiblePersonnelName || 'بدون مسئول',
      'عرض جغرافیایی': c.latitude || '-',
      'طول جغرافیایی': c.longitude || '-'
    }))
    
    exportToExcel(data, 'مراکز')
  }

  const handleExportPDF = () => {
    const filtered = getFilteredCenters()
    
    const headers = [['نام', 'نوع', 'آدرس', 'شهر', 'مسئول']]
    const rows = filtered.map((c: any) => [
      c.name || '-',
      c.type === 'lead' ? 'سرنخ' : c.type === 'opportunity' ? 'فرصت' : c.type === 'customer' ? 'مشتری' : 'قدیمی',
      c.address || '-',
      c.city || '-',
      c.responsiblePersonnelName || 'بدون مسئول'
    ])
    
    exportToPDF('گزارش مراکز', headers, rows, 'مراکز')
  }

  const handleImportExcel = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      
      try {
        const XLSX = (await import('xlsx')).default
        const reader = new FileReader()
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(sheet)
            
            let successCount = 0
            let errorCount = 0
            
            for (const row of jsonData as any[]) {
              try {
                const centerData: any = {
                  name: row['نام'] || row['name'],
                  address: row['آدرس'] || row['address'],
                  city: row['شهر'] || row['city'],
                  district: row['منطقه'] || row['district'],
                  latitude: row['عرض جغرافیایی'] || row['latitude'],
                  longitude: row['طول جغرافیایی'] || row['longitude'],
                  type: row['نوع'] === 'سرنخ' ? 'lead' : 
                        row['نوع'] === 'فرصت' ? 'opportunity' :
                        row['نوع'] === 'مشتری' ? 'customer' :
                        row['نوع'] === 'قدیمی' ? 'old_customer' :
                        row['type'] || 'lead'
                }
                
                const responsibleName = row['مسئول'] || row['responsible']
                if (responsibleName && responsibleName !== 'بدون مسئول') {
                  const person = personnel.find((p: any) => p.name === responsibleName)
                  if (person) {
                    centerData.responsiblePersonnelId = person.id
                  }
                }
                
                await createCenter(centerData)
                successCount++
              } catch (error: any) {
                console.error('Error importing center:', error)
                errorCount++
              }
            }
            
            await fetchCenters()
            alert(`واردات انجام شد: ${successCount} موفق، ${errorCount} خطا`)
          } catch (error: any) {
            alert('خطا در خواندن فایل: ' + error.message)
          }
        }
        reader.readAsArrayBuffer(file)
      } catch (error: any) {
        alert('خطا: ' + error.message)
      }
    }
    input.click()
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
              <span>←</span>
              <span>بازگشت به داشبورد</span>
            </Link>
            <h1 className="text-4xl font-bold text-gray-800">مدیریت مراکز</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleOpenForm()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              افزودن مرکز
            </button>
            <button
              onClick={() => handleExportExcel()}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
            >
              📥 خروجی Excel
            </button>
            <button
              onClick={() => handleExportPDF()}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
            >
              📄 خروجی PDF
            </button>
            <button
              onClick={handleImportExcel}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg"
            >
              📤 ورود از Excel
            </button>
            {centers.some((c: any) => c.latitude && c.longitude) && (
              <button
                onClick={() => setShowMap(!showMap)}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg"
              >
                {showMap ? '📋 لیست' : '🗺️ نقشه'}
              </button>
            )}
            <button
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
              title={viewMode === 'card' ? 'نمایش جدولی' : 'نمایش کارتی'}
            >
              {viewMode === 'card' ? '📊 جدول' : '🃏 کارت'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">{editingCenter ? 'ویرایش' : 'افزودن'} مرکز</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">نام مرکز *</label>
                  <input type="text" name="name" required defaultValue={editingCenter?.name || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نوع مشتری</label>
                  <select name="customerType" defaultValue={editingCenter?.customerType || 'individual'}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="individual">حقیقی</option>
                    <option value="legal">حقوقی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نوع مرکز</label>
                  <select name="type" defaultValue={editingCenter?.type || 'lead'}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="lead">سرنخ</option>
                    <option value="opportunity">فرصت</option>
                    <option value="customer">مشتری</option>
                    <option value="old_customer">مشتری قدیمی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نوع حقوقی</label>
                  <input type="text" name="legalType" defaultValue={editingCenter?.legal_type || ''}
                    className="w-full px-4 py-2 border rounded-lg" placeholder="مثال: شرکت سهامی خاص" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">مسئول مرکز</label>
                  <select name="responsiblePersonnelId" defaultValue={editingCenter?.responsiblePersonnelId || ''}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="">بدون مسئول</option>
                    {personnel.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.role === 'admin' ? ' (مدیر کل)' : p.role === 'manager' ? ' (مدیر)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نحوه آشنایی</label>
                  <div className="flex gap-2">
                    <select value={selectedSourceId} onChange={(e) => setSelectedSourceId(e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-lg">
                      <option value="">انتخاب از لیست</option>
                      {customerSources.map((source: any) => (
                        <option key={source.id} value={source.id}>{source.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const name = prompt('نام نحوه آشنایی جدید را وارد کنید:')
                        if (name && name.trim()) {
                          try {
                            const createdSource = await createCustomerSource({ name: name.trim() })
                            await fetchCustomerSources()
                            setSelectedSourceId(createdSource?.id?.toString() || '')
                            setNewSourceName('')
                          } catch (error: any) {
                            alert('خطا در ایجاد منبع مشتری: ' + (error.response?.data?.error || error.message))
                          }
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                      title="افزودن نحوه آشنایی جدید"
                    >
                      + افزودن
                    </button>
                  </div>
                  <input type="text" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="یا نام منبع جدید را اینجا وارد کنید..." className="w-full mt-2 px-4 py-2 border rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">شماره موبایل</label>
                  <input type="text" name="mobile" defaultValue={editingCenter?.mobile || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">وب‌سایت</label>
                  <input type="text" name="website" defaultValue={editingCenter?.website || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">کد اقتصادی</label>
                  <input type="text" name="economicCode" defaultValue={editingCenter?.economic_code || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">شناسه/کد ملی</label>
                  <input type="text" name="nationalId" defaultValue={editingCenter?.national_id || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">اعتبار مالی</label>
                  <input type="number" step="any" name="financialCredit"
                    defaultValue={editingCenter?.financial_credit || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">رتبه اعتباری</label>
                  <input type="text" name="creditRating" defaultValue={editingCenter?.credit_rating || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">پتانسیل مشتری</label>
                  <select name="potentialLevel" defaultValue={editingCenter?.potentialLevel || ''}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="">نامشخص</option>
                    <option value="A">بالا (A)</option>
                    <option value="B">متوسط (B)</option>
                    <option value="C">پایین (C)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">توضیح پتانسیل</label>
                  <textarea name="potentialNotes" defaultValue={editingCenter?.potentialNotes || ''}
                    className="w-full px-4 py-2 border rounded-lg" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">اطلاعات بانکی</label>
                  <textarea name="bankInfo" defaultValue={editingCenter?.bank_info || ''}
                    className="w-full px-4 py-2 border rounded-lg" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">تحویل‌گیرنده کالا</label>
                  <input type="text" name="warehouseReceiver" defaultValue={editingCenter?.warehouse_receiver || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">توضیحات</label>
                  <textarea name="description" defaultValue={editingCenter?.description || ''}
                    className="w-full px-4 py-2 border rounded-lg" rows={3} />
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">آدرس‌ها (حداکثر ۳ مورد)</h3>
                  <button type="button" onClick={addAddressInput}
                    className="text-blue-600 disabled:text-gray-400" disabled={addressInputs.length >= MAX_ADDRESSES}>
                    + افزودن آدرس
                  </button>
                </div>
                {addressInputs.map((address, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">آدرس {index + 1}</span>
                      {addressInputs.length > 1 && (
                        <button type="button" onClick={() => removeAddressInput(index)} className="text-red-500 text-sm">
                          حذف
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">عنوان</label>
                        <input type="text" value={address.title}
                          onChange={(e) => updateAddressField(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">کد پستی</label>
                        <input type="text" value={address.postalCode}
                          onChange={(e) => updateAddressField(index, 'postalCode', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">آدرس کامل *</label>
                        <textarea required={index === 0} value={address.addressLine}
                          onChange={(e) => updateAddressField(index, 'addressLine', e.target.value)}
                          className="w-full px-3 py-2 border rounded" rows={2} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">استان</label>
                        <input type="text" value={address.province}
                          onChange={(e) => updateAddressField(index, 'province', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">شهر</label>
                        <input type="text" value={address.city}
                          onChange={(e) => updateAddressField(index, 'city', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">منطقه</label>
                        <input type="text" value={address.district}
                          onChange={(e) => updateAddressField(index, 'district', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">عرض جغرافیایی</label>
                          <input type="text" value={address.latitude}
                            onChange={(e) => updateAddressField(index, 'latitude', e.target.value)}
                            className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">طول جغرافیایی</label>
                          <input type="text" value={address.longitude}
                            onChange={(e) => updateAddressField(index, 'longitude', e.target.value)}
                            className="w-full px-3 py-2 border rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">شماره تلفن‌ها</h3>
                  <button type="button" onClick={addPhoneInput} className="text-blue-600">
                    + افزودن شماره
                  </button>
                </div>
                {phoneInputs.map((phone, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">شماره {index + 1}</span>
                      {phoneInputs.length > 1 && (
                        <button type="button" onClick={() => removePhoneInput(index)} className="text-red-500 text-sm">
                          حذف
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">برچسب</label>
                        <input type="text" value={phone.label}
                          onChange={(e) => updatePhoneField(index, 'label', e.target.value)}
                          className="w-full px-3 py-2 border rounded" placeholder="مثال: پذیرش" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">شماره *</label>
                        <input type="text" value={phone.phone}
                          onChange={(e) => updatePhoneField(index, 'phone', e.target.value)}
                          className="w-full px-3 py-2 border rounded" required={index === 0} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">نوع</label>
                        <select value={phone.type}
                          onChange={(e) => updatePhoneField(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 border rounded">
                          <option value="mobile">موبایل</option>
                          <option value="landline">تلفن ثابت</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">داخلی</label>
                        <input type="text" value={phone.extension}
                          onChange={(e) => updatePhoneField(index, 'extension', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="primaryPhone" checked={phone.isPrimary}
                          onChange={() => updatePhoneField(index, 'isPrimary', true)} />
                        <span>شماره اصلی</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">فیلدهای سفارشی</h3>
                  <button type="button" onClick={addCustomField} className="text-blue-600">
                    + افزودن فیلד
                  </button>
                </div>
                {customFieldsInputs.map((field, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">کلید</label>
                      <input type="text" value={field.fieldKey}
                        onChange={(e) => updateCustomField(index, 'fieldKey', e.target.value)}
                        className="w-full px-3 py-2 border rounded" placeholder="مثال: tenantCode" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">برچسب</label>
                      <input type="text" value={field.fieldLabel}
                        onChange={(e) => updateCustomField(index, 'fieldLabel', e.target.value)}
                        className="w-full px-3 py-2 border rounded" placeholder="نمایش در UI" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">نوع</label>
                      <select value={field.fieldType}
                        onChange={(e) => updateCustomField(index, 'fieldType', e.target.value)}
                        className="w-full px-3 py-2 border rounded">
                        <option value="text">متن</option>
                        <option value="number">عدد</option>
                        <option value="date">تاریخ</option>
                      </select>
                    </div>
                    <div className="relative">
                      <label className="block text-xs text-gray-600 mb-1">مقدار</label>
                      <input type="text" value={field.fieldValue}
                        onChange={(e) => updateCustomField(index, 'fieldValue', e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                      {customFieldsInputs.length > 1 && (
                        <button type="button" onClick={() => removeCustomField(index)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500 text-sm">
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">افراد مرتبط</h3>
                  <button type="button" onClick={addDeliveryContact} className="text-blue-600">
                    + افزودن فرد مرتبط
                  </button>
                </div>
                {deliveryContacts.map((contact, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">فرد مرتبط {index + 1}</span>
                      {deliveryContacts.length > 1 && (
                        <button type="button" onClick={() => removeDeliveryContact(index)}
                          className="text-red-500 text-sm">
                          حذف
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">نام و نام خانوادگی</label>
                        <input type="text" value={contact.fullName}
                          onChange={(e) => updateDeliveryContact(index, 'fullName', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">سمت</label>
                        <input type="text" value={contact.position || ''}
                          onChange={(e) => updateDeliveryContact(index, 'position', e.target.value)}
                          placeholder="مثال: مدیر فروش"
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">عنوان</label>
                        <input type="text" value={contact.title || ''}
                          onChange={(e) => updateDeliveryContact(index, 'title', e.target.value)}
                          placeholder="مثال: آقا/خانم"
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">موبایل</label>
                        <input type="text" value={contact.mobile}
                          onChange={(e) => updateDeliveryContact(index, 'mobile', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">تلفن ثابت</label>
                        <input type="text" value={contact.phone}
                          onChange={(e) => updateDeliveryContact(index, 'phone', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">داخلی</label>
                        <input type="text" value={contact.extension}
                          onChange={(e) => updateDeliveryContact(index, 'extension', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">کد ملی</label>
                        <input type="text" value={contact.nationalId}
                          onChange={(e) => updateDeliveryContact(index, 'nationalId', e.target.value)}
                          className="w-full px-3 py-2 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">آدرس مرتبط</label>
                        <select value={contact.addressIndex ?? ''}
                          onChange={(e) => updateDeliveryContact(index, 'addressIndex', e.target.value === '' ? null : parseInt(e.target.value))}
                          className="w-full px-3 py-2 border rounded">
                          <option value="">بدون انتخاب</option>
                          {addressInputs.map((addr, addrIndex) => (
                            <option key={addrIndex} value={addrIndex}>{addr.title || `آدرس ${addrIndex + 1}`}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">توضیحات</label>
                        <textarea value={contact.notes}
                          onChange={(e) => updateDeliveryContact(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border rounded" rows={2} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-lg">
                  ذخیره
                </button>
                <button type="button" onClick={handleCloseForm}
                  className="bg-gray-300 px-6 py-2 rounded-lg">
                  انصراف
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Loading Indicator */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
            <span>در حال بارگذاری مراکز...</span>
          </div>
        )}

        {/* آمار مراکز */}
        {!loading && centers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-gray-800">{centers.length}</div>
              <div className="text-sm text-gray-600">کل مراکز</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-blue-600">
                {centers.filter((c: any) => c.type === 'lead').length}
              </div>
              <div className="text-sm text-gray-600">سرنخ</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-green-600">
                {centers.filter((c: any) => c.type === 'customer' || c.type === 'old_customer').length}
              </div>
              <div className="text-sm text-gray-600">مشتری</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-orange-600">
                {centers.filter((c: any) => !c.address || !c.city).length}
              </div>
              <div className="text-sm text-gray-600">ناقص اطلاعات</div>
            </div>
          </div>
        )}

        {/* فیلترها و جستجو */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">جستجو</label>
              <input
                type="text"
                placeholder="نام یا آدرس..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">استان</label>
              <select
                value={filterProvince}
                onChange={(e) => setFilterProvince(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">همه استان‌ها</option>
                {Array.from(new Set(centers
                  .map((c: any) => c.city)
                  .filter((city: string) => city && city.trim() !== '')))
                  .sort()
                  .map((city: string) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">نوع</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">همه انواع</option>
                <option value="lead">سرنخ</option>
                <option value="opportunity">فرصت</option>
                <option value="customer">مشتری</option>
                <option value="old_customer">مشتری قدیمی</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">مسئول</label>
              <select
                value={filterResponsible}
                onChange={(e) => setFilterResponsible(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">همه مسئولان</option>
                <option value="none">بدون مسئول</option>
                {personnel.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIncomplete}
                  onChange={(e) => setShowIncomplete(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">فقط ناقص‌ها</span>
              </label>
            </div>
          </div>
          {(searchQuery || filterProvince || filterType || filterResponsible || showIncomplete) && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterProvince('')
                  setFilterType('')
                  setFilterResponsible('')
                  setShowIncomplete(false)
                }}
                className="text-sm text-red-600 hover:underline"
              >
                پاک کردن فیلترها
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium text-yellow-800">
                {selectedCenters.size} مرکز انتخاب شده
              </span>
              <button
                onClick={() => {
                  setSelectedCenters(new Set())
                  setShowBulkActions(false)
                }}
                className="text-sm text-red-600 hover:underline"
              >
                لغو انتخاب
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">تغییر نوع:</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdateType(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">انتخاب نوع...</option>
                  <option value="lead">سرنخ</option>
                  <option value="opportunity">فرصت</option>
                  <option value="customer">مشتری</option>
                  <option value="old_customer">قدیمی</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">تغییر مسئول:</label>
                <select
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      handleBulkUpdateResponsible(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">انتخاب مسئول...</option>
                  <option value="">بدون مسئول</option>
                  {personnel.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">جابجایی بر اساس استان:</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssignByProvince(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">انتخاب استان...</option>
                  {Array.from(new Set(centers.map((c: any) => c.province).filter(Boolean))).map((province: string) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleBulkDelete}
                  className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
                >
                  حذف انتخاب شده‌ها
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Map View */}
        {showMap && centers.some((c: any) => c.latitude && c.longitude) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">نمایش روی نقشه</h2>
            <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-600 mb-4">نقشه تعاملی</p>
                <p className="text-sm text-gray-500">
                  {centers.filter((c: any) => c.latitude && c.longitude).length} مرکز با مختصات جغرافیایی
                </p>
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {centers.filter((c: any) => c.latitude && c.longitude).map((c: any) => (
                    <div key={c._id || c.id} className="text-sm text-gray-700 p-2 bg-white rounded border">
                      <strong>{c.name}</strong> - {c.city || '-'}
                      <br />
                      <a
                        href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        📍 مشاهده در Google Maps
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Centers Display */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(() => {
              const filteredCenters = getFilteredCenters()
              
              if (filteredCenters.length === 0 && !loading) {
                return (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500 text-lg">هیچ مرکزی یافت نشد</p>
                  </div>
                )
              }
              
              return filteredCenters.map((c: any) => {
                const getTypeBadge = (type: string) => {
                  const badges: any = {
                    'lead': { text: 'سرنخ', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                    'opportunity': { text: 'فرصت', color: 'bg-green-100 text-green-800 border-green-300' },
                    'customer': { text: 'مشتری', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                    'old_customer': { text: 'قدیمی', color: 'bg-orange-100 text-orange-800 border-orange-300' }
                  }
                  return badges[type] || badges['lead']
                }
                
                const centerId = (c._id || c.id).toString()
                const isSelected = selectedCenters.has(centerId)
                const badge = getTypeBadge(c.type || 'lead')
                const primaryPhone = Array.isArray(c.phones) && c.phones.length > 0 
                  ? c.phones.find((p: any) => p.isPrimary) || c.phones[0]
                  : null
                
                return (
                  <div
                    key={centerId}
                    className={`
                      bg-white rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl
                      ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                    `}
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{c.name}</h3>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                            {badge.text}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectCenter(centerId)}
                          className="w-5 h-5 cursor-pointer flex-shrink-0"
                        />
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      {/* آدرس */}
                      {c.address && (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-400 mt-1">📍</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-600 line-clamp-2">{c.address}</p>
                            {(c.city || c.province) && (
                              <p className="text-xs text-gray-500 mt-1">
                                {[c.city, c.province].filter(Boolean).join('، ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* تماس */}
                      {primaryPhone && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📞</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">
                              {primaryPhone.phone}
                              {primaryPhone.extension && ` (داخلی ${primaryPhone.extension})`}
                            </p>
                            {primaryPhone.label && (
                              <p className="text-xs text-gray-500">{primaryPhone.label}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {c.mobile && !primaryPhone && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📱</span>
                          <p className="text-sm text-gray-700">{c.mobile}</p>
                        </div>
                      )}
                      
                      {/* مسئول */}
                      {c.responsiblePersonnelName && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">👤</span>
                          <p className="text-sm text-gray-700 font-medium">{c.responsiblePersonnelName}</p>
                        </div>
                      )}
                      
                      {/* اطلاعات مالی */}
                      {(c.financial_credit || c.credit_rating) && (
                        <div className="pt-2 border-t border-gray-100">
                          {c.financial_credit && (
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-500">اعتبار مالی:</span>
                              <span className="font-semibold text-green-600">
                                {c.financial_credit.toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                          )}
                          {c.credit_rating && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">رتبه اعتباری:</span>
                              <span className="font-semibold text-blue-600">{c.credit_rating}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* هشدار اطلاعات ناقص */}
                      {(!c.address || !c.city) && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded-lg">
                          <span>⚠️</span>
                          <p className="text-xs">اطلاعات ناقص</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Card Footer */}
                    <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedCenterDetail(c)
                            setShowDetailModal(true)
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          مشاهده جزئیات
                        </button>
                        <button
                          onClick={() => handleOpenForm(c)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => handleDelete(centerId)}
                          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        ) : (
          <>
            {/* Pagination Controls - Top */}
            <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <span>📋</span>
                    <span>تعداد در هر صفحه:</span>
                  </label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-semibold shadow-sm hover:border-blue-400 transition-all cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                    <span className="text-sm font-semibold text-blue-700">
                      نمایش {(() => {
                        const paginated = getPaginatedCenters()
                        const start = (currentPage - 1) * itemsPerPage + 1
                        const end = Math.min(currentPage * itemsPerPage, paginated.total)
                        return `${start}-${end} از ${paginated.total}`
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-semibold">📊</span>
                  <span>
                    کل مراکز: <span className="font-bold text-blue-600">{getFilteredCenters().length}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">
                    <tr>
                      <th className="px-6 py-5 text-right w-12">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const paginated = getPaginatedCenters()
                            return paginated.data.length > 0 && 
                                   paginated.data.every((c: any) => selectedCenters.has((c._id || c.id).toString()))
                          })()}
                          onChange={() => {
                            const paginated = getPaginatedCenters()
                            const allSelected = paginated.data.every((c: any) => selectedCenters.has((c._id || c.id).toString()))
                            if (allSelected) {
                              const newSelected = new Set(selectedCenters)
                              paginated.data.forEach((c: any) => newSelected.delete((c._id || c.id).toString()))
                              setSelectedCenters(newSelected)
                            } else {
                              const newSelected = new Set(selectedCenters)
                              paginated.data.forEach((c: any) => newSelected.add((c._id || c.id).toString()))
                              setSelectedCenters(newSelected)
                            }
                            setShowBulkActions(selectedCenters.size > 0)
                          }}
                          className="w-5 h-5 cursor-pointer text-white rounded focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                        />
                      </th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">نام مرکز</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">نوع</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">آدرس</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">شهر / استان</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">مسئول</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">تماس</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">ایمیل / وب‌سایت</th>
                      <th className="px-6 py-5 text-right text-sm font-bold text-white">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const paginated = getPaginatedCenters()
                      
                      return paginated.data.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <span className="text-4xl">📭</span>
                              </div>
                              <p className="text-gray-500 text-lg font-medium">هیچ مرکزی یافت نشد</p>
                              <p className="text-gray-400 text-sm mt-2">لطفاً فیلترهای جستجو را تغییر دهید</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginated.data.map((c: any, index: number) => {
                          const getTypeBadge = (type: string) => {
                            const badges: any = {
                              'lead': { text: 'سرنخ', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵' },
                              'opportunity': { text: 'فرصت', color: 'bg-green-100 text-green-800 border-green-200', icon: '🟢' },
                              'customer': { text: 'مشتری', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡' },
                              'old_customer': { text: 'قدیمی', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🟠' }
                            }
                            return badges[type] || badges['lead']
                          }
                          
                          const centerId = (c._id || c.id).toString()
                          const isSelected = selectedCenters.has(centerId)
                          const badge = getTypeBadge(c.type || 'lead')
                          const primaryPhone = Array.isArray(c.phones) && c.phones.length > 0 
                            ? c.phones.find((p: any) => p.isPrimary) || c.phones[0]
                            : null
                          
                          return (
                            <tr 
                              key={centerId} 
                              className={`
                                transition-all duration-200 ease-in-out
                                ${isSelected 
                                  ? 'bg-blue-50 border-r-4 border-blue-500 shadow-sm' 
                                  : 'bg-white hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent hover:shadow-md'
                                }
                                ${index % 2 === 0 ? '' : 'bg-gray-50/30'}
                                border-b border-gray-100
                              `}
                            >
                              <td className="px-6 py-5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectCenter(centerId)}
                                  className="w-5 h-5 cursor-pointer text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
                                />
                              </td>
                              <td className="px-6 py-5">
                                <Link
                                  href={`/centers/${centerId}`}
                                  className="font-bold text-gray-900 hover:text-blue-600 transition-colors inline-flex items-center gap-2 group"
                                >
                                  <span className="group-hover:underline">{c.name}</span>
                                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              </td>
                              <td className="px-6 py-5">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 shadow-sm ${badge.color}`}>
                                  <span>{badge.icon}</span>
                                  <span>{badge.text}</span>
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="max-w-xs">
                                  {c.address ? (
                                    <p className="text-sm text-gray-700 truncate font-medium" title={c.address}>
                                      📍 {c.address}
                                    </p>
                                  ) : (
                                    <span className="text-gray-400 text-sm flex items-center gap-1">
                                      <span>⚠️</span>
                                      <span>ندارد</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="text-sm">
                                  {c.city && (
                                    <p className="text-gray-900 font-semibold flex items-center gap-1">
                                      <span>🏙️</span>
                                      <span>{c.city}</span>
                                    </p>
                                  )}
                                  {c.province && (
                                    <p className="text-gray-600 text-xs mt-1 flex items-center gap-1">
                                      <span>🗺️</span>
                                      <span>{c.province}</span>
                                    </p>
                                  )}
                                  {!c.city && !c.province && (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                {c.responsiblePersonnelName ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-200 shadow-sm">
                                    <span>👤</span>
                                    <span>{c.responsiblePersonnelName}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-sm flex items-center gap-1">
                                    <span>❌</span>
                                    <span>بدون مسئول</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                {primaryPhone ? (
                                  <div className="text-sm">
                                    <p className="text-gray-900 font-semibold flex items-center gap-1">
                                      <span>📞</span>
                                      <span>{primaryPhone.phone}</span>
                                    </p>
                                    {primaryPhone.label && (
                                      <p className="text-gray-500 text-xs mt-1">{primaryPhone.label}</p>
                                    )}
                                  </div>
                                ) : c.mobile ? (
                                  <p className="text-sm text-gray-900 font-semibold flex items-center gap-1">
                                    <span>📱</span>
                                    <span>{c.mobile}</span>
                                  </p>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                  {c.email && (
                                    <a 
                                      href={`mailto:${c.email}`}
                                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                      title={c.email}
                                    >
                                      <span>✉️</span>
                                      <span className="truncate max-w-[120px]">{c.email}</span>
                                    </a>
                                  )}
                                  {c.website && (
                                    <a 
                                      href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                      title={c.website}
                                    >
                                      <span>🌐</span>
                                      <span className="truncate max-w-[120px]">{c.website}</span>
                                    </a>
                                  )}
                                  {!c.email && !c.website && (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/centers/${centerId}`}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md transform hover:scale-105"
                                  >
                                    👁️ مشاهده
                                  </Link>
                                  <button
                                    onClick={() => handleOpenForm(c)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md transform hover:scale-105"
                                  >
                                    ✏️ ویرایش
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls - Bottom */}
            {(() => {
              const paginated = getPaginatedCenters()
              if (paginated.totalPages <= 1) return null
              
              const pages = []
              const maxVisible = 7
              let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
              let endPage = Math.min(paginated.totalPages, startPage + maxVisible - 1)
              
              if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(1, endPage - maxVisible + 1)
              }
              
              for (let i = startPage; i <= endPage; i++) {
                pages.push(i)
              }
              
              const start = (currentPage - 1) * itemsPerPage + 1
              const end = Math.min(currentPage * itemsPerPage, paginated.total)
              
              return (
                <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 mt-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Info Section */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                        <span className="font-semibold text-blue-700">📊</span>
                        <span className="font-medium">
                          نمایش <span className="text-blue-600 font-bold">{start}</span> تا <span className="text-blue-600 font-bold">{end}</span> از <span className="text-blue-600 font-bold">{paginated.total}</span> مرکز
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                        <span className="font-semibold">📄</span>
                        <span className="font-medium">
                          صفحه <span className="text-gray-700 font-bold">{currentPage}</span> از <span className="text-gray-700 font-bold">{paginated.totalPages}</span>
                        </span>
                      </div>
                    </div>
                    
                    {/* Pagination Buttons */}
                    <div className="flex items-center gap-2">
                      {/* First & Previous */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm disabled:shadow-none"
                          title="صفحه اول"
                        >
                          ⏮️
                        </button>
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm disabled:shadow-none"
                          title="صفحه قبلی"
                        >
                          ⬅️ قبلی
                        </button>
                      </div>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {startPage > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentPage(1)}
                              className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm"
                            >
                              1
                            </button>
                            {startPage > 2 && (
                              <span className="px-2 text-gray-400 font-bold">...</span>
                            )}
                          </>
                        )}
                        {pages.map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`
                              px-4 py-2 rounded-lg transition-all font-bold shadow-sm min-w-[44px]
                              ${currentPage === page
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-2 border-blue-700 shadow-md transform scale-105'
                                : 'bg-white border-2 border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600'
                              }
                            `}
                          >
                            {page}
                          </button>
                        ))}
                        {endPage < paginated.totalPages && (
                          <>
                            {endPage < paginated.totalPages - 1 && (
                              <span className="px-2 text-gray-400 font-bold">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(paginated.totalPages)}
                              className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm"
                            >
                              {paginated.totalPages}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Next & Last */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === paginated.totalPages}
                          className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm disabled:shadow-none"
                          title="صفحه بعدی"
                        >
                          بعدی ➡️
                        </button>
                        <button
                          onClick={() => setCurrentPage(paginated.totalPages)}
                          disabled={currentPage === paginated.totalPages}
                          className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all font-semibold shadow-sm disabled:shadow-none"
                          title="صفحه آخر"
                        >
                          ⏭️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}
        
        {/* Detail Modal */}
        {showDetailModal && selectedCenterDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetailModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">{selectedCenterDetail.name}</h2>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-white hover:text-gray-200 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* اطلاعات پایه */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">نوع مرکز</label>
                    <p className="text-gray-900 font-semibold">
                      {selectedCenterDetail.type === 'lead' ? 'سرنخ' : 
                       selectedCenterDetail.type === 'opportunity' ? 'فرصت' : 
                       selectedCenterDetail.type === 'customer' ? 'مشتری' : 'قدیمی'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">نوع مشتری</label>
                    <p className="text-gray-900">{selectedCenterDetail.customerType === 'legal' ? 'حقوقی' : 'حقیقی'}</p>
                  </div>
                  {selectedCenterDetail.legal_type && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">نوع حقوقی</label>
                      <p className="text-gray-900">{selectedCenterDetail.legal_type}</p>
                    </div>
                  )}
                  {selectedCenterDetail.responsiblePersonnelName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">مسئول</label>
                      <p className="text-gray-900 font-semibold">{selectedCenterDetail.responsiblePersonnelName}</p>
                    </div>
                  )}
                  {selectedCenterDetail.sourceName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">نحوه آشنایی</label>
                      <p className="text-gray-900">{selectedCenterDetail.sourceName}</p>
                    </div>
                  )}
                </div>
                
                {/* آدرس‌ها */}
                {Array.isArray(selectedCenterDetail.addresses) && selectedCenterDetail.addresses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">آدرس‌ها</h3>
                    <div className="space-y-3">
                      {selectedCenterDetail.addresses.map((addr: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{addr.title || `آدرس ${idx + 1}`}</h4>
                            {addr.latitude && addr.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                📍 نقشه
                              </a>
                            )}
                          </div>
                          <p className="text-gray-700 mb-2">{addr.addressLine}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            {addr.city && <span>شهر: {addr.city}</span>}
                            {addr.province && <span>استان: {addr.province}</span>}
                            {addr.district && <span>منطقه: {addr.district}</span>}
                            {addr.postalCode && <span>کد پستی: {addr.postalCode}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* شماره تلفن‌ها */}
                {Array.isArray(selectedCenterDetail.phones) && selectedCenterDetail.phones.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">شماره تماس‌ها</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedCenterDetail.phones.map((phone: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{phone.phone}</p>
                              {phone.label && <p className="text-sm text-gray-600">{phone.label}</p>}
                              {phone.extension && <p className="text-xs text-gray-500">داخلی: {phone.extension}</p>}
                            </div>
                            {phone.isPrimary && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">اصلی</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* اطلاعات مالی */}
                {(selectedCenterDetail.financial_credit || selectedCenterDetail.credit_rating || selectedCenterDetail.economic_code || selectedCenterDetail.national_id) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">اطلاعات مالی</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                      {selectedCenterDetail.financial_credit && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">اعتبار مالی</label>
                          <p className="text-lg font-bold text-green-600">
                            {selectedCenterDetail.financial_credit.toLocaleString('fa-IR')} تومان
                          </p>
                        </div>
                      )}
                      {selectedCenterDetail.credit_rating && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">رتبه اعتباری</label>
                          <p className="text-lg font-bold text-blue-600">{selectedCenterDetail.credit_rating}</p>
                        </div>
                      )}
                      {selectedCenterDetail.economic_code && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">کد اقتصادی</label>
                          <p className="text-gray-900">{selectedCenterDetail.economic_code}</p>
                        </div>
                      )}
                      {selectedCenterDetail.national_id && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">کد ملی / شناسه</label>
                          <p className="text-gray-900">{selectedCenterDetail.national_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* سایر اطلاعات */}
                {(selectedCenterDetail.description || selectedCenterDetail.website || selectedCenterDetail.mobile) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">سایر اطلاعات</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      {selectedCenterDetail.website && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">وب‌سایت</label>
                          <a href={selectedCenterDetail.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">
                            {selectedCenterDetail.website}
                          </a>
                        </div>
                      )}
                      {selectedCenterDetail.mobile && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">موبایل</label>
                          <p className="text-gray-900">{selectedCenterDetail.mobile}</p>
                        </div>
                      )}
                      {selectedCenterDetail.description && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">توضیحات</label>
                          <p className="text-gray-900 whitespace-pre-wrap">{selectedCenterDetail.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* دکمه‌های عملیات */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowDetailModal(false)
                      handleOpenForm(selectedCenterDetail)
                    }}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    ویرایش مرکز
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
