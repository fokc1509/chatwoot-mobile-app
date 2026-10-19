import type { TemplateParams } from './metaTemplateTypes';

// Port of the web's ReplyBox.vue `buildWabaTemplatePayload` (cw-arqos, ~:902). The webhook
// payload must match the web field by field, so this follows the web expression by expression,
// including its fallbacks and quirks. Inputs are RAW snake_case JSON (GET conversations/:id,
// GET inboxes/:id, the auth user) — nothing here may go through camelcaseKeys.

type Raw = Record<string, unknown>;

export interface BuildWabaTemplatePayloadInput {
  /** Raw conversation (web: `currentChat`, GET conversations/:display_id). */
  conversation: Raw;
  /** Raw inbox (web: `inbox`, GET inboxes/:id). Only `name` is read. */
  inbox: Raw;
  /** Raw logged-in user (web: `currentUser`). Only id/name/email are read. */
  sender: Raw;
  /** Current account (web: `accountId` = getCurrentAccountId). */
  account: { id: number };
  /**
   * Web reads `globalConfig.accountName || 'Account'`. The web globalConfig store has no
   * `accountName`, so the web always sends 'Account'. Leave undefined to stay identical.
   */
  globalConfigAccountName?: string;
  /** Message being replied to (web: `inReplyTo`), if any. */
  inReplyTo?: { id?: number } | null;
  templateParams: TemplateParams;
  /** Injectable clock; the web reads `new Date()` / `Date.now()`. */
  now?: Date;
}

export interface WabaTemplatePayloadSender {
  id: unknown;
  name: unknown;
  email: unknown;
  type: 'user';
}

export interface WabaTemplatePayloadMessage {
  id: number;
  content: string;
  account_id: number;
  inbox_id: unknown;
  conversation_id: unknown;
  message_type: 1;
  created_at: number;
  updated_at: string;
  private: false;
  status: 'sent';
  content_type: 'text';
  sender_type: 'User';
  sender_id: unknown;
  sender: WabaTemplatePayloadSender & {
    availability_status: 'online';
    thumbnail: '';
  };
}

export interface WabaTemplatePayload {
  headers: { host: string; 'content-type': string };
  params: Record<string, never>;
  query: Record<string, never>;
  body: {
    account: { id: number; name: string };
    additional_attributes: Record<string, never>;
    content_attributes: { in_reply_to?: number };
    content_type: 'text';
    content: string;
    conversation: {
      additional_attributes: unknown;
      can_reply: unknown;
      channel: unknown;
      contact_inbox: { source_id: unknown };
      id: unknown;
      inbox_id: unknown;
      messages: WabaTemplatePayloadMessage[];
      meta: unknown;
      status: unknown;
      unread_count: 0;
      agent_last_seen_at: number;
    };
    created_at: string;
    id: number;
    inbox: { id: unknown; name: unknown };
    message_type: 'outgoing';
    private: false;
    sender: WabaTemplatePayloadSender;
    event: 'message_created';
    waba_template: {
      waba_template_id: string | number | null;
      waba_template_name: string;
      waba_template_variables: unknown;
    };
  };
  executionMode: 'production';
}

const asRaw = (value: unknown): Raw | undefined =>
  typeof value === 'object' && value !== null ? (value as Raw) : undefined;

export const buildWabaTemplatePayload = ({
  conversation: currentChat,
  inbox,
  sender: currentUser,
  account,
  globalConfigAccountName,
  inReplyTo,
  templateParams: template,
  now: clock = new Date(),
}: BuildWabaTemplatePayloadInput): WabaTemplatePayload => {
  const accountId = account.id;
  const inboxId = currentChat.inbox_id; // web: inboxId() => currentChat.inbox_id
  const now = clock.toISOString();
  const unixTimestamp = Math.floor(clock.getTime() / 1000);
  const fakeMessageId = clock.getTime();

  const messageContent = `Template: ${template.name}`;
  const meta = asRaw(currentChat.meta);
  const metaSenderAttributes = asRaw(asRaw(meta?.sender)?.additional_attributes);

  return {
    headers: {
      host: 'webhooks.arqos.online',
      'content-type': 'application/json',
    },
    params: {},
    query: {},
    body: {
      account: {
        id: accountId,
        name: globalConfigAccountName || 'Account',
      },
      additional_attributes: {},
      content_attributes: inReplyTo?.id ? { in_reply_to: inReplyTo.id } : {},
      content_type: 'text',
      content: messageContent,
      conversation: {
        additional_attributes: currentChat.additional_attributes || {},
        can_reply: currentChat.can_reply,
        channel: currentChat.channel || 'Channel::Api',
        contact_inbox: {
          source_id: metaSenderAttributes?.source_id || '',
        },
        id: currentChat.id,
        inbox_id: inboxId,
        messages: [
          {
            id: fakeMessageId,
            content: messageContent,
            account_id: accountId,
            inbox_id: inboxId,
            conversation_id: currentChat.id,
            message_type: 1,
            created_at: unixTimestamp,
            updated_at: now,
            private: false,
            status: 'sent',
            content_type: 'text',
            sender_type: 'User',
            sender_id: currentUser.id,
            sender: {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              type: 'user',
              availability_status: 'online',
              thumbnail: '',
            },
          },
        ],
        meta: currentChat.meta,
        status: currentChat.status,
        unread_count: 0,
        agent_last_seen_at: unixTimestamp,
      },
      created_at: now,
      id: fakeMessageId,
      inbox: {
        id: inboxId,
        name: inbox.name,
      },
      message_type: 'outgoing',
      private: false,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        type: 'user',
      },
      event: 'message_created',
      waba_template: {
        waba_template_id: template.waba_template_id || template.id || null,
        waba_template_name: template.name,
        waba_template_variables: template.processed_params || {},
      },
    },
    executionMode: 'production',
  };
};
