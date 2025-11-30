import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

/**
 * Guard que valida que las peticiones POST, PUT, PATCH tengan Content-Type: application/json
 * Esto previene ataques de inyección y asegura que solo se acepten datos JSON válidos
 */
@Injectable()
export class ContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const contentType = request.headers['content-type'];

    // Solo validar métodos que envían body
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (!contentType) {
        throw new UnsupportedMediaTypeException(
          'Content-Type header es requerido. Debe ser application/json',
        );
      }

      // Aceptar application/json y application/json; charset=utf-8
      const isValidContentType =
        contentType.includes('application/json') &&
        !contentType.includes('text/html') &&
        !contentType.includes('application/xml');

      if (!isValidContentType) {
        throw new UnsupportedMediaTypeException(
          'Content-Type debe ser application/json',
        );
      }
    }

    return true;
  }
}

