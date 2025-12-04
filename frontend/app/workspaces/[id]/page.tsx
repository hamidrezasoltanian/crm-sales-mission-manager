'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MainLayout from '../../components/MainLayout'
import { 
  getWorkspaceById, 
  getWorkspaces,
  getDefaultWorkspace,
  updateWorkspace
} from '../../lib/api'
import { 
  LayoutDashboard, 
  Filter, 
  Tag, 
  FileText, 
  Target, 
  Share2,
  Settings,
  ArrowRight,
  Command,
  Phone,
  MapPin,
  Columns,
  BarChart3
} from 'lucide-react'
import WorkspaceDashboard from '../../components/workspace/WorkspaceDashboard'
import WorkspaceCommandCenter from '../../components/workspace/WorkspaceCommandCenter'
import WorkspaceFilters from '../../components/workspace/WorkspaceFilters'
import WorkspaceTags from '../../components/workspace/WorkspaceTags'
import WorkspaceNotes from '../../components/workspace/WorkspaceNotes'
import WorkspaceGoals from '../../components/workspace/WorkspaceGoals'
import WorkspaceShares from '../../components/workspace/WorkspaceShares'
import WorkspaceSettings from '../../components/workspace/WorkspaceSettings'
import WorkspaceAssignments from '../../components/workspace/WorkspaceAssignments'
import WorkspaceContacts from '../../components/workspace/WorkspaceContacts'

interface Workspace {
  id: number
  name: string
  description?: string
  color: string
  icon: string
  isDefault: boolean
  filters: any
  viewSettings: any
  settings: any
}

export default function WorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.id as string
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeTab, setActiveTab] = useState('command')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkspace()
    loadWorkspaces()
  }, [workspaceId])

  const loadWorkspace = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceById(workspaceId)
      setWorkspace(response.workspace)
    } catch (error) {
      console.error('Error loading workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWorkspaces = async () => {
    try {
      const response = await getWorkspaces()
      setWorkspaces(response.workspaces || [])
    } catch (error) {
      console.error('Error loading workspaces:', error)
    }
  }

  const handleWorkspaceChange = (newWorkspaceId: string) => {
    router.push(`/workspaces/${newWorkspaceId}`)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center">در حال بارگذاری...</div>
        </div>
      </MainLayout>
    )
  }

  if (!workspace) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center text-red-600">Workspace یافت نشد</div>
        </div>
      </MainLayout>
    )
  }

  const tabs = [
    { id: 'command', label: 'مرکز فرماندهی', icon: Command },
    { id: 'assignments', label: 'ماموریت‌ها', icon: Target },
    { id: 'contacts', label: 'تماس‌ها', icon: Phone },
    { id: 'centers', label: 'مراکز', icon: MapPin },
    { id: 'workflow', label: 'برد عملیات', icon: Columns },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'filters', label: 'فیلترها', icon: Filter },
    { id: 'tags', label: 'برچسب‌ها', icon: Tag },
    { id: 'notes', label: 'یادداشت‌ها', icon: FileText },
    { id: 'goals', label: 'اهداف', icon: Target },
    { id: 'shares', label: 'اشتراک‌گذاری', icon: Share2 },
    { id: 'settings', label: 'تنظیمات', icon: Settings }
  ]

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{workspace.icon}</span>
              <div>
                <h1 className="text-2xl font-bold">{workspace.name}</h1>
                {workspace.description && (
                  <p className="text-gray-600">{workspace.description}</p>
                )}
              </div>
            </div>
            
            {/* Workspace Selector */}
            <div className="flex items-center gap-2">
              <select
                value={workspaceId}
                onChange={(e) => handleWorkspaceChange(e.target.value)}
                className="border rounded px-3 py-2"
                style={{ borderLeftColor: workspace.color, borderLeftWidth: '4px' }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name} {w.isDefault && '⭐'}
                  </option>
                ))}
              </select>
              <button
                onClick={() => router.push('/workspaces')}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                مدیریت Workspace ها
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'command' && (
            <WorkspaceCommandCenter workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'assignments' && (
            <WorkspaceAssignments workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'contacts' && (
            <WorkspaceContacts workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'centers' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">مدیریت مراکز</p>
              <button
                onClick={() => router.push('/centers')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                باز کردن صفحه مراکز
              </button>
            </div>
          )}
          {activeTab === 'workflow' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">برد عملیات</p>
              <button
                onClick={() => router.push('/workflow')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                باز کردن برد عملیات
              </button>
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">گزارش‌ها</p>
              <button
                onClick={() => router.push('/reports')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                باز کردن گزارش‌ها
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <WorkspaceDashboard workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'filters' && (
            <WorkspaceFilters workspaceId={workspaceId} workspace={workspace} onUpdate={loadWorkspace} />
          )}
          {activeTab === 'tags' && (
            <WorkspaceTags workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'notes' && (
            <WorkspaceNotes workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'goals' && (
            <WorkspaceGoals workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'shares' && (
            <WorkspaceShares workspaceId={workspaceId} workspace={workspace} />
          )}
          {activeTab === 'settings' && (
            <WorkspaceSettings workspaceId={workspaceId} workspace={workspace} onUpdate={loadWorkspace} />
          )}
        </div>
      </div>
    </MainLayout>
  )
}

