'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getWorkflowBoard, moveWorkflowCard, createWorkflowCard, updateWorkflowCard, getCenters, getWorkflowCardReports, createWorkflowCardReport, getPersonnel, getAssignments, getContacts } from '../lib/api'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import PersianDateTimePicker from '../components/PersianDateTimePicker'
import { useAuth } from '../contexts/AuthContext'
import { 
  Search, Filter, Columns, List, Calendar, Grid, 
  CheckSquare, X, MoreVertical, Download, RefreshCw,
  User, MapPin, Clock, Tag, ArrowUpDown, Trash2
} from 'lucide-react'
import { toPersianDate } from '../lib/dateUtils'

interface WorkflowList {
  id: number
  boardId: number
  key: string
  title: string
  position: number
  statusCategory: string
  isDefault: number
  meta?: any
  createdAt: string
  updatedAt: string
}

interface WorkflowCard {
  id: number
  boardId: number
  listId: number
  entityType?: string | null
  entityId: number | null
  centerId: number | null
  title: string
  description?: string | null
  notes?: string | null
  status: string
  priority: string
  assigneeId?: number | null
  dueDate?: string | null
  reminderAt?: string | null
  tags: string[]
  meta?: any
  createdAt: string
  updatedAt: string
  listTitle?: string
  listKey?: string
  center?: { id: number; name: string; city?: string | null; province?: string | null } | null
  assignee?: { id: number; name: string; role?: string | null } | null
}

interface WorkflowBoard {
  id: number
  slug: string
  name: string
  description?: string | null
  scope: string
  centerFilter?: string | null
  typeFilter?: string | null
  isActive: number
  meta?: any
  createdAt: string
  updatedAt: string
  lists?: WorkflowList[]
  cards?: WorkflowCard[]
}

// Use personal board slug based on user ID
const getPersonalBoardSlug = (userId?: number) => {
  return userId ? `user-${userId}` : 'ops-master'
}
const MAX_REPORT_FILES = Number(process.env.NEXT_PUBLIC_REPORT_ATTACHMENT_MAX_COUNT || 5)
const MAX_REPORT_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_REPORT_ATTACHMENT_MAX_SIZE_MB || 10)
const MAX_REPORT_FILE_SIZE_BYTES = MAX_REPORT_FILE_SIZE_MB * 1024 * 1024

