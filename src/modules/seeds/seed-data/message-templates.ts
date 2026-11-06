export type MessageTemplateSeed = {
  code: string;
  name: string;
  description?: string;
  contentType: 'free_text' | 'limited_text';
  content: string;
  maxCharacters: number | null;
  destinations: string[];
  channelCodes: string[];
  heartbeatRetries: number;
  heartbeatIntervalSeconds: number;
  heartbeatExpirySeconds: number;
  status: 'draft' | 'active' | 'archived';
};

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
