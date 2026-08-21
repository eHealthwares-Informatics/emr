import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ProxyAuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface ProxyMeResponse {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
  modules: { id: string; name: string; description: string; root: string }[];
}

@Injectable()
export class AuthProxyService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('IDENTITY_SERVICE_URL', 'https://api.ehealthwares.com/identity');
  }

  private get apiKey(): string {
    return this.config.get<string>('INTERNAL_API_KEY', 'rxsoft-internal-key');
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'x-api-key': this.apiKey, ...extra };
  }

  async login(payload: { username: string; password: string }): Promise<ProxyAuthResponse> {
    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/auth/login`, payload, { headers: this.headers() }),
    );
    const body = data?.data ?? data;
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      accessTokenExpiresIn: body.accessTokenExpiresIn,
      refreshTokenExpiresIn: body.refreshTokenExpiresIn,
    };
  }

  async refreshToken(payload: { refreshToken: string }): Promise<ProxyAuthResponse> {
    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/auth/refresh-token`, payload, { headers: this.headers() }),
    );
    const body = data?.data ?? data;
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      accessTokenExpiresIn: body.accessTokenExpiresIn,
      refreshTokenExpiresIn: body.refreshTokenExpiresIn,
    };
  }

  async logout(payload: { refreshToken: string }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/auth/logout`, payload, { headers: this.headers() }),
    );
  }

  async logoutAll(payload: { refreshToken: string }, token?: string): Promise<void> {
    const extra: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/auth/logout-all`, payload, {
        headers: this.headers(extra),
      }),
    );
  }

  async me(token: string): Promise<ProxyMeResponse> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.baseUrl}/auth/me`, {
        headers: this.headers({ Authorization: `Bearer ${token}` }),
      }),
    );
    const body = data?.data ?? data;
    if (!body) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return {
      id: body.id,
      username: body.username,
      roles: body.roles ?? [],
      permissions: body.permissions ?? [],
      modules: body.modules ?? [],
    };
  }
}