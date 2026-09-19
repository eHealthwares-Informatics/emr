import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type IdentityUser = {
  id: string;
  organizationId: string | null;
  locationId: string | null;
  username: string;
  phone: string | null;
  email: string | null;
  roles: string[];
  isActive: boolean;
};

export type IdentityLocation = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
};

export type IdentityOrganization = {
  id: string;
  organizationId: string | null;
  name: string;
  code: string | null;
  isActive: boolean;
};

type CachedEntry = { expiresAt: number; value: unknown };

@Injectable()
export class IdentityProxyService {
  private readonly cache = new Map<string, CachedEntry>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>(
      'IDENTITY_SERVICE_URL',
      'https://api.ehealthwares.com/identity',
    );
  }

  private get apiKey(): string {
    return this.config.get<string>('INTERNAL_API_KEY', 'rxsoft-internal-key');
  }

  private cached<T>(
    key: string,
    ttlMs: number,
    fetch: () => Promise<T>,
  ): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return Promise.resolve(hit.value as T);
    }
    return fetch().then((value) => {
      this.cache.set(key, { expiresAt: Date.now() + ttlMs, value });
      return value;
    });
  }

  private systemHeaders(): Record<string, string> {
    return { 'x-api-key': this.apiKey };
  }

  async listUsers(token?: string): Promise<IdentityUser[]> {
    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : this.systemHeaders();
    return this.cached(
      `users:${token ? 'token' : 'apikey'}`,
      30_000,
      async () => {
        const { data } = await firstValueFrom(
          this.http.get(`${this.baseUrl}/users`, { headers }),
        );
        return (data?.data ?? data ?? []) as IdentityUser[];
      },
    );
  }

  async getUser(id: string, token?: string): Promise<IdentityUser | null> {
    const users = await this.listUsers(token);
    return users.find((u) => u.id === id) ?? null;
  }

  async listLocations(token?: string): Promise<IdentityLocation[]> {
    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : this.systemHeaders();
    return this.cached('locations', 60_000, async () => {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/locations`, { headers }),
      );
      return (data?.data ?? data ?? []) as IdentityLocation[];
    });
  }

  async searchLocations(
    query: { page?: number; limit?: number; search?: string },
    organizationId?: string,
  ): Promise<{
    data: IdentityLocation[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.baseUrl}/locations`, {
        headers: this.systemHeaders(),
        params: {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          search: query.search || undefined,
          organizationId: organizationId || undefined,
        },
      }),
    );
    const locations = (data?.data ?? []) as IdentityLocation[];
    const meta = data?.meta ?? {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total: locations.length,
    };
    return { data: locations, meta };
  }

  async getLocation(
    id: string,
    token?: string,
  ): Promise<IdentityLocation | null> {
    const locations = await this.listLocations(token);
    return locations.find((l) => l.id === id) ?? null;
  }

  async getLocationById(
    id: string,
    organizationId?: string,
  ): Promise<IdentityLocation | null> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.baseUrl}/locations/${id}`, {
        headers: this.systemHeaders(),
        params: organizationId ? { organizationId } : undefined,
      }),
    );
    return (data?.data ?? data ?? null) as IdentityLocation | null;
  }

  async listOrganizations(token?: string): Promise<IdentityOrganization[]> {
    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : this.systemHeaders();
    return this.cached('organizations', 120_000, async () => {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/organizations`, { headers }),
      );
      return (data?.data ?? data ?? []) as IdentityOrganization[];
    });
  }

  async resolveProviderName(
    providerId: string | null,
    token?: string,
  ): Promise<string | null> {
    if (!providerId) return null;
    const user = await this.getUser(providerId, token);
    return user?.username ?? user?.email ?? null;
  }
}
