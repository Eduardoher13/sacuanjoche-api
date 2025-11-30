import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[] | object;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.constructor.name;
      } else {
        message = exception.message;
        error = exception.constructor.name;
      }

      // Si es InternalServerErrorException con mensaje genérico, personalizarlo
      if (exception instanceof InternalServerErrorException) {
        const errorMessage =
          typeof message === 'string'
            ? message
            : Array.isArray(message)
              ? message[0]
              : (message as any)?.message || '';

        if (
          errorMessage.includes('check server') ||
          errorMessage.includes('check servers') ||
          errorMessage.includes('Unexpected error')
        ) {
          message =
            'Ocurrió un error inesperado. Por favor, intente nuevamente más tarde.';
          error = 'Internal Server Error';
        }
      }
    } else {
      // Error no manejado
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message =
        'Ocurrió un error inesperado. Por favor, intente nuevamente más tarde.';
      error = 'Internal Server Error';
    }

    // Log del error completo para debugging
    this.logger.error('Exception caught:', {
      status,
      message,
      error,
      path: request.url,
      method: request.method,
      ip: request.ip,
      body: request.method !== 'GET' ? request.body : undefined,
      timestamp: new Date().toISOString(),
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Respuesta al cliente
    const responseBody: any = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // En desarrollo, incluir más detalles
    if (process.env.STAGE !== 'prod') {
      if (exception instanceof Error) {
        responseBody.stack = exception.stack;
      }
    }

    response.status(status).json(responseBody);
  }
}
