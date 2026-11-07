import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createHash, createHmac } from 'crypto';
import * as https from 'https';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { Repository } from 'typeorm';
import { PrintOrmEntity } from './entities/print.orm-entity';

export type PrintResourceInput = {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  printTemplateId?: string | null;
  format?: string;
  fileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type PrintArtifact = {
  buffer: Buffer;
  fileName?: string;
  mimeType?: string;
  cloudinaryUrl?: string | null;
  s3Url?: string | null;
  metadata?: Record<string, unknown>;
};

export type CachedPrint = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  cacheHit: boolean;
  record: PrintOrmEntity;
};

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const S3_SERVICE = 's3';
const AWS4_HMAC_SHA256 = 'AWS4-HMAC-SHA256';

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function amzDate(value: Date): string {
  return value
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '');
}

@Injectable()
export class PrintsService {
  private readonly logger = new Logger(PrintsService.name);
  /** Avoid duplicate background uploads for the same print row. */
  private readonly uploading = new Set<string>();

  constructor(
    @InjectRepository(PrintOrmEntity)
    private readonly repository: Repository<PrintOrmEntity>,
  ) {}

  cacheKey(input: PrintResourceInput): string {
    const format = input.format ?? 'pdf';
    return [
      input.resourceType,
      input.resourceId,
      input.printTemplateId ?? 'default',
      format,
    ].join(':');
  }

  async find(input: PrintResourceInput): Promise<PrintOrmEntity | null> {
    return this.repository.findOne({
      where: {
        organizationId: input.organizationId,
        cacheKey: this.cacheKey(input),
      },
    });
  }

  async invalidate(input: PrintResourceInput): Promise<void> {
    await this.repository.delete({
      organizationId: input.organizationId,
      cacheKey: this.cacheKey(input),
    });
  }

  /**
   * Reuse a ready cached print if one exists; otherwise generate, store the
   * local file and persist the cache row. `generate` is only called on a miss.
   */
  async getOrGenerate(
    input: PrintResourceInput,
    generate: () => Promise<PrintArtifact>,
  ): Promise<CachedPrint> {
    const cacheKey = this.cacheKey(input);
    let record = await this.repository.findOne({
      where: { organizationId: input.organizationId, cacheKey },
    });

    if (record && record.status === 'ready') {
      const local = await this.readLocal(record.localPath);
      if (local) {
        this.scheduleRemoteUpload(record, local);
        return {
          buffer: local,
          fileName: record.fileName,
          mimeType: record.mimeType,
          cacheHit: true,
          record,
        };
      }
      // Local file was removed (ephemeral disk): try the remote copies in the
      // order Local > Cloudinary > S3, then regenerate only if nothing is left.
      for (const remote of [record.cloudinaryUrl, record.s3Url]) {
        if (!remote) continue;
        try {
          const buffer = await this.download(remote);
          await this.writeLocal(record.localPath, buffer);
          this.scheduleRemoteUpload(record, buffer);
          return {
            buffer,
            fileName: record.fileName,
            mimeType: record.mimeType,
            cacheHit: true,
            record,
          };
        } catch (error: any) {
          this.logger.warn(
            `Cached print ${record.id} could not be read from ${remote}: ${error?.message ?? error}`,
          );
        }
      }
    }

    if (!record) {
      record = this.repository.create({
        organizationId: input.organizationId,
        cacheKey,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        printTemplateId: input.printTemplateId ?? null,
        format: input.format ?? 'pdf',
        fileName:
          input.fileName ??
          `${input.resourceType}-${input.resourceId}.${input.format ?? 'pdf'}`,
        mimeType: input.mimeType ?? 'application/pdf',
        status: 'pending',
        metadata: input.metadata ?? {},
      });
      record = await this.repository.save(record);
    }

    try {
      const artifact = await generate();
      const fileName =
        artifact.fileName ??
        input.fileName ??
        `${input.resourceType}-${input.resourceId}.${input.format ?? 'pdf'}`;
      const mimeType = artifact.mimeType ?? input.mimeType ?? 'application/pdf';
      const localPath = await this.writeLocal(null, artifact.buffer, fileName);
      record.fileName = fileName;
      record.mimeType = mimeType;
      record.sizeBytes = artifact.buffer.length;
      record.localPath = localPath;
      record.cloudinaryUrl =
        artifact.cloudinaryUrl ?? record.cloudinaryUrl ?? null;
      record.s3Url = artifact.s3Url ?? record.s3Url ?? null;
      record.status = 'ready';
      record.checksum = createHash('sha256')
        .update(artifact.buffer)
        .digest('hex');
      record.error = null;
      record.metadata = {
        ...(record.metadata ?? {}),
        ...(artifact.metadata ?? {}),
      };
      record = await this.repository.save(record);
      // Fire-and-forget: a slow Cloudinary/S3 upload must not delay the print
      // response. URLs are written back to the row when uploads finish.
      this.scheduleRemoteUpload(record, artifact.buffer);

      return {
        buffer: artifact.buffer,
        fileName,
        mimeType,
        cacheHit: false,
        record,
      };
    } catch (error: any) {
      record.status = 'failed';
      record.error = error?.message ?? String(error);
      await this.repository.save(record);
      throw error;
    }
  }

