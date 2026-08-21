import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestOrmEntity } from '../entities/request.orm-entity';
import type { ExternalSyncResult } from './lis-integration.service';

@Injectable()
export class PharmacyIntegrationService {
  private readonly logger = new Logger(PharmacyIntegrationService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('EMR_PHARMACY_API_URL', 'http://localhost:8080/api');
  }

  private get paymentMethod(): string {
    return this.config.get<string>('EMR_PHARMACY_PAYMENT_METHOD', 'cash');
  }

  async createPrescriptionOrder(
    request: RequestOrmEntity,
    token?: string,
  ): Promise<ExternalSyncResult> {
    const items = (request.items ?? []).map((item) => ({
      ...(item.code ? { itemId: item.code } : {}),
      freetextName: item.name,
      quantity: item.quantity ?? 1,
    }));

    if (items.length === 0) {
      throw new Error('No prescription items provided');
    }

    const payload = {
      paymentMethod: this.paymentMethod,
      notes: `${request.orderingProviderName ? `${request.orderingProviderName}: ` : ''}${
        request.clinicalNotes ?? ''
      }`.trim() || undefined,
      items,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/website/orders`, payload, { headers }),
    );

    return {
      externalOrderId: data?.id ?? data?.data?.id ?? null,
      externalReference: data?.orderNumber ?? data?.data?.orderNumber ?? data?.trackingCode ?? null,
    };
  }
}
