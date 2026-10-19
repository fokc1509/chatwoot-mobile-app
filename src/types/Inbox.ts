import { Channel } from './common/Channel';
import type { MetaInboxConfig } from '@/store/meta-template/metaTemplateTypes';

export type Inbox = {
  id: number;
  avatarUrl: string;
  channelId: number;
  name: string;
  channelType: Channel;
  phoneNumber: string;
  medium: string;
  additionalAttributes?: {
    agentReplyTimeWindowMessage?: string;
  };
  provider: string;
  // `meta_inbox_config` (camelCased by transformInbox); enables Meta templates.
  metaInboxConfig?: MetaInboxConfig | null;
};
