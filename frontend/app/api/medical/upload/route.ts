import { NextRequest, NextResponse } from 'next/server'

const getApp3BaseUrl = (hostname: string) => {
  if (process.env.APP3_BASE_URL) {
    return process.env.APP3_BASE_URL
  }
  return `http://${hostname}:8003`
}

export async function POST(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0] || 'localhost'
    const app3BaseUrl = getApp3BaseUrl(hostname)
    const formData = await request.formData()
    const url = `${app3BaseUrl}/api/medical-files/upload`
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error uploading medical file' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error proxying upload medical file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

