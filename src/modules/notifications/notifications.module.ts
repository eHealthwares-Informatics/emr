import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOrmEntity } from './entities/notification.orm-entity';
import { NotificationRecipientOrmEntity } from './entities/notification-recipient.orm-entity';
import { NotificationSubscriptionOrmEntity } from './entities/notification-subscription.orm-entity';
import { NotificationsService } from './services/notifications.service';
import { NotificationClientService } from './services/notification-client.service';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationSubscriptionsController } from './controllers/notification-subscriptions.controller';
import { IdentityProxyModule } from '../identity-proxy/identity-proxy.module';
import { PatientsModule } from '../patients/patients.module';
import { NotificationPolicyClient } from './services/notification-policy.client';
import { ExternalNotificationsService } from './services/external-notifications.service';

@Module({
  imports: [
    HttpModule,
    IdentityProxyModule,
    TypeOrmModule.forFeature([
      NotificationOrmEntity,
      NotificationRecipientOrmEntity,
      NotificationSubscriptionOrmEntity,
    ]),
    PatientsModule,
  ],
  controllers: [NotificationsController, NotificationSubscriptionsController],
  providers: [
    NotificationsService,
    NotificationClientService,
    NotificationPolicyClient,
    ExternalNotificationsService,
  ],
  exports: [
    NotificationsService,
    NotificationClientService,
    NotificationPolicyClient,
    ExternalNotificationsService,
  ],
})
export class NotificationsModule {}
