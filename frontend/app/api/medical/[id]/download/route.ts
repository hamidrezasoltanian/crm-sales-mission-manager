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
    const url = `${app3BaseUrl}/api/medical-files/${params.id}/download`
    
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Error downloading medical file' },
        { status: response.status }
      )
    }

    // Get the file content
    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    // Return the file with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="medical_file_${params.id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error proxying download medical file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

