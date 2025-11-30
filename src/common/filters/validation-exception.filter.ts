import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Log the detailed error for debugging
    this.logger.warn('Validation Error:', {
      ip: request.ip,
      method: request.method,
      url: request.url,
      body: request.body,
      error: exceptionResponse,
      timestamp: new Date().toISOString(),
    });

    // For production, return a generic message
    if (process.env.STAGE === 'prod') {
      response.status(status).json({
        statusCode: status,
        message: 'Error de validación. Por favor, revise los datos enviados.',
        error: 'Bad Request',
      });
    } else {
      // In development, return the full error details
      response.status(status).json(exceptionResponse);
    }
  }
}
