import type { MessageTemplateOrmEntity } from '../../notifications/entities/message-template.orm-entity';

export type MessageTemplateSeed = Pick<
  MessageTemplateOrmEntity,
  | 'code'
  | 'name'
  | 'description'
  | 'contentType'
  | 'content'
  | 'maxCharacters'
  | 'destinations'
  | 'channelCodes'
  | 'heartbeatRetries'
  | 'heartbeatIntervalSeconds'
  | 'heartbeatExpirySeconds'
  | 'status'
>;

export const starterMessageTemplates: MessageTemplateSeed[] = [
  {
    code: 'request_created',
    name: 'Request Created',
    description:
      'In-app notification rendered when a clinical request is created',
    contentType: 'free_text',
    content: 'New request {{request_ref}} created',
    maxCharacters: null,
    destinations: ['inapp'],
    channelCodes: ['in_app'],
    heartbeatRetries: 3,
    heartbeatIntervalSeconds: 30,
    heartbeatExpirySeconds: 86400,
    status: 'active',
  },
];