const formatFileSize = (size?: number | null) => {
  if (typeof size !== 'number' || size <= 0) return ''
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function WorkflowPage() {
  const { user } = useAuth()
  const [board, setBoard] = useState<WorkflowBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingCardId, setMovingCardId] = useState<number | null>(null)
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'mission' | 'contact'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'normal' | 'low'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<number | 'all' | 'unassigned'>('all')
  const [centerFilter, setCenterFilter] = useState<number | 'all'>('all')
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'today' | 'thisWeek' | 'upcoming'>('all')
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'timeline'>('kanban')
  const [sortBy, setSortBy] = useState<'created' | 'dueDate' | 'priority' | 'title'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [cards, setCards] = useState<WorkflowCard[]>([])
  const [activeCardId, setActiveCardId] = useState<number | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [editingCard, setEditingCard] = useState<WorkflowCard | null>(null)
  const [newCardListId, setNewCardListId] = useState<number | null>(null)
  const [centers, setCenters] = useState<any[]>([])
  const [personnelList, setPersonnelList] = useState<any[]>([])
  const [loadingCenters, setLoadingCenters] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const loadBoard = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true)
    }
    setError(null)
    try {
      // Use personal board for the current user
      const boardSlug = getPersonalBoardSlug(user?.id)
      const response = await getWorkflowBoard(boardSlug, { includeCards: true })
      setBoard(response.board)
      setCards(response.board?.cards || [])
    } catch (err: any) {
      console.error('Workflow board load failed', err)
      setError(err?.message || 'خطا در دریافت برد کانبان')
    } finally {
      if (!options.silent) {
        setLoading(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    loadBoard()
  }, [loadBoard, refreshSeed])

  const loadCenters = useCallback(async () => {
    if (centers.length > 0) return
    setLoadingCenters(true)
    try {
      const data = await getCenters()
      const centersArray = Array.isArray(data) ? data : (data?.data || [])
      setCenters(centersArray)
    } catch (err) {
      console.error('Failed to load centers', err)
    } finally {
      setLoadingCenters(false)
    }
  }, [centers.length])

  const loadPersonnel = useCallback(async () => {
    if (personnelList.length > 0) return
    try {
      const data = await getPersonnel()
      setPersonnelList(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load personnel', err)
    }
  }, [personnelList.length])

  useEffect(() => {
    loadPersonnel()
  }, [loadPersonnel])

  const lists = useMemo(() => board?.lists || [], [board?.id])
  const listsMap = useMemo(() => {
    const map = new Map<number, WorkflowList>()
    lists.forEach((list) => {
      map.set(list.id, list)
    })
    return map
  }, [board?.id])

  const activeCard = useMemo(() => {
    if (!activeCardId) return null
    return cards.find((card) => card.id === activeCardId) || null
  }, [cards, activeCardId])

  const filteredCards = useMemo(() => {
    let filtered = cards.filter((card) => {
      // Type filter
      if (typeFilter !== 'all' && card.entityType !== typeFilter) {
        return false
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && card.priority !== priorityFilter) {
        return false
      }
      
      // Assignee filter
      if (assigneeFilter === 'unassigned' && card.assigneeId) {
        return false
      }
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && card.assigneeId !== assigneeFilter) {
        return false
      }
      
      // Center filter
      if (centerFilter !== 'all' && card.centerId !== centerFilter) {
        return false
      }
      
      // Due date filter
      if (dueDateFilter !== 'all' && card.dueDate) {
        const dueDate = new Date(card.dueDate)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        
        if (dueDateFilter === 'overdue' && dueDate >= today) {
          return false
        }
        if (dueDateFilter === 'today' && (dueDate < today || dueDate >= new Date(today.getTime() + 24 * 60 * 60 * 1000))) {
          return false
        }
        if (dueDateFilter === 'thisWeek' && (dueDate < today || dueDate >= weekFromNow)) {
          return false
        }
        if (dueDateFilter === 'upcoming' && dueDate < weekFromNow) {
          return false
        }
      }
      
      // Search filter
      if (searchTerm.trim()) {
        const haystack = `${card.title} ${card.description || ''} ${card.center?.name || ''} ${card.meta?.personnelName || ''}`.toLowerCase()
        if (!haystack.includes(searchTerm.trim().toLowerCase())) {
          return false
        }
      }
      
      return true
    })
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'created':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0
          break
        case 'priority':
          const priorityOrder = { high: 3, normal: 2, low: 1 }
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        default:
          return 0
      }
      
      if (sortBy === 'title') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })
    
    return filtered
  }, [cards, typeFilter, priorityFilter, assigneeFilter, centerFilter, dueDateFilter, searchTerm, sortBy, sortOrder])

  // Calculate stats - must be after filteredCards definition
  const stats = useMemo(() => {
    const newStats = {
      total: filteredCards.length,
      byPriority: { high: 0, normal: 0, low: 0 },
      byStatus: {} as Record<string, number>,
      overdue: 0
    }
    
    filteredCards.forEach(card => {
      // Priority stats
      if (card.priority === 'high') newStats.byPriority.high++
      else if (card.priority === 'normal') newStats.byPriority.normal++
      else if (card.priority === 'low') newStats.byPriority.low++
      
      // Status stats - use listsMap
      const listTitle = listsMap.get(card.listId)?.title || 'نامشخص'
      newStats.byStatus[listTitle] = (newStats.byStatus[listTitle] || 0) + 1
      
      // Overdue
      if (card.dueDate && new Date(card.dueDate) < new Date() && card.status !== 'completed') {
        newStats.overdue++
      }
    })
    
    return newStats
  }, [filteredCards, listsMap])

  // Check URL for cardId parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const cardId = params.get('cardId')
      if (cardId) {
        setTimeout(() => {
          const element = document.getElementById(`card-${cardId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-75')
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-75')
            }, 3000)
          }
        }, 500)
      }
    }
  }, [cards])

  const groupedCards = useMemo(() => {
    const groups: Record<number, WorkflowCard[]> = {}
    lists.forEach((list) => {
      groups[list.id] = []
    })
    filteredCards.forEach((card) => {
      if (!groups[card.listId]) {
        groups[card.listId] = []
      }
      groups[card.listId].push(card)
    })
    Object.values(groups).forEach((listCards) => {
      listCards.sort((a, b) => {
        // اولویت: کارت‌های با dueDate یا reminderAt
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : (a.reminderAt ? new Date(a.reminderAt).getTime() : null)
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : (b.reminderAt ? new Date(b.reminderAt).getTime() : null)
        
        // کارت‌های بدون تاریخ در انتها
        if (!aDate && !bDate) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        }
        if (!aDate) return 1
        if (!bDate) return -1
        
        // سورت بر اساس تاریخ (زودتر = اول)
        return aDate - bDate
      })
    })
    return groups
  }, [filteredCards, lists])

  const handleMoveCard = async (cardId: number, listId: number) => {
    if (!board || movingCardId === cardId) {
      return
    }
    setMovingCardId(cardId)
    setError(null)
    try {
      await moveWorkflowCard(cardId, listId)
      await loadBoard({ silent: true })
    } catch (err: any) {
      console.error('Workflow move failed', err)
      setError(err?.message || 'جابجایی کارت انجام نشد')
    } finally {
      setMovingCardId(null)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = event.active?.data?.current?.cardId
    if (cardId) {
      setActiveCardId(cardId)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCardId(null)
    const cardId = event.active?.data?.current?.cardId
    const sourceListId = event.active?.data?.current?.listId
    const overListId = event.over?.data?.current?.listId

    if (!cardId || !overListId || overListId === sourceListId) {
      return
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              listId: overListId,
              listTitle: listsMap.get(overListId)?.title || card.listTitle,
              listKey: listsMap.get(overListId)?.key || card.listKey
            }
          : card
      )
    )

    await handleMoveCard(cardId, overListId)
  }

  const handleDragCancel = () => {
    setActiveCardId(null)
  }

  const renderCardContent = (card: WorkflowCard, highlight = false) => (
    <div
      id={`card-${card.id}`}
      className={`rounded-lg border bg-white p-4 shadow-sm space-y-3 transition-all cursor-pointer hover:shadow-md ${highlight ? 'ring-4 ring-blue-500 ring-opacity-75' : ''}`}
      style={{ backgroundColor: 'var(--card-bg, white)', borderColor: 'var(--border-color, #e5e7eb)' }}
      onClick={() => {
        setEditingCard(card)
        setShowCardModal(true)
        loadCenters()
      }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-base mb-1">{card.title}</h4>
          {card.center?.name && (
            <p className="text-sm text-gray-500">
              مرکز: {card.center.name}
              {card.center.city ? ` (${card.center.city})` : ''}
            </p>
          )}
        </div>
        <span className="text-xs text-white rounded-full px-2 py-1 bg-blue-600 flex-shrink-0">
          {card.entityType === 'mission' ? 'ماموریت' : card.entityType === 'contact' ? 'تماس' : card.entityType || 'کار'}
        </span>
      </div>
      {card.description && (
        <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-2">{card.description}</p>
      )}
      {(card.dueDate || card.reminderAt) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {card.dueDate && (
            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">
              📅 {new Date(card.dueDate).toLocaleDateString('fa-IR')}
            </span>
          )}
          {card.reminderAt && (
            <span className="px-2 py-1 rounded bg-orange-100 text-orange-800">
              ⏰ {new Date(card.reminderAt).toLocaleDateString('fa-IR')}
            </span>
          )}
        </div>
      )}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-500">
        آخرین تغییر: {new Date(card.updatedAt).toLocaleString('fa-IR')}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری برد عملیات...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => setRefreshSeed((seed) => seed + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">بردی یافت نشد.</p>
          <button
            onClick={() => setRefreshSeed((seed) => seed + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    )
  }

  const handleBulkMove = async (targetListId: number) => {
    if (selectedCards.size === 0) return
    
    try {
      const promises = Array.from(selectedCards).map(cardId => {
        const card = cards.find(c => c.id === cardId)
        if (!card) return Promise.resolve()
        return moveWorkflowCard(cardId, targetListId)
      })
      
      await Promise.all(promises)
      setSelectedCards(new Set())
      setShowBulkActions(false)
      setRefreshSeed(seed => seed + 1)
    } catch (error) {
      console.error('Error in bulk move:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0 || !confirm(`آیا مطمئن هستید که می‌خواهید ${selectedCards.size} کارت را حذف کنید؟`)) {
      return
    }
    
    // Note: Delete functionality needs to be added to API
    setSelectedCards(new Set())
    setShowBulkActions(false)
  }

  const toggleCardSelection = (cardId: number) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId)
    } else {
      newSelected.add(cardId)
    }
    setSelectedCards(newSelected)
    setShowBulkActions(newSelected.size > 0)
  }

  const selectAllCards = () => {
    if (selectedCards.size === filteredCards.length) {
      setSelectedCards(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedCards(new Set(filteredCards.map(c => c.id)))
      setShowBulkActions(true)
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">{board.name}</h2>
            <p className="text-sm opacity-90">{board.description}</p>
          </div>
          <button
            onClick={() => setRefreshSeed((seed) => seed + 1)}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 flex items-center gap-2"
          >
            <RefreshCw size={18} />
            بروزرسانی
          </button>
        </div>
        
        {/* Stats as Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <button
            onClick={() => {
              // Reset all filters except search
              setTypeFilter('all')
              setPriorityFilter('all')
              setAssigneeFilter('all')
              setCenterFilter('all')
              setDueDateFilter('all')
            }}
            className={`bg-white/10 rounded-lg p-3 backdrop-blur hover:bg-white/20 transition-colors text-right ${
              priorityFilter === 'all' && typeFilter === 'all' && assigneeFilter === 'all' && centerFilter === 'all' && dueDateFilter === 'all'
                ? 'ring-2 ring-white ring-opacity-50' : ''
            }`}
          >
            <div className="text-sm opacity-90">کل کارت‌ها</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </button>
          <button
            onClick={() => {
              setPriorityFilter(priorityFilter === 'high' ? 'all' : 'high')
            }}
            className={`bg-white/10 rounded-lg p-3 backdrop-blur hover:bg-white/20 transition-colors text-right ${
              priorityFilter === 'high' ? 'ring-2 ring-white ring-opacity-50' : ''
            }`}
          >
            <div className="text-sm opacity-90">اولویت بالا</div>
            <div className="text-2xl font-bold text-red-200">{stats.byPriority.high}</div>
          </button>
          <button
            onClick={() => {
              setPriorityFilter(priorityFilter === 'normal' ? 'all' : 'normal')
            }}
            className={`bg-white/10 rounded-lg p-3 backdrop-blur hover:bg-white/20 transition-colors text-right ${
              priorityFilter === 'normal' ? 'ring-2 ring-white ring-opacity-50' : ''
            }`}
          >
            <div className="text-sm opacity-90">اولویت عادی</div>
            <div className="text-2xl font-bold text-yellow-200">{stats.byPriority.normal}</div>
          </button>
          <button
            onClick={() => {
              setPriorityFilter(priorityFilter === 'low' ? 'all' : 'low')
            }}
            className={`bg-white/10 rounded-lg p-3 backdrop-blur hover:bg-white/20 transition-colors text-right ${
              priorityFilter === 'low' ? 'ring-2 ring-white ring-opacity-50' : ''
            }`}
          >
            <div className="text-sm opacity-90">اولویت پایین</div>
            <div className="text-2xl font-bold text-green-200">{stats.byPriority.low}</div>
          </button>
          <button
            onClick={() => {
              setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')
            }}
            className={`bg-white/10 rounded-lg p-3 backdrop-blur hover:bg-white/20 transition-colors text-right ${
              dueDateFilter === 'overdue' ? 'ring-2 ring-white ring-opacity-50' : ''
            }`}
          >
            <div className="text-sm opacity-90">گذشته از موعد</div>
            <div className="text-2xl font-bold text-red-300">{stats.overdue}</div>
          </button>
        </div>
      </div>

      {/* Advanced Filters and View Controls */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="جستجو (نام مرکز، توضیح...)"
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-white shadow' : ''}`}
              title="نمایش کانبان"
            >
              <Columns size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              title="نمایش لیست"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded ${viewMode === 'timeline' ? 'bg-white shadow' : ''}`}
              title="نمایش تایم‌لاین"
            >
              <Calendar size={18} />
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'mission' | 'contact')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">همه انواع</option>
            <option value="mission">ماموریت</option>
            <option value="contact">تماس</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">همه اولویت‌ها</option>
            <option value="high">اولویت بالا</option>
            <option value="normal">اولویت عادی</option>
            <option value="low">اولویت پایین</option>
          </select>

          <select
            value={assigneeFilter}
            onChange={(event) => {
              const value = event.target.value
              setAssigneeFilter(value === 'all' ? 'all' : value === 'unassigned' ? 'unassigned' : parseInt(value))
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">همه افراد</option>
            <option value="unassigned">بدون مسئول</option>
            {personnelList.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={centerFilter}
            onChange={(event) => {
              const value = event.target.value
              setCenterFilter(value === 'all' ? 'all' : parseInt(value))
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">همه مراکز</option>
            {centers.slice(0, 50).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={dueDateFilter}
            onChange={(event) => setDueDateFilter(event.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">همه تاریخ‌ها</option>
            <option value="overdue">گذشته از موعد</option>
            <option value="today">امروز</option>
            <option value="thisWeek">این هفته</option>
            <option value="upcoming">آینده</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as any)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="created">تاریخ ایجاد</option>
              <option value="dueDate">تاریخ سررسید</option>
              <option value="priority">اولویت</option>
              <option value="title">عنوان</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title={sortOrder === 'asc' ? 'صعودی' : 'نزولی'}
            >
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && selectedCards.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedCards.size} کارت انتخاب شده
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkMove(parseInt(e.target.value))
                  }
                }}
                className="px-3 py-1 border border-blue-300 rounded text-sm"
                defaultValue=""
              >
                <option value="">انتقال به...</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.title}</option>
                ))}
              </select>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} />
                حذف
              </button>
              <button
                onClick={() => {
                  setSelectedCards(new Set())
                  setShowBulkActions(false)
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Content */}
      {viewMode === 'kanban' && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {lists.map((list) => (
              <KanbanColumn 
                key={list.id} 
                list={list}
                onAddCard={() => {
                  setNewCardListId(list.id)
                  setEditingCard(null)
                  setShowCardModal(true)
                  loadCenters()
                }}
              >
                {(groupedCards[list.id] || []).map((card) => (
                  <DraggableCard key={card.id} card={card}>
                    <div className="relative">
                      {selectedCards.has(card.id) && (
                        <div className="absolute top-2 right-2 z-10">
                          <CheckSquare className="text-blue-600 bg-white rounded" size={20} />
                        </div>
                      )}
                      <div onClick={(e) => {
                        e.stopPropagation()
                        toggleCardSelection(card.id)
                      }}>
                        {renderCardContent(card, false)}
                      </div>
                    </div>
                  </DraggableCard>
                ))}
                {(groupedCards[list.id] || []).length === 0 && (
                  <div className="text-sm text-gray-400 border border-dashed rounded-lg p-3 text-center">
                    کارتی در این ستون نیست
                  </div>
                )}
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="max-w-sm w-full">
                {renderCardContent(activeCard)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={selectAllCards}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <CheckSquare size={16} />
              {selectedCards.size === filteredCards.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
            </button>
            <span className="text-sm text-gray-600">{filteredCards.length} کارت</span>
          </div>
          <div className="space-y-2">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className={`
                  border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer
                  ${selectedCards.has(card.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                `}
                onClick={() => {
                  setEditingCard(card)
                  setShowCardModal(true)
                  loadCenters()
                }}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedCards.has(card.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleCardSelection(card.id)
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-base">{card.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {listsMap.get(card.listId)?.title} • {card.entityType === 'mission' ? 'ماموریت' : 'تماس'}
                          {card.center?.name && ` • ${card.center.name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {card.priority === 'high' && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">اولویت بالا</span>
                        )}
                        {card.dueDate && (
                          <span className={`px-2 py-1 text-xs rounded ${
                            new Date(card.dueDate) < new Date() ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {toPersianDate(new Date(card.dueDate))}
                          </span>
                        )}
                      </div>
                    </div>
                    {card.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{card.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredCards.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                هیچ کارتی یافت نشد
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="space-y-4">
            {lists.map((list) => {
              const listCards = (groupedCards[list.id] || []).filter(card => {
                if (card.dueDate) return true
                if (card.reminderAt) return true
                return false
              })
              
              if (listCards.length === 0) return null
              
              return (
                <div key={list.id} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-bold text-lg mb-3">{list.title}</h3>
                  <div className="space-y-3">
                    {listCards.map((card) => {
                      const date = card.dueDate || card.reminderAt
                      const isOverdue = date && new Date(date) < new Date()
                      
                      return (
                        <div
                          key={card.id}
                          className={`
                            border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer
                            ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}
                          `}
                          onClick={() => {
                            setEditingCard(card)
                            setShowCardModal(true)
                            loadCenters()
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className={isOverdue ? 'text-red-600' : 'text-gray-400'} />
                                <span className="text-sm font-medium text-gray-600">
                                  {date ? toPersianDate(new Date(date)) : ''}
                                </span>
                                {isOverdue && (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">گذشته از موعد</span>
                                )}
                              </div>
                              <h4 className="font-semibold text-base">{card.title}</h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {card.center?.name || 'بدون مرکز'}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                              {card.entityType === 'mission' ? 'ماموریت' : 'تماس'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {filteredCards.filter(c => !c.dueDate && !c.reminderAt).length > 0 && (
              <div className="border-l-4 border-gray-300 pl-4 mt-6">
                <h3 className="font-bold text-lg mb-3 text-gray-500">بدون تاریخ</h3>
                <div className="space-y-3">
                  {filteredCards.filter(c => !c.dueDate && !c.reminderAt).map((card) => (
                    <div
                      key={card.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setEditingCard(card)
                        setShowCardModal(true)
                        loadCenters()
                      }}
                    >
                      <h4 className="font-semibold text-base">{card.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {card.center?.name || 'بدون مرکز'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && (
        <CardModal
          card={editingCard}
          boardId={board.id}
          listId={editingCard?.listId || newCardListId}
          centers={centers}
          loadingCenters={loadingCenters}
          onClose={() => {
            setShowCardModal(false)
            setEditingCard(null)
            setNewCardListId(null)
          }}
          onSave={async (cardData) => {
            try {
              if (editingCard) {
                await updateWorkflowCard(editingCard.id, cardData)
                setShowCardModal(false)
                setEditingCard(null)
                setNewCardListId(null)
                setRefreshSeed((seed) => seed + 1)
              } else {
                // برای کارت جدید، ابتدا کارت را ایجاد می‌کنیم و سپس modal را باز نگه می‌داریم
                const result = await createWorkflowCard({
                  ...cardData,
                  boardId: board.id,
                  listId: newCardListId
                })
                // کارت جدید را به editingCard set می‌کنیم تا modal باز بماند و بتوان گزارش اضافه کرد
                setEditingCard(result.card)
                setNewCardListId(null)
                setRefreshSeed((seed) => seed + 1)
              }
            } catch (err: any) {
              alert(err?.message || 'خطا در ذخیره کارت')
            }
          }}
        />
      )}
    </div>
  )
}

const KanbanColumn: React.FC<{ list: WorkflowList; children: React.ReactNode; onAddCard: () => void }> = ({ list, children, onAddCard }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `list-${list.id}`,
    data: { listId: list.id }
  })

  return (
    <div
      ref={setNodeRef}
      className={`space-y-4 border rounded-lg p-3 transition-colors min-h-[200px] ${isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{list.title}</h3>
      </div>
      <div className="flex flex-col gap-3">
        {children}
        <button
          onClick={onAddCard}
          className="mt-2 w-full py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + افزودن کارت
        </button>
      </div>
    </div>
  )
}

const DraggableCard: React.FC<{ card: WorkflowCard; children: React.ReactNode }> = ({ card, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `card-${card.id}`,
    data: { cardId: card.id, listId: card.listId }
  })

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
      {children}
    </div>
  )
}

const CardModal: React.FC<{
  card: WorkflowCard | null
  boardId: number
  listId: number | null
  centers: any[]
  loadingCenters: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
}> = ({ card, boardId, listId, centers, loadingCenters, onClose, onSave }) => {
  const { user } = useAuth()
  const [title, setTitle] = useState(card?.title || '')
  const [description, setDescription] = useState(card?.description || '')
  const [centerId, setCenterId] = useState<number | null>(card?.centerId || null)
  const [entityType, setEntityType] = useState<'mission' | 'contact' | 'task' | null>(card?.entityType as any || 'task')
  const [dueDate, setDueDate] = useState<Date | null>(card?.dueDate ? new Date(card.dueDate) : null)
  const [reminderAt, setReminderAt] = useState<Date | null>(card?.reminderAt ? new Date(card.reminderAt) : null)
  const [saving, setSaving] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [newReportMessage, setNewReportMessage] = useState('')
  const [taggedPersonnel, setTaggedPersonnel] = useState<number[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [reportAuthorId, setReportAuthorId] = useState<number | null>(null)
  const [reportFiles, setReportFiles] = useState<File[]>([])

  const loadReports = useCallback(async () => {
    if (!card?.id) return
    setLoadingReports(true)
    try {
      console.log('Fetching reports for card:', card.id)
      const response = await getWorkflowCardReports(card.id)
      console.log('Reports loaded:', response.reports?.length || 0)
      setReports(response.reports || [])
    } catch (err) {
      console.error('Failed to load reports', err)
    } finally {
      setLoadingReports(false)
    }
  }, [card?.id])

  const loadPersonnel = useCallback(async () => {
    try {
      const data = await getPersonnel()
      setPersonnel(Array.isArray(data) ? data : (data?.data || []))
    } catch (err) {
      console.error('Failed to load personnel', err)
    }
  }, [])

  useEffect(() => {
    if (card?.id) {
      console.log('Loading reports for card:', card.id)
      loadReports()
    } else {
      console.log('No card ID, clearing reports')
      setReports([])
    }
    setReportFiles([])
    setNewReportMessage('')
    setTaggedPersonnel([])
  }, [card?.id, loadReports])

  useEffect(() => {
    loadPersonnel()
  }, [loadPersonnel])

  const handleReportFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      return
    }

    const oversized = files.filter((file) => file.size > MAX_REPORT_FILE_SIZE_BYTES)
    if (oversized.length) {
      alert(`فایل‌ها باید حداکثر ${MAX_REPORT_FILE_SIZE_MB} مگابایت باشند`)
    }

    setReportFiles((prev) => {
      const remainingSlots = MAX_REPORT_FILES - prev.length
      if (remainingSlots <= 0) {
        alert(`حداکثر ${MAX_REPORT_FILES} فایل را می‌توانید پیوست کنید`)
        return prev
      }
      const allowedFiles = files
        .filter((file) => file.size <= MAX_REPORT_FILE_SIZE_BYTES)
        .slice(0, remainingSlots)
      return [...prev, ...allowedFiles]
    })

    event.target.value = ''
  }

  const handleRemoveReportFile = (index: number) => {
    setReportFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  useEffect(() => {
    if (user?.id) {
      const parsedId = typeof user.id === 'string' ? parseInt(user.id) : user.id
      setReportAuthorId(parsedId)
    }
  }, [user?.id])

  const handleAddReport = async () => {
    if (!card?.id || !newReportMessage.trim()) {
      alert('لطفاً یک پیام وارد کنید')
      return
    }
    const parsedUserId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null
    const effectiveAuthorId = parsedUserId || reportAuthorId
    if (!effectiveAuthorId) {
      alert('لطفاً وارد سیستم شوید یا نویسنده گزارش را انتخاب کنید')
      return
    }
    if (reportFiles.length > MAX_REPORT_FILES) {
      alert(`حداکثر ${MAX_REPORT_FILES} فایل را می‌توانید پیوست کنید`)
      return
    }
    setSendingReport(true)
    try {
      console.log('Creating report:', {
        cardId: card.id,
        authorId: effectiveAuthorId,
        message: newReportMessage.trim(),
        taggedPersonnel,
        filesCount: reportFiles.length
      })
      const result = await createWorkflowCardReport(card.id, {
        authorId: effectiveAuthorId,
        message: newReportMessage.trim(),
        taggedPersonnelIds: taggedPersonnel,
        files: reportFiles
      })
      console.log('Report created:', result)
      setNewReportMessage('')
      setTaggedPersonnel([])
      setReportFiles([])
      await loadReports()
    } catch (err: any) {
      console.error('Error creating report:', err)
      alert(err?.response?.data?.error || err?.message || 'خطا در افزودن گزارش')
    } finally {
      setSendingReport(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('عنوان کارت الزامی است')
      return
    }
    if (!listId) {
      alert('لطفاً یک ستون انتخاب کنید')
      return
    }
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        centerId: centerId || null,
        entityType: entityType || null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        reminderAt: reminderAt ? reminderAt.toISOString() : null
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {card ? 'ویرایش کارت' : 'افزودن کارت جدید'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">عنوان *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">نوع کارت</label>
              <select
                value={entityType || 'task'}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="task">کار جدید</option>
                <option value="mission">ماموریت</option>
                <option value="contact">تماس</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">مرکز</label>
              {loadingCenters ? (
                <div className="text-sm text-gray-500">در حال بارگذاری مراکز...</div>
              ) : (
                <select
                  value={centerId || ''}
                  onChange={(e) => setCenterId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">انتخاب مرکز (اختیاری)</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name} {center.city ? `(${center.city})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">توضیحات</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {/* Reports / Chat Section */}
            {card?.id && (
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium mb-3">گزارشات و یادداشت‌ها</label>
                
                {/* Reports List */}
                <div className="border rounded-lg p-3 mb-3 bg-gray-50 max-h-64 overflow-y-auto space-y-3">
                  {loadingReports ? (
                    <div className="text-center text-gray-500 py-4">در حال بارگذاری...</div>
                  ) : reports.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">هنوز گزارشی ثبت نشده است</div>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{report.author?.name || 'نامشخص'}</span>
                            {report.taggedPersonnel && report.taggedPersonnel.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {report.taggedPersonnel.map((person: any) => (
                                  <span key={person.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                    @{person.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(report.createdAt).toLocaleString('fa-IR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{report.message}</p>
                        {report.attachments && report.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {report.attachments.map((attachment: any) => {
                              const href = attachment.url || (attachment.fileName ? `/api/uploads/workflow-reports/${attachment.fileName}` : '#')
                              const sizeLabel = formatFileSize(attachment.size)
                              return (
                                <a
                                  key={attachment.id || `${attachment.fileName}-${attachment.reportId}`}
                                  href={href || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    if (!href || href === '#') {
                                      e.preventDefault()
                                    }
                                  }}
                                >
                                  <span role="img" aria-label="attachment">
                                    📎
                                  </span>
                                  <span className="truncate flex-1">
                                    {attachment.originalName || attachment.fileName || 'فایل'}
                                  </span>
                                  {sizeLabel && <span className="text-gray-400">{sizeLabel}</span>}
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Report */}
                <div className="space-y-3">
                  <div>
                    <textarea
                      value={newReportMessage}
                      onChange={(e) => setNewReportMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="گزارش یا یادداشت جدید..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          handleAddReport()
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">پیوست فایل (اختیاری)</label>
                    <input
                      type="file"
                      multiple
                      onChange={handleReportFilesChange}
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="block w-full text-sm text-gray-700 border border-dashed border-gray-300 rounded-md p-2 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      حداکثر {MAX_REPORT_FILES} فایل، هرکدام تا {MAX_REPORT_FILE_SIZE_MB} مگابایت
                    </p>
                    {reportFiles.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-gray-700">
                        {reportFiles.map((file, index) => (
                          <li
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1 bg-white"
                          >
                            <span className="truncate flex-1">{file.name}</span>
                            <span className="text-gray-400">{formatFileSize(file.size)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveReportFile(index)}
                              className="text-red-500 hover:underline"
                            >
                              حذف
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {!user?.id && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">نویسنده گزارش *</label>
                      <select
                        value={reportAuthorId ?? ''}
                        onChange={(e) => setReportAuthorId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="">انتخاب کنید...</option>
                        {personnel.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} {person.role ? `(${person.role})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">در صورت عدم ورود، گزارش‌دهنده را انتخاب کنید</p>
                    </div>
                  )}
                  
                  {/* Tag Personnel */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">تگ کردن افراد (اختیاری)</label>
                    <select
                      multiple
                      value={taggedPersonnel.map(String)}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value))
                        setTaggedPersonnel(selected)
                      }}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      size={3}
                    >
                      {personnel.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} {person.role ? `(${person.role})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">برای انتخاب چند نفر، Ctrl (یا Cmd در Mac) را نگه دارید</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddReport}
                    disabled={!newReportMessage.trim() || sendingReport}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {sendingReport ? 'در حال ارسال...' : 'افزودن گزارش (Ctrl+Enter)'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">تاریخ و ساعت سررسید</label>
                <PersianDateTimePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="انتخاب تاریخ و ساعت سررسید"
                  showTime={true}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">زمان یادآوری</label>
                <PersianDateTimePicker
                  value={reminderAt}
                  onChange={setReminderAt}
                  placeholder="انتخاب زمان یادآوری"
                  showTime={true}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                disabled={saving}
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

