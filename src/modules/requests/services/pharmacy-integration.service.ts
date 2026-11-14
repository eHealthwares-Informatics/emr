import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestOrmEntity } from '../entities/request.orm-entity';
import type { ExternalSyncResult } from './lis-integration.service';
import { externalItemCode, externalReferenceCode } from './external-sync';
import type { PharmacySyncTarget } from '../../../shared/domain/enums';

const DEFAULT_SYNC_TARGET: PharmacySyncTarget = 'prescription';

/**
 * Parse an EMR duration ("7" + "days", "2" + "weeks") into a course length in
 * days. rxsoft prescriptions store `durationDays` (an int), so units it cannot
 * express exactly are left to the pharmacist rather than rounded blindly.
 */
function parseDurationDays(
  duration?: string | null,
  unit?: string | null,
): number | null {
  const value = Number(duration);
  if (!duration || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const normalized = (unit ?? '').trim().toLowerCase();
  if (normalized.startsWith('day') || normalized === 'd') {
    return Math.round(value);
  }
  if (normalized.startsWith('week') || normalized === 'wk') {
    return Math.round(value * 7);
  }
  return null;
}

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

  /**
   * Fallback target for requests that do not record one. Deployments that still
   * want the legacy storefront-order behaviour set `EMR_PHARMACY_SYNC_MODE=order`.
   */
  private get configuredTarget(): PharmacySyncTarget {
    return this.config.get<string>(
      'EMR_PHARMACY_SYNC_MODE',
      DEFAULT_SYNC_TARGET,
    ) === 'order'
      ? 'order'
      : DEFAULT_SYNC_TARGET;
  }

  private headers(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Sends a PRESCRIPTION to rxsoft. The request's own `pharmacySyncTarget` wins;
   * otherwise `EMR_PHARMACY_SYNC_MODE` decides whether it lands in the
   * prescriptions queue (default) or as a pharmacy order.
   */
  async syncPrescription(
    request: RequestOrmEntity,
    token?: string,
    target?: PharmacySyncTarget | null,
  ): Promise<ExternalSyncResult> {
    const resolved = target ?? this.configuredTarget;
    this.logger.debug(
      `Syncing prescription ${request.requestNumber} to rxsoft as ${resolved}`,
    );
    return resolved === 'order'
      ? this.createPrescriptionOrder(request, token)
      : this.createPrescription(request, token);
  }

  /**
   * Prescription route: creates a transcribable rxsoft prescription (with its
   * dosing lines) so a pharmacist can verify/reconcile before dispensing.
   */
  async createPrescription(
    request: RequestOrmEntity,
    token?: string,
  ): Promise<ExternalSyncResult> {
    const lines = (request.items ?? []).map((item, index) => {
      const kind = item.itemKind;
      const code = externalItemCode(item);
      const line: Record<string, unknown> = {
        lineNumber: index + 1,
        freetextName: item.name,
        quantity: item.quantity ?? 1,
        referenceCode: externalReferenceCode(item),
      };
      // Only a picked stock item is a real catalog reference; generic product /
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

      const strength = [item.dose, item.doseUnit].filter(Boolean).join('');
      if (strength) {
        line.strength = strength;
      }
      if (item.frequency) {
        line.frequency = item.frequency;
      }
      const instruction = [
        item.route ? `Route: ${item.route}` : null,
        item.instructions,
      ]
        .filter(Boolean)
        .join(' — ');
      if (instruction) {
        line.instruction = instruction;
      }
      const durationDays = parseDurationDays(item.duration, item.durationUnit);
      if (durationDays) {
        line.durationDays = durationDays;
      }
      return line;
    });

    if (lines.length === 0) {
      throw new Error('No prescription items provided');
    }

    const payload = {
      organizationId: request.organizationId ?? undefined,
      externalReference: request.requestNumber,
      name: request.patientName ?? undefined,
      prescriberName: request.orderingProviderName ?? undefined,
      notes: request.clinicalNotes ?? undefined,
      lines,
    };

    const { data } = await firstValueFrom(
      this.http.post<{
        id?: string;
        externalReference?: string;
        data?: { id?: string; externalReference?: string };
      }>(`${this.baseUrl}/website/prescriptions`, payload, {
        headers: this.headers(token),
      }),
    );

    return {
      externalOrderId: data?.id ?? data?.data?.id ?? null,
      externalReference:
        data?.externalReference ??
        data?.data?.externalReference ??
        request.requestNumber ??
        null,
    };
  }

  /**
   * Order route (legacy): creates a storefront order that a pharmacist
   * dispenses from the order queue.
   */
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

    const { data } = await firstValueFrom(
      this.http.post<{
        id?: string;
        orderNumber?: string;
        trackingCode?: string;
        data?: { id?: string; orderNumber?: string; trackingCode?: string };
      }>(`${this.baseUrl}/website/orders`, payload, {
        headers: this.headers(token),
      }),
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
