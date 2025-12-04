import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const assignmentId = id
    const body = await request.json()
    const { managerId, personalPayment, managerComment } = body

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.split(' ')[1]

    if (!token) {
      return NextResponse.json(
        { error: 'توکن احراز هویت یافت نشد' },
        { status: 401 }
      )
    }

    // Get hostname to determine backend URL
    // Use localhost for backend connection (backend is always on localhost)
    const backendUrl = `http://localhost:2001/api/assignments/${assignmentId}/approve`

    console.log('[API Route] Proxying approve request to:', backendUrl)
    console.log('[API Route] Request host:', request.headers.get('host'))

    // Forward request to backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ managerId, personalPayment, managerComment })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'خطا در تایید ماموریت' }))
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API Route] Error proxying approve request:', error)
    return NextResponse.json(
      { error: error.message || 'خطا در تایید ماموریت' },
      { status: 500 }
    )
  }
}

