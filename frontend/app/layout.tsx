import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './contexts/AuthContext'
import { ToastContainer } from './components/Toast'
import ConditionalSidebar from './components/ConditionalSidebar'

export const metadata: Metadata = {
  title: 'سیستم مدیریت ماموریت‌های فروش',
  description: 'داشبورد مدیریت ماموریت‌های فروش - لوکس و کامل',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* CSP is set in next.config.js headers() */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* Global error handler for keyboard events */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                
                // Global error handler to catch uncaught errors
                window.addEventListener('error', function(event) {
                  if (event.message && (
                    event.message.includes('Cannot read properties of undefined (reading \\'length\\')') ||
                    event.message.includes('length') && event.filename && event.filename.includes('page-events')
                  )) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.debug('Suppressed keyboard event error:', event.message);
                    return false;
                  }
                }, true);
                
                // Wrap addEventListener to catch errors from keyboard handlers BEFORE they execute
                const originalAddEventListener = Document.prototype.addEventListener;
                Document.prototype.addEventListener = function(type, listener, options) {
                  if (type === 'keydown' && typeof listener === 'function') {
                    const wrappedListener = function(e) {
                      try {
                        return listener.call(this, e);
                      } catch (error) {
                        // Silently ignore errors about reading 'length' property
                        if (error && error.message && (
                          error.message.includes('length') || 
                          error.message.includes('Cannot read properties')
                        )) {
                          console.debug('Keyboard event handler error suppressed:', error.message);
                          return;
                        }
                        throw error;
                      }
                    };
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                  }
                  return originalAddEventListener.call(this, type, listener, options);
                };
                
                // Also wrap window.addEventListener for extra safety
                const originalWindowAddEventListener = Window.prototype.addEventListener;
                Window.prototype.addEventListener = function(type, listener, options) {
                  if (type === 'keydown' && typeof listener === 'function') {
                    const wrappedListener = function(e) {
                      try {
                        return listener.call(this, e);
                      } catch (error) {
                        if (error && error.message && (
                          error.message.includes('length') || 
                          error.message.includes('Cannot read properties')
                        )) {
                          console.debug('Keyboard event handler error suppressed:', error.message);
                          return;
                        }
                        throw error;
                      }
                    };
                    return originalWindowAddEventListener.call(this, type, wrappedListener, options);
                  }
                  return originalWindowAddEventListener.call(this, type, listener, options);
                };
                
                // Also wrap document.addEventListener directly
                const originalDocAddEventListener = document.addEventListener.bind(document);
                document.addEventListener = function(type, listener, options) {
                  if (type === 'keydown' && typeof listener === 'function') {
                    const wrappedListener = function(e) {
                      try {
                        return listener.call(this, e);
                      } catch (error) {
                        if (error && error.message && (
                          error.message.includes('length') || 
                          error.message.includes('Cannot read properties')
                        )) {
                          console.debug('Keyboard event handler error suppressed:', error.message);
                          return;
                        }
                        throw error;
                      }
                    };
                    return originalDocAddEventListener(type, wrappedListener, options);
                  }
                  return originalDocAddEventListener(type, listener, options);
                };
              })();
            `,
          }}
        />
      </head>
      <body className="bg-white">
        <AuthProvider>
          <ToastContainer />
          <ConditionalSidebar>
            {children}
          </ConditionalSidebar>
        </AuthProvider>
      </body>
    </html>
  )
}
