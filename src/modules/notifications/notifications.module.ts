import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageTemplateOrmEntity } from './entities/message-template.orm-entity';
import { NotificationOrmEntity } from './entities/notification.orm-entity';
import { NotificationRecipientOrmEntity } from './entities/notification-recipient.orm-entity';
import { NotificationSubscriptionOrmEntity } from './entities/notification-subscription.orm-entity';
import { NotificationsService } from './services/notifications.service';
import { TemplateRenderService } from './services/template-render.service';
import { MessageTemplatesService } from './services/message-templates.service';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationSubscriptionsController } from './controllers/notification-subscriptions.controller';
import { MessageTemplatesController } from './controllers/message-templates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageTemplateOrmEntity,
      NotificationOrmEntity,
      NotificationRecipientOrmEntity,
      NotificationSubscriptionOrmEntity,
    ]),
  ],
  controllers: [
    NotificationsController,
    NotificationSubscriptionsController,
    MessageTemplatesController,
  ],
  providers: [
    NotificationsService,
    TemplateRenderService,
    MessageTemplatesService,
  ],
  exports: [NotificationsService, TemplateRenderService],
})
export class NotificationsModule {}
