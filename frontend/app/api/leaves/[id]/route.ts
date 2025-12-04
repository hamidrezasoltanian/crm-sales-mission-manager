import { NextRequest, NextResponse } from 'next/server'

const getApp2BaseUrl = (hostname: string) => {
  if (process.env.APP2_BASE_URL) {
    return process.env.APP2_BASE_URL
  }
  return `http://${hostname}:8002`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app2BaseUrl = getApp2BaseUrl(hostname)
    const url = `${app2BaseUrl}/api/leave-requests/${params.id}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error fetching leave request' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying leave request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app2BaseUrl = getApp2BaseUrl(hostname)
    const body = await request.json()
    const url = `${app2BaseUrl}/api/leave-requests/${params.id}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error updating leave request' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying update leave request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app2BaseUrl = getApp2BaseUrl(hostname)
    const url = `${app2BaseUrl}/api/leave-requests/${params.id}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error deleting leave request' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying delete leave request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

