import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { LisIntegrationService } from './lis-integration.service';
import { PharmacyIntegrationService } from './pharmacy-integration.service';
import type { RequestOrmEntity } from '../entities/request.orm-entity';
import type { RequestItemOrmEntity } from '../entities/request-item.orm-entity';

function makeItem(overrides: Partial<RequestItemOrmEntity> = {}): RequestItemOrmEntity {
  return {
    requestId: 'req-1',
    name: 'Paracetamol',
    code: 'PMC-001',
    quantity: 5,
    itemKind: null,
    referenceCode: null,
    testDefinitionId: null,
    ...overrides,
  } as RequestItemOrmEntity;
}

function makeRequest(overrides: Partial<RequestOrmEntity> = {}): RequestOrmEntity {
  return {
    id: 'req-1',
    requestNumber: 'REQ-1001',
    requestType: 'LAB',
    patientId: 'PAT-77',
    patientName: 'Ada Obi',
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    items: [],
    ...overrides,
  } as RequestOrmEntity;
}

describe('LisIntegrationService', () => {
  let service: LisIntegrationService;
  let httpPost: jest.Mock;

  beforeEach(async () => {
    httpPost = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LisIntegrationService,
        { provide: HttpService, useValue: { post: httpPost } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'EMR_LIS_API_URL' ? 'https://lis.test' : fallback,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(LisIntegrationService);
  });

  it('sends the patient number with the LIS order payload', async () => {
    httpPost.mockReturnValue(of({ data: { id: 'lab-1', orderNumber: 'EMRORD-1001' } }));

    await service.createLabOrder(
      makeRequest({
        items: [makeItem({ itemKind: 'LOINC_TEST', code: '15074-8', testDefinitionId: '15074-8' })],
      }),
      'token',
    );

    expect(httpPost).toHaveBeenCalledWith(
      'https://lis.test/lis/orders',
      expect.objectContaining({
        patientId: 'PAT-77',
        patientNumber: 'PAT-77',
        referenceCode: 'REQ-1001',
        internalReference: 'REQ-1001',
        source: 'emr-encounter-request',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('resolves a LOINC code picked from the picker as the test definition reference', async () => {
    httpPost.mockReturnValue(of({ data: { id: 'lab-1', orderNumber: 'EMRORD-1001' } }));

    await service.createLabOrder(
      makeRequest({
        items: [
          makeItem({ itemKind: 'LOINC_TEST', code: '15074-8', testDefinitionId: '15074-8' }),
        ],
      }),
    );

    const payload = httpPost.mock.calls[0][1];
    expect(payload.items).toEqual([
      expect.objectContaining({
        testDefinitionId: '15074-8',
        referenceCode: 'LOINC_TEST:15074-8',
      }),
    ]);
  });

  it('carries per-line reference codes and specimen notes', async () => {
    httpPost.mockReturnValue(of({ data: { id: 'lab-1', orderNumber: 'EMRORD-1001' } }));

    await service.createLabOrder(
      makeRequest({
        items: [
          makeItem({
            itemKind: 'LOINC_TEST',
            code: '15074-8',
            testDefinitionId: '15074-8',
            referenceCode: 'LOINC_TEST:15074-8',
            specimenNotes: 'Fasting sample',
          }),
        ],
      }),
    );

    const payload = httpPost.mock.calls[0][1];
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        referenceCode: 'LOINC_TEST:15074-8',
        notes: 'Fasting sample',
      }),
    );
  });

  it('rejects lab requests with no resolvable test items', async () => {
    await expect(
      service.createLabOrder(makeRequest({ items: [makeItem({ itemKind: null, code: null })] })),
    ).rejects.toThrow('No LIS test definition ids provided');
    expect(httpPost).not.toHaveBeenCalled();
  });
});

describe('PharmacyIntegrationService', () => {
  let service: PharmacyIntegrationService;
  let httpPost: jest.Mock;

  beforeEach(async () => {
    httpPost = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PharmacyIntegrationService,
        { provide: HttpService, useValue: { post: httpPost } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'EMR_PHARMACY_API_URL' ? 'https://rx.test/api' : fallback,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(PharmacyIntegrationService);
  });

  it('maps stock items, generic products and generic drugs to their rxsoft fields', async () => {
    httpPost.mockReturnValue(of({ data: { id: 'ord-1', orderNumber: 'EMRORD-1001' } }));

    await service.createPrescriptionOrder(
      makeRequest({
        requestType: 'PRESCRIPTION',
        items: [
          makeItem({ name: 'Paracetamol — PMC-001', itemKind: 'STOCK_ITEM', code: 'item-uuid-1' }),
          makeItem({ name: 'Amoxicillin — GENP-1', itemKind: 'GENERIC_PRODUCT', code: 'GENP-1' }),
          makeItem({ name: 'Artemether — NDF-9', itemKind: 'GENERIC_DRUG', code: 'NDF-9' }),
        ],
      }),
    );

    const payload = httpPost.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({
        origin: 'emr-encounter-request',
        externalReference: 'REQ-1001',
        referenceCode: 'REQ-1001',
      }),
    );
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        itemId: 'item-uuid-1',
        referenceCode: 'STOCK_ITEM:item-uuid-1',
      }),
    );
    expect(payload.items[1]).toEqual(
      expect.objectContaining({
        genericItemCode: 'GENP-1',
        referenceCode: 'GENERIC_PRODUCT:GENP-1',
      }),
    );
    expect(payload.items[2]).toEqual(
      expect.objectContaining({
        genericDrugCode: 'NDF-9',
        referenceCode: 'GENERIC_DRUG:NDF-9',
      }),
    );
    expect(payload.items[0].genericItemCode).toBeUndefined();
    expect(payload.items[1].itemId).toBeUndefined();
    expect(payload.items[2].genericItemCode).toBeUndefined();
  });

  it('sends the request number as the order referenceCode', async () => {
    httpPost.mockReturnValue(of({ data: { id: 'ord-1', orderNumber: 'EMRORD-1001' } }));

    await service.createPrescriptionOrder(
      makeRequest({
        requestType: 'PRESCRIPTION',
        items: [makeItem({ itemKind: 'STOCK_ITEM', code: 'item-uuid-1' })],
      }),
    );

    expect(httpPost.mock.calls[0][1]).toEqual(
      expect.objectContaining({ referenceCode: 'REQ-1001' }),
    );
  });

  it('rejects prescriptions with no items', async () => {
    await expect(
      service.createPrescriptionOrder(makeRequest({ requestType: 'PRESCRIPTION', items: [] })),
    ).rejects.toThrow('No prescription items provided');
    expect(httpPost).not.toHaveBeenCalled();
  });
});
