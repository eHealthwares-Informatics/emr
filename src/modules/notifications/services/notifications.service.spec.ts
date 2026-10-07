import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: ReturnType<typeof repoMock>;
  let recipientRepo: ReturnType<typeof repoMock>;
  let subscriptionRepo: ReturnType<typeof repoMock>;
  let templateRender: {
    resolveActiveTemplate: jest.Mock;
    render: jest.Mock;
  };

  const notification = {
    id: 'notif-1',
    title: 'New request REQ-1 created',
    body: 'New request REQ-1 created',
    type: 'info',
    sourceEntityType: 'request',
    sourceEntityId: 'req-1',
    sourceEntityRef: 'REQ-1',
    organizationId: 'org-1',
    locationId: 'loc-1',
    createdAt: new Date('2026-10-06T08:00:00.000Z'),
  };

  const recipientRow = {
    id: 'rcpt-1',
    notificationId: 'notif-1',
    userId: 'user-1',
    read: false,
    readAt: null,
    notification,
    createdAt: new Date('2026-10-06T08:00:00.000Z'),
  };

  beforeEach(() => {
    notificationRepo = repoMock();
    recipientRepo = repoMock();
    subscriptionRepo = repoMock();
    templateRender = {
      resolveActiveTemplate: jest.fn(),
      render: jest.fn(),
    };
    service = new NotificationsService(
      notificationRepo as never,
      recipientRepo as never,
      subscriptionRepo as never,
      templateRender as never,
    );
  });

  describe('list', () => {
    it('orders by notification.createdAt property path (not created_at)', async () => {
      recipientRepo.qbState.list = [recipientRow];
      recipientRepo.qbState.total = 1;

      const result = await service.list(listQuery(), tenant, user);

      // Regression: orderBy with the DB column name (`notification.created_at`)
      // crashes TypeORM skip/take + join pagination
      // (findColumnWithPropertyPath('created_at') → undefined.databaseName).
      const qb = recipientRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.orderBy).toHaveBeenCalledWith('notification.createdAt', 'DESC');
      expect(qb.innerJoinAndSelect).toHaveBeenCalledWith(
        'recipient.notification',
        'notification',
      );
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual({
        id: 'notif-1',
        title: 'New request REQ-1 created',
        body: 'New request REQ-1 created',
        type: 'info',
        sourceEntityType: 'request',
        sourceEntityId: 'req-1',
        sourceEntityRef: 'REQ-1',
        organizationId: 'org-1',
        locationId: 'loc-1',
        read: false,
        readAt: null,
        createdAt: notification.createdAt,
      });
    });

    it('applies since cursor and tenant scope', async () => {
      recipientRepo.qbState.list = [];
      recipientRepo.qbState.total = 0;

      await service.list(
        listQuery({ since: '2026-10-06T08:58:26.069Z' }),
        tenant,
        user,
      );

      const qb = recipientRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'notification.created_at > :since',
        { since: new Date('2026-10-06T08:58:26.069Z') },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(notification.organization_id = :orgId OR notification.organization_id IS NULL)',
        { orgId: 'org-1' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(notification.location_id = :locId OR notification.location_id IS NULL)',
        { locId: 'loc-1' },
      );
    });

    it('ignores invalid since values', async () => {
      recipientRepo.qbState.list = [];
      recipientRepo.qbState.total = 0;

      await service.list(
        listQuery({ since: 'not-a-date' }),
        tenant,
        user,
      );

      const qb = recipientRepo.createQueryBuilder.mock.results[0].value;
      const sinceCalls = qb.andWhere.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('created_at >'),
      );
      expect(sinceCalls).toHaveLength(0);
    });
  });

  describe('unreadCount', () => {
    it('counts unread recipients for the current user', async () => {
      recipientRepo.qbState.total = 3;

      await expect(service.unreadCount(tenant, user)).resolves.toEqual({
        count: 3,
      });

      const qb = recipientRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('recipient.user_id = :userId', {
        userId: 'user-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('recipient.read = false');
    });
  });

  describe('markRead', () => {
    it('marks a single notification read', async () => {
      const unread = {
        ...recipientRow,
        read: false,
        readAt: null,
      };
      recipientRepo.qbState.getOne = unread;

      const result = await service.markRead('notif-1', tenant, user);

      expect(result.id).toBe('notif-1');
      expect(result.read).toBe(true);
      expect(result.readAt).toBeInstanceOf(Date);
      expect(unread.read).toBe(true);
      expect(unread.readAt).toBeInstanceOf(Date);
      expect(recipientRepo.save).toHaveBeenCalledWith(unread);
    });

    it('is idempotent when already read', async () => {
      const alreadyRead = {
        ...recipientRow,
        read: true,
        readAt: new Date('2026-10-06T09:00:00.000Z'),
      };
      recipientRepo.qbState.getOne = alreadyRead;

      const result = await service.markRead('notif-1', tenant, user);

      expect(result.read).toBe(true);
      expect(result.readAt).toEqual(alreadyRead.readAt);
      expect(recipientRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the notification is not visible to the user', async () => {
      recipientRepo.qbState.getOne = null;
      await expect(service.markRead('missing', tenant, user)).rejects.toThrow(
        'Notification not found',
      );
    });
  });

  describe('markAllRead', () => {
    it('updates all unread recipient rows', async () => {
      recipientRepo.qbState.raw = [{ id: 'rcpt-1' }, { id: 'rcpt-2' }];

      await expect(service.markAllRead(tenant, user)).resolves.toEqual({
        updated: 2,
      });
      expect(recipientRepo.update).toHaveBeenCalledWith(
        ['rcpt-1', 'rcpt-2'],
        expect.objectContaining({ read: true }),
      );
    });

    it('is a no-op when nothing is unread', async () => {
      recipientRepo.qbState.raw = [];
      await expect(service.markAllRead(tenant, user)).resolves.toEqual({
        updated: 0,
      });
      expect(recipientRepo.update).not.toHaveBeenCalled();
    });
  });
});
