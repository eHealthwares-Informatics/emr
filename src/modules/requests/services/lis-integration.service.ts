import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestOrmEntity } from '../entities/request.orm-entity';

export type ExternalSyncResult = {
  externalOrderId: string | null;
  externalReference: string | null;
};

@Injectable()
export class LisIntegrationService {
  private readonly logger = new Logger(LisIntegrationService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('EMR_LIS_API_URL', 'http://localhost:8002');
  }

  async createLabOrder(
    request: RequestOrmEntity,
    token?: string,
  ): Promise<ExternalSyncResult> {
    const items = (request.items ?? [])
      .map((item) => ({
        testDefinitionId: item.testDefinitionId ?? item.code,
        notes: item.specimenNotes ?? item.notes ?? undefined,
      }))
      .filter((item) => !!item.testDefinitionId);

    if (items.length === 0) {
      throw new Error(
        'No LIS test definition ids provided on lab request items',
      );
    }

    const payload = {
      source: 'emr-encounter-request',
      patientId: request.patientId,
      patientName: request.patientName,
      internalReference: request.requestNumber,
      requestedDate: request.requestedAt.toISOString().slice(0, 10),
      requesterName: request.orderingProviderName ?? undefined,
      diagnosis: request.diagnosis ?? undefined,
      clinicalNotes: request.clinicalNotes ?? undefined,
      items,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/lis/orders`, payload, { headers }),
    );

    return {
      externalOrderId: data?.id ?? data?.data?.id ?? null,
      externalReference: data?.orderNumber ?? data?.data?.orderNumber ?? null,
    };
  }

  async cancelLabOrder(externalOrderId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/lis/orders/${externalOrderId}`,
        { status: 'CANCELLED' },
        { headers },
      ),
    );
  }
}
