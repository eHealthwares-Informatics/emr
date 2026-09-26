import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestOrmEntity } from '../entities/request.orm-entity';
import type { ExternalSyncResult } from './lis-integration.service';
import {
  externalItemCode,
  externalReferenceCode,
} from './external-sync';

@Injectable()
export class PharmacyIntegrationService {
  private readonly logger = new Logger(PharmacyIntegrationService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>(
      'EMR_PHARMACY_API_URL',
      'http://localhost:8080/api',
    );
  }

  private get paymentMethod(): string {
    return this.config.get<string>('EMR_PHARMACY_PAYMENT_METHOD', 'cash');
  }

  async createPrescriptionOrder(
    request: RequestOrmEntity,
    token?: string,
  ): Promise<ExternalSyncResult> {
    const items = (request.items ?? []).map((item) => {
      const kind = item.itemKind;
      const code = externalItemCode(item);
      const line: Record<string, unknown> = {
        freetextName: item.name,
        quantity: item.quantity ?? 1,
        referenceCode: externalReferenceCode(item),
      };
      // Only a picked stock item is a real catalog item id; generic product /
      // generic drug codes go to their dedicated fields so rxsoft can reconcile
      // them without treating them as catalog ids.
      if (kind === 'STOCK_ITEM' && code) {
        line.itemId = code;
      } else if (kind === 'GENERIC_PRODUCT' && code) {
        line.genericItemCode = code;
      } else if (kind === 'GENERIC_DRUG' && code) {
        line.genericDrugCode = code;
      } else if (!kind && code) {
        // Legacy lines: preserve the old behaviour (code arrived as itemId).
        line.itemId = code;
      }
      return line;
    });

    if (items.length === 0) {
      throw new Error('No prescription items provided');
    }

    const payload = {
      origin: 'emr-encounter-request',
      externalReference: request.requestNumber,
      referenceCode: request.requestNumber,
      paymentMethod: this.paymentMethod,
      notes:
        `${request.orderingProviderName ? `${request.orderingProviderName}: ` : ''}${
          request.clinicalNotes ?? ''
        }`.trim() || undefined,
      items,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/website/orders`, payload, { headers }),
    );

    return {
      externalOrderId: data?.id ?? data?.data?.id ?? null,
      externalReference:
        data?.orderNumber ??
        data?.data?.orderNumber ??
        data?.trackingCode ??
        null,
    };
  }
}
