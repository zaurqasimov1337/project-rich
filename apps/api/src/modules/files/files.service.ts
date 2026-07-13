import {
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { getContext, requireTenantId } from '../../core/context/request-context';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = config.get('S3_BUCKET') ?? 'edusphere';
    this.s3 = new S3Client({
      region: config.get('S3_REGION') ?? 'us-east-1',
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY') ?? '',
        secretAccessKey: config.get('S3_SECRET_KEY') ?? '',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`Bucket check failed: ${(err as Error).message}`);
      }
    }
  }

  /** Returns a presigned PUT url; client uploads directly, then confirms. */
  async presignUpload(input: {
    name: string;
    mime: string;
    size: number;
    entityType?: string;
    entityId?: string;
    uploadedById?: string;
  }) {
    if (!ALLOWED_MIME.has(input.mime)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'File type not allowed' });
    }
    if (input.size > MAX_SIZE) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'File too large (max 20MB)' });
    }
    const tenantId = requireTenantId();
    const key = `${tenantId}/${randomUUID()}`;
    const record = await this.prisma.scoped.file.create({
      data: {
        tenantId,
        key,
        name: input.name.slice(0, 255),
        mime: input.mime,
        size: input.size,
        entityType: input.entityType,
        entityId: input.entityId,
        uploadedById: input.uploadedById,
      },
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: input.mime }),
      { expiresIn: 600 },
    );
    return { fileId: record.id, uploadUrl };
  }

  async presignDownload(fileId: string, user: AuthUser) {
    const file = await this.prisma.scoped.file.findFirst({ where: { id: fileId } });
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'File not found' });

    // Object-level authorization: uploader, or a manager with files.manage.
    const perms = getContext()?.permissions;
    const canManage = perms?.has('files.manage') ?? false;
    if (file.uploadedById !== user.userId && !canManage) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not authorized for this file' });
    }
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: file.key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
      }),
      { expiresIn: 600 },
    );
    return { url, name: file.name, mime: file.mime, size: file.size };
  }
}
