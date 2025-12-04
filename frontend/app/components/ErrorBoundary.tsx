'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-8">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-800 mb-4">خطا در بارگذاری صفحه</h2>
            <p className="text-red-700 mb-4">
              متأسفانه مشکلی در بارگذاری صفحه رخ داده است.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-red-600 font-medium">جزئیات خطا</summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              بارگذاری مجدد
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

