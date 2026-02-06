import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import * as https from 'https';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export interface GenerateUploadUrlParams {
  keyPrefix?: string;
  fileName?: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface GenerateBatchUploadUrlsParams {
  items?: GenerateUploadUrlParams[];
  concurrency?: number;
}

export interface GeneratedUploadUrl {
  uploadUrl: string;
  expiresAt: string;
  objectKey: string;
  publicUrl: string;
}

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicBaseUrl: string;
  private readonly defaultExpirySeconds: number;
  private readonly defaultAcl: 'public-read' | 'private';
  private readonly isConfigured: boolean;
  private readonly maxUploadBytes: number;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>('DO_SPACES_BUCKET');
    const region = this.config.get<string>('DO_SPACES_REGION');
    const endpointEnv = this.config.get<string>('DO_SPACES_ENDPOINT');
    const accessKeyId = this.config.get<string>('DO_SPACES_KEY');
    const secretAccessKey = this.config.get<string>('DO_SPACES_SECRET');

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'DigitalOcean Spaces no está completamente configurado. Define las variables DO_SPACES_*.',
      );
      this.client = null;
      this.bucket = null;
      this.publicBaseUrl = '';
      this.isConfigured = false;
    } else {
      this.bucket = bucket;

      /** -------------------------
       *  NORMALIZAR ENDPOINT
       *  ------------------------- */
      let endpoint = endpointEnv?.trim();

      if (!endpoint) {
        endpoint = `https://${bucket}.${region}.digitaloceanspaces.com`;
      }

      // Remover https://
      let host = endpoint.replace(/^https?:\/\//, '');

      // Quitar duplicados del bucket (bucket.bucket.region.digitaloceanspaces.com)
      while (host.startsWith(`${bucket}.${bucket}.`)) {
        host = host.replace(`${bucket}.`, '');
      }

      endpoint = `https://${host}`;

      // Validación correcta del endpoint
      const endpointRegex =
        /^https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.digitaloceanspaces\.com$/;

      if (!endpointRegex.test(endpoint)) {
        this.logger.error(
          `Endpoint inválido: ${endpoint}. Debe ser: https://bucket.region.digitaloceanspaces.com`,
        );
      } else {
        this.logger.log(`Endpoint configurado correctamente: ${endpoint}`);
      }

      /** -------------------------
       *  SSL CONFIG
       *  ------------------------- */
      const rejectUnauthorizedEnv = this.config.get<string>(
        'DO_SPACES_REJECT_UNAUTHORIZED',
      );
      const rejectUnauthorized =
        rejectUnauthorizedEnv === 'true' ||
        rejectUnauthorizedEnv === '1' ||
        false;

      const httpsAgent = new https.Agent({
        rejectUnauthorized,
        keepAlive: true,
      });

      this.client = new S3Client({
        region,
        endpoint,
        forcePathStyle: false,
        credentials: { accessKeyId, secretAccessKey },
        requestHandler: new NodeHttpHandler({
          httpsAgent,
        }),
      });

      /** -------------------------
       *  URL PÚBLICA
       *  ------------------------- */
      const cdn = this.config.get<string>('DO_SPACES_CDN_URL');
      const customPublic = this.config.get<string>('DO_SPACES_PUBLIC_BASE_URL');

      this.publicBaseUrl =
        cdn?.replace(/\/$/, '') ??
        customPublic?.replace(/\/$/, '') ??
        endpoint.replace(/\/$/, '');

      this.isConfigured = true;
    }

    /** -------------------------
     *  CONFIG GENERALES
     *  ------------------------- */
    this.defaultExpirySeconds = Number(
      this.config.get<string>('DO_SPACES_UPLOAD_EXPIRATION') ?? '3600',
    );

    this.defaultAcl = (this.config.get<string>(
      'DO_SPACES_DEFAULT_ACL',
    ) ?? 'public-read') as 'public-read' | 'private';

    const maxBytesEnv = this.config.get<string>('DO_SPACES_MAX_UPLOAD_BYTES');
    const parsedMax = maxBytesEnv ? Number(maxBytesEnv) : NaN;

    this.maxUploadBytes =
      Number.isFinite(parsedMax) && parsedMax > 0
        ? parsedMax
        : 5 * 1024 * 1024;
  }

  /** ====================================================================== */
  /**                         GENERAR URL FIRMADA                            */
  /** ====================================================================== */
  async generateUploadUrl(
    params: GenerateUploadUrlParams,
  ): Promise<GeneratedUploadUrl> {
    this.ensureConfigured();

    if (!params.contentType) {
      throw new InternalServerErrorException(
        'Se requiere contentType para subir archivos.',
      );
    }

    if (!Number.isFinite(params.contentLength) || params.contentLength <= 0) {
      throw new InternalServerErrorException(
        'contentLength debe ser un número positivo.',
      );
    }

    if (params.contentLength > this.maxUploadBytes) {
      throw new InternalServerErrorException(
        `El archivo excede el tamaño máximo permitido (${this.maxUploadBytes} bytes).`,
      );
    }

    const folder = params.keyPrefix?.replace(/\/$/, '') ?? 'uploads';
    const extension = this.resolveExtension(
      params.contentType,
      params.fileName,
    );
    const key = `${folder}/${this.buildObjectName(extension)}`;

    const expiresIn = params.expiresInSeconds ?? this.defaultExpirySeconds;
    const acl = params.acl ?? this.defaultAcl;

    // No incluir ContentType en el comando para evitar problemas con CORS
    // El navegador lo agregará automáticamente y no causará conflictos con la firma
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      // ContentType se omite intencionalmente para evitar problemas de CORS
      // El navegador lo agregará automáticamente y DigitalOcean Spaces lo aceptará
      ContentLength: params.contentLength,
      ACL: acl,
      Metadata: {
        ...params.metadata,
        'content-type': params.contentType, // Guardamos el tipo en metadata como respaldo
      },
      // CacheControl ayuda con la compatibilidad CORS
      CacheControl: 'max-age=31536000',
    });

    try {
      // Generar URL firmada sin ContentType en los signed headers
      // Esto permite que el navegador agregue Content-Type sin causar problemas de CORS
      const uploadUrl = await getSignedUrl(this.client!, command, {
        expiresIn,
      });

      return {
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        objectKey: key,
        publicUrl: this.buildPublicUrl(key),
      };
    } catch (error: any) {
      this.logError('Error al generar URL firmada', params, error);
      this.handleSSLError(error);
      throw new InternalServerErrorException(
        `Error generando URL: ${error.message || 'desconocido'}`,
      );
    }
  }


    /** ====================================================================== */
  /**                      ✅ GENERAR URLs FIRMADAS (LOTE)                   */
  /** ====================================================================== */
  async generateUploadUrlsBatch(
    params: GenerateBatchUploadUrlsParams,
  ): Promise<GeneratedUploadUrl[]> {
    this.ensureConfigured();

    const items = params.items ?? [];
    if (!Array.isArray(items) || items.length === 0) return [];

    const concurrency =
      Number.isFinite(params.concurrency) && (params.concurrency as number) > 0
        ? Math.floor(params.concurrency as number)
        : 8;

    // Reusa tu método actual (misma validación de tamaño, contentType, ACL, etc.)
    return this.runWithConcurrency(items, concurrency, (item) =>
      this.generateUploadUrl(item),
    );
  }

  /** ====================================================================== */
  /**                              UTILITARIOS                                */
  /** ====================================================================== */

  // ...existing code...

  // ✅ NUEVO: helper interno sin dependencias para limitar concurrencia
  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const runners = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (true) {
          const current = nextIndex++;
          if (current >= items.length) break;
          results[current] = await worker(items[current], current);
        }
      },
    );

    await Promise.all(runners);
    return results;
  }



  /** ====================================================================== */
  /**                             OBJETO PÚBLICO                              */
  /** ====================================================================== */
  buildPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${objectKey.replace(/^\//, '')}`;
  }

  /** ====================================================================== */
  /**                               ELIMINAR                                  */
  /** ====================================================================== */
  async deleteObject(objectKey: string): Promise<void> {
    this.ensureConfigured();

    try {
      await this.client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket!,
          Key: objectKey,
        }),
      );
    } catch (error: any) {
      this.logError(`Error eliminando objeto ${objectKey}`, {}, error);
      this.handleSSLError(error);
      throw new InternalServerErrorException(
        `No se pudo eliminar: ${error.message || 'error desconocido'}`,
      );
    }
  }

  /** ====================================================================== */
  /**                              UTILITARIOS                                */
  /** ====================================================================== */

  private ensureConfigured() {
    if (!this.isConfigured || !this.bucket || !this.client) {
      throw new InternalServerErrorException(
        'DigitalOcean Spaces no está configurado.',
      );
    }
  }

  private buildObjectName(extension: string): string {
    const uuid = randomUUID();
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '');
    extension = extension.replace(/^\./, '');
    return extension ? `${ts}-${uuid}.${extension}` : `${ts}-${uuid}`;
  }

  private resolveExtension(contentType: string, fileName?: string): string {
    const extFromFile = fileName ? extname(fileName) : '';
    if (extFromFile) return extFromFile;

    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };

    return map[contentType] ?? '';
  }

  private logError(message: string, params: any, error: any) {
    this.logger.error(message, {
      ...params,
      error: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    });
  }

  private handleSSLError(error: any) {
    const msg = error?.message?.toLowerCase() ?? '';
    const codes = [
      'unable_to_verify_leaf_signature',
      'cert_has_expired',
      'self_signed_cert_in_chain',
      'depth_zero_self_signed_cert',
      'cert_untrusted',
    ];

    if (codes.includes(error.code) || msg.includes('certificate')) {
      throw new InternalServerErrorException(
        `Error SSL: ${error.message}. Revisa DO_SPACES_REJECT_UNAUTHORIZED.`,
      );
    }
  }
}
