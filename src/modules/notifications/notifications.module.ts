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

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      NotificationOrmEntity,
      NotificationRecipientOrmEntity,
      NotificationSubscriptionOrmEntity,
    ]),
  ],
  controllers: [
    NotificationsController,
    NotificationSubscriptionsController,
  ],
  providers: [
    NotificationsService,
    NotificationClientService,
  ],
  exports: [NotificationsService, NotificationClientService],
})
export class NotificationsModule {}
