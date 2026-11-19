import { ServiceUnavailableException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let config: { get: jest.Mock };

  const file = {
    buffer: Buffer.from('hello'),
    originalname: 'consent.pdf',
    mimetype: 'application/pdf',
    size: 5,
  };

  beforeEach(() => {
    config = { get: jest.fn() };
    service = new UploadsService(config as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails with 503 when neither provider is configured', async () => {
    await expect(service.store(file, 'org-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns the Cloudinary URL when Cloudinary succeeds', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'S3_UPLOAD_PREFIX') return 'emr/uploads';
      if (key === 'CLOUDINARY_CLOUD_NAME') return 'demo';
      if (key === 'CLOUDINARY_API_KEY') return 'key';
      if (key === 'CLOUDINARY_API_SECRET') return 'secret';
      return undefined;
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://cdn.test/consent.pdf' }),
    } as never);

    const result = await service.store(file, 'org-1');

    expect(result.url).toBe('https://cdn.test/consent.pdf');
    expect(result.cloudinaryUrl).toBe('https://cdn.test/consent.pdf');
    expect(result.s3Url).toBeNull();
    expect(result.name).toBe('consent.pdf');
    expect(result.key).toContain('emr/uploads/org-1/');
  });
});
