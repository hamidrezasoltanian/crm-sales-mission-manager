'use client'

interface Mission {
  _id: string
  title: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assignedTo?: string
  dueDate?: string
  createdAt: string
}

interface MissionListProps {
  missions: Mission[]
  onEdit: (mission: Mission) => void
  onDelete: (id: string) => void
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  'in-progress': 'در حال انجام',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
}

const priorityLabels: Record<string, string> = {
  low: 'کم',
  medium: 'متوسط',
  high: 'زیاد',
}

export default function MissionList({ missions, onEdit, onDelete }: MissionListProps) {
  if (missions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500">هنوز ماموریتی ثبت نشده است</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {missions.map((mission) => (
        <div
          key={mission._id}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{mission.title}</h3>
              {mission.description && (
                <p className="text-gray-600 mb-4">{mission.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[mission.status]}`}>
                  {statusLabels[mission.status]}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[mission.priority]}`}>
                  اولویت: {priorityLabels[mission.priority]}
                </span>
                {mission.assignedTo && (
                  <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                    واگذار شده به: {mission.assignedTo}
                  </span>
                )}
                {mission.dueDate && (
                  <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                    تاریخ سررسید: {new Date(mission.dueDate).toLocaleDateString('fa-IR')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 mr-4">
              <button
                onClick={() => onEdit(mission)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                ویرایش
              </button>
              <button
                onClick={() => onDelete(mission._id)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
