import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const getApp3BaseUrl = (hostname: string) => {
  if (process.env.APP3_BASE_URL) {
    return process.env.APP3_BASE_URL
  }
  return `http://${hostname}:8003`
}

export async function GET(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    const url = `${app3BaseUrl}/api/medical-files${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error fetching medical files' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying medical files:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

