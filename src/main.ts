import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ContentTypeGuard } from './common/guards/content-type.guard';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });

  // ========== HELMET - Headers de seguridad HTTP ==========
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Deshabilitado para WebSockets
    }),
  );

  // ========== CORS - Configuración segura ==========
  const allowedOrigins = [
    'http://localhost:8000', // Para pruebas locales con Postman o frontend local
    'http://localhost:5173',
    'https://sacuanjoche.netlify.app',
    'https://sacuanjocheback-24676.ondigitalocean.app', 
    'http://127.0.0.1:3000',

    // Agregar aquí otros orígenes permitidos en producción
    // 'https://tudominio.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, etc.) solo en desarrollo
      if (!origin && process.env.STAGE !== 'prod') {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 horas
  });

  // ========== Límites de payload y timeout ==========
  app.use((req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength > maxSize) {
      return res.status(413).json({
        statusCode: 413,
        message: 'El tamaño del payload excede el límite permitido (10MB)',
        error: 'Payload Too Large',
      });
    }

    // Logging de requests grandes
    if (contentLength > 5 * 1024 * 1024) {
      // 5MB
      logger.warn(
        `Request grande detectado: ${(contentLength / 1024 / 1024).toFixed(2)}MB desde ${req.ip}`,
      );
    }

    // Timeout de 30 segundos
    req.setTimeout(30000, () => {
      res.status(408).json({
        statusCode: 408,
        message: 'Request timeout',
        error: 'Request Timeout',
      });
    });

    next();
  });

  // ========== Content-Type Guard ==========
  app.useGlobalGuards(new ContentTypeGuard());

  // ========== ValidationPipe mejorado ==========
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en DTOs
      forbidNonWhitelisted: true, // Rechaza requests con propiedades extra
      transform: true, // Transforma automáticamente tipos
      transformOptions: {
        enableImplicitConversion: true, // Conversión implícita de tipos
      },
    }),
  );

  // ========== Exception Filters ==========
  app.useGlobalFilters(
    new ValidationExceptionFilter(),
    new GlobalExceptionFilter(),
  );

  // ========== Swagger ==========
  const config = new DocumentBuilder()
    .setTitle('Flori RESTFul API')
    .setDescription('Flori endpoints')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa el token JWT',
        in: 'header',
      },
      'JWT-auth', // Este nombre se usará en los decoradores @ApiBearerAuth()
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token después de refrescar la página
    },
  });

  // Health endpoint (no auth) for readiness probes
  const http = app.getHttpAdapter().getInstance();
  http.get('/healthz', (_req, res) => res.status(200).send('ok'));

  // Bind host and port. Default to 8000 in production if PORT is undefined.
  const portEnv = process.env.PORT;
  const port = portEnv ? Number(portEnv) : process.env.STAGE === 'prod' ? 8000 : 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Aplicación corriendo en: http://localhost:${port}/api`);
}
bootstrap();
