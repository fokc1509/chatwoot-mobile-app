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
  // Arqos commercial automations (camelCased `automacoes_comerciais`); with `botoes`
  // enabled the inbox uses the attendance flow (see isCommercialInbox).
  automacoesComerciais?: {
    enabled?: boolean;
    botoes?: { enabled?: boolean } | null;
  } | null;
  // Legacy flag (`custom_button_labels`), only a fallback when the setting is absent.
  customButtonLabels?: { enabled?: boolean } | null;
};
