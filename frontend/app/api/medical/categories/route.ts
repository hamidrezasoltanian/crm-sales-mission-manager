import { NextRequest, NextResponse } from 'next/server'

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
    const url = `${app3BaseUrl}/api/categories`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error fetching categories' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying categories:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const body = await request.json()
    const url = `${app3BaseUrl}/api/categories`
    
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
        { error: error || 'Error creating category' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying create category:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

