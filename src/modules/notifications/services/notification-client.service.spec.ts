import { of, throwError } from 'rxjs';
import { NotificationClientService } from './notification-client.service';

describe('NotificationClientService dispatch', () => {
  let http: { get: jest.Mock; post: jest.Mock };
  let config: { get: jest.Mock };
  let service: NotificationClientService;

  beforeEach(() => {
    http = {
      get: jest.fn(),
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { sent: 1, failed: 0, skipped: 0, deliveries: ['d1'] } }),
        ),
    };
    config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'CONVERSATION_API_URL')
          return 'http://conversation.test/api';
        if (key === 'INTEROP_API_KEY') return 'emr-key';
        return defaultValue;
      }),
    };
    service = new NotificationClientService(http as never, config as never);
  });

  it('posts the payload to /notification-dispatch/payload', async () => {
    const result = await service.dispatch({
      organizationId: 'org-1',
      eventKey: 'request_created',
      channels: ['email'],
      recipients: { email: 'staff@example.com' },
      subject: 'New request',
      message: 'REQ-1 created',
      context: { request_ref: 'REQ-1' },
    });

    expect(result).toMatchObject({ ok: true, sent: 1, deliveries: ['d1'] });
    expect(http.post).toHaveBeenCalledWith(
      'http://conversation.test/api/notification-dispatch/payload',
      expect.objectContaining({
        organizationId: 'org-1',
        eventKey: 'request_created',
        channels: ['email'],
        recipients: { email: 'staff@example.com' },
        subject: 'New request',
        message: 'REQ-1 created',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'emr-key' }),
      }),
    );
  });

  it('skips dispatch when no channel is supplied', async () => {
    const result = await service.dispatch({
      channels: [],
      recipients: { email: 'staff@example.com' },
    });

    expect(result.ok).toBe(false);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('skips dispatch when the recipient has no address for the channel', async () => {
    const result = await service.dispatch({
      channels: ['email'],
      recipients: { phone: '+2348000000001' },
    });

    expect(result.ok).toBe(false);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('returns not-ok (never throws) when conversation fails', async () => {
    http.post.mockReturnValue(throwError(() => new Error('gateway down')));

    const result = await service.dispatch({
      channels: ['email'],
      recipients: { email: 'staff@example.com' },
    });

    expect(result.ok).toBe(false);
    expect(result.failed).toBe(1);
  });
});
