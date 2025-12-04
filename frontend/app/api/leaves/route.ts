import { NextRequest, NextResponse } from 'next/server'

const getApp2BaseUrl = (hostname: string) => {
  // Use environment variable if set, otherwise construct from hostname
  if (process.env.APP2_BASE_URL) {
    return process.env.APP2_BASE_URL
  }
  // Use same hostname as frontend, different port
  return `http://${hostname}:8002`
}

export async function GET(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app2BaseUrl = getApp2BaseUrl(hostname)
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    const url = `${app2BaseUrl}/api/leave-requests${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error fetching leave requests' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying leave requests:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app2BaseUrl = getApp2BaseUrl(hostname)
    const body = await request.json()
    const url = `${app2BaseUrl}/api/leave-requests`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error creating leave request' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying create leave request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

