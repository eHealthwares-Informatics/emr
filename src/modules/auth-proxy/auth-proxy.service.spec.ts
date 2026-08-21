import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AuthProxyService } from './auth-proxy.service';

describe('AuthProxyService', () => {
  let service: AuthProxyService;
  let httpGet: jest.Mock;
  let httpPost: jest.Mock;

  beforeEach(async () => {
    httpGet = jest.fn();
    httpPost = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthProxyService,
        {
          provide: HttpService,
          useValue: { get: httpGet, post: httpPost },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'IDENTITY_SERVICE_URL' ? 'https://identity.test/identity' : fallback,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthProxyService);
  });

  it('forwards login to the identity service and normalizes tokens', async () => {
    httpPost.mockReturnValue(
      of({
        data: {
          accessToken: 'at',
          refreshToken: 'rt',
          accessTokenExpiresIn: 900,
          refreshTokenExpiresIn: 604800,
        },
      }),
    );

    const result = await service.login({ username: 'admin', password: 'secret1' });

    expect(httpPost).toHaveBeenCalledWith(
      'https://identity.test/identity/auth/login',
      { username: 'admin', password: 'secret1' },
      expect.objectContaining({ headers: { 'x-api-key': 'rxsoft-internal-key' } }),
    );
    expect(result).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 604800,
    });
  });

  it('forwards me with the bearer token and returns roles/modules', async () => {
    httpGet.mockReturnValue(
      of({
        data: {
          id: 'u1',
          username: 'alice',
          roles: ['Doctor', 'Specialist', 'Finance'],
          permissions: ['dashboard.view'],
          modules: [{ id: 'm1', name: 'Dashboard', description: 'd', root: '/dashboard' }],
        },
      }),
    );

    const result = await service.me('some-token');

    expect(httpGet).toHaveBeenCalledWith('https://identity.test/identity/auth/me', {
      headers: {
        'x-api-key': 'rxsoft-internal-key',
        Authorization: 'Bearer some-token',
      },
    });
    expect(result.roles).toEqual(['Doctor', 'Specialist', 'Finance']);
    expect(result.modules[0].root).toBe('/dashboard');
  });

  it('rejects an invalid me response with UnauthorizedException', async () => {
    httpGet.mockReturnValue(of({ data: null }));

    await expect(service.me('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forwards refresh-token and logout endpoints', async () => {
    httpPost.mockReturnValue(of({ data: { accessToken: 'at2', refreshToken: 'rt2' } }));

    await service.refreshToken({ refreshToken: 'rt' });
    await service.logout({ refreshToken: 'rt' });
    await service.logoutAll({ refreshToken: 'rt' }, 'tok');

    expect(httpPost).toHaveBeenNthCalledWith(
      1,
      'https://identity.test/identity/auth/refresh-token',
      { refreshToken: 'rt' },
      expect.objectContaining({ headers: { 'x-api-key': 'rxsoft-internal-key' } }),
    );
    expect(httpPost).toHaveBeenNthCalledWith(
      2,
      'https://identity.test/identity/auth/logout',
      { refreshToken: 'rt' },
      expect.objectContaining({ headers: { 'x-api-key': 'rxsoft-internal-key' } }),
    );
    expect(httpPost).toHaveBeenNthCalledWith(
      3,
      'https://identity.test/identity/auth/logout-all',
      { refreshToken: 'rt' },
      expect.objectContaining({
        headers: {
          'x-api-key': 'rxsoft-internal-key',
          Authorization: 'Bearer tok',
        },
      }),
    );
  });
});