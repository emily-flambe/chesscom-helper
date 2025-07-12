import { json } from 'itty-router'

export interface ApiError extends Error {
  status?: number
  code?: string | undefined
  details?: unknown
}

export function errorHandler(error: ApiError): Response {
  console.error('API Error:', {
    message: error.message,
    status: error.status,
    code: error.code,
    stack: error.stack,
    details: error.details
  })

  const status = error.status || 500
  const code = error.code || 'INTERNAL_SERVER_ERROR'
  
  let message = error.message || 'An unexpected error occurred'
  
  if (status === 500) {
    message = 'Internal server error'
  }

  const errorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error.details 
      })
    }
  }

  return json(errorResponse, { 
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': code
    }
  })
}

export function createApiError(
  message: string, 
  status: number = 500, 
  code?: string, 
  details?: unknown
): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  error.code = code
  error.details = details
  return error
}