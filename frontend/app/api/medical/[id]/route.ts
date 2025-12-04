import { NextRequest, NextResponse } from 'next/server'

const getApp3BaseUrl = (hostname: string) => {
  if (process.env.APP3_BASE_URL) {
    return process.env.APP3_BASE_URL
  }
  return `http://${hostname}:8003`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const url = `${app3BaseUrl}/api/medical-files/${params.id}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error fetching medical file' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying medical file:', error)
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
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const body = await request.json()
    const url = `${app3BaseUrl}/api/medical-files/${params.id}`
    
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
        { error: error || 'Error updating medical file' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying update medical file:', error)
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
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const url = `${app3BaseUrl}/api/medical-files/${params.id}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error deleting medical file' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying delete medical file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

