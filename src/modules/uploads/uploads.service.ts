import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'crypto';
import * as https from 'https';

export type UploadedFileInput = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type StoredFile = {
  url: string;
  cloudinaryUrl: string | null;
  s3Url: string | null;
  key: string;
  name: string;
  mimeType: string;
  size: number;
};

const S3_SERVICE = 's3';
const AWS4_HMAC_SHA256 = 'AWS4-HMAC-SHA256';

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function amzDate(value: Date): string {
  return value.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {}

  async store(
    file: UploadedFileInput,
    organizationId: string | null,
  ): Promise<StoredFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file received');
    }

    const key = `${this.prefix()}/${organizationId ?? 'global'}/${randomUUID()}-${safeName(
      file.originalname,
    )}`;

    const [cloudinary, s3] = await Promise.allSettled([
      this.uploadToCloudinary(file),
      this.uploadToS3(file, key),
    ]);

    const cloudinaryUrl =
      cloudinary.status === 'fulfilled' ? cloudinary.value : null;
    const s3Url = s3.status === 'fulfilled' ? s3.value : null;

    if (!cloudinaryUrl && !s3Url) {
      const reasons = [cloudinary, s3]
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        )
        .map((result) => String(result.reason?.message ?? result.reason))
        .join('; ');
      this.logger.warn(`File upload failed for ${file.originalname}: ${reasons}`);
      throw new ServiceUnavailableException(
        'File upload failed — neither Cloudinary nor S3 is configured/available',
      );
    }

    return {
      url: cloudinaryUrl ?? (s3Url as string),
      cloudinaryUrl,
      s3Url,
      key,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private prefix(): string {
    return (
      this.config.get<string>('S3_UPLOAD_PREFIX') ?? 'emr/uploads'
    ).replace(/^\/+|\/+$/g, '');
  }

  private async uploadToCloudinary(file: UploadedFileInput): Promise<string> {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary is not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.status}`);
    }
    const payload = (await response.json()) as { secure_url?: string };
    if (!payload?.secure_url) {
      throw new Error('Cloudinary returned no secure_url');
    }
    return payload.secure_url;
  }

  private uploadToS3(
    file: UploadedFileInput,
    key: string,
  ): Promise<string> {
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION');
    const bucket = this.config.get<string>('S3_BUCKET_NAME');
    if (!accessKey || !secretKey || !region || !bucket) {
      return Promise.reject(new Error('S3 is not configured'));
    }

    const now = new Date();
    const stamp = amzDate(now).slice(0, 8);
    const iso = amzDate(now);
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;
    const payloadHash = sha256(file.buffer);
    const canonicalHeaders = `content-type:${file.mimetype}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${iso}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${stamp}/${region}/${S3_SERVICE}/aws4_request`;
    const stringToSign = `${AWS4_HMAC_SHA256}\n${iso}\n${credentialScope}\n${sha256(
      canonicalRequest,
    )}`;
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
            'Content-Type': file.mimetype,
            'Content-Length': file.buffer.length,
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
                new Error(
                  `S3 upload failed: ${response.statusCode} ${body}`,
                ),
              );
            }
          });
        },
      );
      request.on('error', reject);
      request.write(file.buffer);
      request.end();
    });
  }
}
