import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let statusCode = 500
  let message = 'Internal Server Error'

  if (err instanceof ApiError) {
    statusCode = err.statusCode
    message = err.message
  } else if (err instanceof ZodError) {
    statusCode = 400
    message = 'Validation Error'
    logger.error('Validation error:', err.errors)
  } else {
    logger.error('Unhandled error:', err)
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err instanceof ZodError ? err.errors : undefined,
      }),
    },
  })
}