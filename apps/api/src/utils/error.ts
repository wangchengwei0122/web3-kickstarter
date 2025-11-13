/**
 * 统一错误处理
 */

import { FastifyReply, FastifyRequest } from 'fastify';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(400, message, 'BAD_REQUEST');
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed') {
    super(400, message, 'VALIDATION_ERROR');
  }
}

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 统一成功响应格式
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * 错误处理器
 */
export async function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 如果是自定义 API 错误
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
      },
    };
    return reply.status(error.statusCode).send(response);
  }

  // 默认错误处理
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
    },
  };

  return reply.status(500).send(response);
}