  private hasRemoteConfig(): boolean {
    return Boolean(
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET) ||
      (process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION &&
        process.env.S3_BUCKET_NAME),
    );
  }

  private scheduleRemoteUpload(record: PrintOrmEntity, buffer: Buffer): void {
    if (!this.hasRemoteConfig()) return;
    if (record.cloudinaryUrl && record.s3Url) return;
    const key = record.id ?? record.cacheKey;
    if (this.uploading.has(key)) return;
    this.uploading.add(key);
    void this.uploadRemote(record, buffer)
      .catch((error: any) => {
        this.logger.warn(
          `Print ${record.cacheKey} remote upload failed: ${error?.message ?? error}`,
        );
      })
      .finally(() => this.uploading.delete(key));
  }

  private async uploadRemote(
    record: PrintOrmEntity,
    buffer: Buffer,
  ): Promise<void> {
    const key = this.remoteKey(record);

    const [cloudinary, s3] = await Promise.allSettled([
      record.cloudinaryUrl
        ? Promise.resolve(record.cloudinaryUrl)
        : this.uploadToCloudinary(buffer, record.fileName, record.mimeType),
      record.s3Url
        ? Promise.resolve(record.s3Url)
        : this.uploadToS3(buffer, key, record.mimeType),
    ]);

    const updates: Partial<PrintOrmEntity> = {};
    if (cloudinary.status === 'fulfilled' && cloudinary.value) {
      updates.cloudinaryUrl = cloudinary.value;
      updates.cloudinaryUploadedAt = new Date();
    } else if (cloudinary.status === 'rejected') {
      this.logger.warn(
        `Cloudinary upload for ${record.cacheKey} failed: ${cloudinary.reason?.message ?? cloudinary.reason}`,
      );
    }
    if (s3.status === 'fulfilled' && s3.value) {
      updates.s3Url = s3.value;
      updates.s3UploadedAt = new Date();
    } else if (s3.status === 'rejected') {
      this.logger.warn(
        `S3 upload for ${record.cacheKey} failed: ${s3.reason?.message ?? s3.reason}`,
      );
    }

    if (Object.keys(updates).length > 0 && record.id) {
      await this.repository.update(record.id, updates as any);
      Object.assign(record, updates);
    }
  }

  private async uploadToCloudinary(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string | null> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return null;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const FormDataCtor = (globalThis as any).FormData;
    const BlobCtor = (globalThis as any).Blob;
    const fetchFn = (globalThis as any).fetch;
    if (!FormDataCtor || !BlobCtor || !fetchFn) {
      throw new Error('Cloudinary upload requires fetch/FormData/Blob support');
    }

    const form = new FormDataCtor();
    form.append('file', new BlobCtor([buffer], { type: mimeType }), fileName);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    const response = await fetchFn(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.status}`);
    }
    const payload = await response.json();
    if (!payload?.secure_url) {
      throw new Error('Cloudinary upload returned no secure_url');
    }
    return payload.secure_url as string;
  }

  private async uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<string | null> {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;
    const bucket = process.env.S3_BUCKET_NAME;
    if (!accessKey || !secretKey || !region || !bucket) return null;

    const now = new Date();
    const stamp = amzDate(now).slice(0, 8);
    const iso = amzDate(now);
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;
    const payloadHash = sha256(buffer);
    const canonicalHeaders = `content-type:${mimeType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${iso}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${stamp}/${region}/${S3_SERVICE}/aws4_request`;
    const stringToSign = `${AWS4_HMAC_SHA256}\n${iso}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const kDate = hmac(`AWS4${secretKey}`, stamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, S3_SERVICE);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = hmac(kSigning, stringToSign).toString('hex');
    const authorization = `${AWS4_HMAC_SHA256} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return new Promise<string>((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length,
            Host: host,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': iso,
            Authorization: authorization,
          },
        },
        (response) => {
          let body = '';
          response.on('data', (chunk) => (body += chunk));
          response.on('end', () => {
            if (
              response.statusCode !== undefined &&
              response.statusCode >= 200 &&
              response.statusCode < 300
            ) {
              resolve(url);
            } else {
              reject(
                new Error(`S3 upload failed: ${response.statusCode} ${body}`),
              );
            }
          });
        },
      );
      request.on('error', reject);
      request.write(buffer);
      request.end();
    });
  }

  private remoteKey(record: PrintOrmEntity): string {
    return [
      process.env.S3_PRINT_PREFIX || 'prints',
      safeSegment(record.resourceType),
      safeSegment(record.resourceId),
      safeSegment(record.fileName),
    ]
      .filter(Boolean)
      .join('/');
  }

  async list(
    organizationId: string,
    query: {
      resourceType?: string;
      resourceId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ data: PrintOrmEntity[]; total: number; page: number; limit: number }> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where: Record<string, unknown> = { organizationId };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    const [data, total] = await this.repository.findAndCount({
      where: where as any,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findById(id: string, organizationId: string): Promise<PrintOrmEntity> {
    const record = await this.repository.findOne({
      where: { id, organizationId },
    });
    if (!record) throw new NotFoundException('Print not found');
    return record;
  }

  /**
   * Manual upload action used by the prints table/API. Uploads the cached
   * local file (or downloads a remote copy if local is gone) and updates the
   * corresponding columns on the prints row.
   */
  async uploadNow(
    id: string,
    organizationId: string,
    target: 'cloudinary' | 's3' | 'both' = 'both',
  ): Promise<PrintOrmEntity> {
    const record = await this.repository.findOne({
      where: { id, organizationId },
    });
    if (!record) throw new NotFoundException('Print not found');

    let buffer = await this.readLocal(record.localPath);
    if (!buffer && record.cloudinaryUrl) {
      buffer = await this.download(record.cloudinaryUrl);
    }
    if (!buffer && record.s3Url) {
      buffer = await this.download(record.s3Url);
    }
    if (!buffer) {
      throw new NotFoundException('No cached print file available');
    }

    const updates: Partial<PrintOrmEntity> = {};
    if (target === 'cloudinary' || target === 'both') {
      const url = await this.uploadToCloudinary(
        buffer,
        record.fileName,
        record.mimeType,
      );
      if (!url) throw new Error('Cloudinary is not configured');
      updates.cloudinaryUrl = url;
      updates.cloudinaryUploadedAt = new Date();
    }
    if (target === 's3' || target === 'both') {
      const url = await this.uploadToS3(
        buffer,
        this.remoteKey(record),
        record.mimeType,
      );
      if (!url) throw new Error('S3 is not configured');
      updates.s3Url = url;
      updates.s3UploadedAt = new Date();
    }

    await this.repository.update(id, updates as any);
    return (await this.repository.findOne({
      where: { id, organizationId },
    })) as PrintOrmEntity;
  }

  private storageRoot(): string {
    return (
      process.env.PRINT_STORAGE_PATH || join(process.cwd(), 'uploads', 'prints')
    );
  }

  private resolveLocal(localPath: string): string {
    return isAbsolute(localPath)
      ? localPath
      : join(this.storageRoot(), localPath);
  }

  private async readLocal(localPath: string | null): Promise<Buffer | null> {
    if (!localPath) return null;
    try {
      return await fs.readFile(this.resolveLocal(localPath));
    } catch {
      return null;
    }
  }

  private async writeLocal(
    existingPath: string | null,
    buffer: Buffer,
    fileName?: string,
  ): Promise<string> {
    const relative =
      existingPath ??
      join(
        safeSegment(fileName ? dirname(fileName) : ''),
        `${Date.now()}-${safeSegment(fileName ?? 'document.pdf')}`,
      );
    const target = this.resolveLocal(relative);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return relative;
  }

  private async download(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
}
