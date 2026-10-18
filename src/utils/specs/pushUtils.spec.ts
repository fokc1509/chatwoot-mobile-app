import { transformNotification } from '../camelCaseKeys';
import {
  buildPushPayload,
  findConversationLinkFromPush,
  findNotificationFromFCM,
} from '../pushUtils';

describe('findNotificationFromFCM', () => {
  it('should return notification from FCM HTTP v1 message', () => {
    const message = {
      data: {
        payload: '{"data": {"notification": {"id": 123, "title": "Test Notification"}}}',
      },
    };
    const result = findNotificationFromFCM({ message });
    expect(result).toEqual({ id: 123, title: 'Test Notification' });
  });

  it('should return notification from FCM legacy message', () => {
    const message = {
      data: {
        notification: '{"id": 456, "title": "Legacy Notification"}',
      },
    };
    const result = findNotificationFromFCM({ message });
    expect(result).toEqual({ id: 456, title: 'Legacy Notification' });
  });
});

describe('findConversationLinkFromPush', () => {
  it('should return conversation link if notification_type is conversation_creation', () => {
    const notification = {
      id: 8687,
      notificationType: 'conversation_creation',
      primaryActorId: 14902,
      primaryActorType: 'Conversation',
      primaryActor: { id: 14428 },
    };
    const installationUrl = 'https://app.chatwoot.com';
    const transformedNotification = transformNotification(notification);
    const result = findConversationLinkFromPush({
      notification: transformedNotification,
      installationUrl,
    });
    expect(result).toBe(
      'https://app.chatwoot.com/app/accounts/1/conversations/14428/14902/Conversation',
    );
  });

  it('should return conversation link if notification_type is assigned_conversation_new_message', () => {
    const notification = {
      id: 8694,
      notificationType: 'assigned_conversation_new_message',
      primaryActorId: 58731,
      primaryActorType: 'Message',
      primaryActor: { conversationId: 14429, id: 58731 },
    };
    const installationUrl = 'https://app.chatwoot.com';
    const transformedNotification = transformNotification(notification);
    const result = findConversationLinkFromPush({
      notification: transformedNotification,
      installationUrl,
    });
    expect(result).toBe(
      'https://app.chatwoot.com/app/accounts/1/conversations/14429/58731/Message',
    );
  });

  it('should return conversation link if notification_type is conversation_mention', () => {
    const notification = {
      id: 8690,
      notificationType: 'conversation_mention',
      primaryActorId: 58725,
      primaryActorType: 'Message',
      primaryActor: { conversationId: 14428, id: 58725 },
    };
    const installationUrl = 'https://app.chatwoot.com';
    const transformedNotification = transformNotification(notification);
    const result = findConversationLinkFromPush({
      notification: transformedNotification,
      installationUrl,
    });
    expect(result).toBe(
      'https://app.chatwoot.com/app/accounts/1/conversations/14428/58725/Message',
    );
  });

  it('should return conversation link if notification_type is participating_conversation_new_message', () => {
    const notification = {
      id: 8678,
      notificationType: 'participating_conversation_new_message',
      primaryActorId: 58712,
      primaryActorType: 'Message',
      primaryActor: { conversationId: 14427, id: 58712 },
    };
    const installationUrl = 'https://app.chatwoot.com';
    const transformedNotification = transformNotification(notification);
    const result = findConversationLinkFromPush({
      notification: transformedNotification,
      installationUrl,
    });
    expect(result).toBe(
      'https://app.chatwoot.com/app/accounts/1/conversations/14427/58712/Message',
    );
  });

  it('should return nothing if notification_type is not valid', () => {
    const notification = {
      id: 8678,
      notificationType: 'participating_conversation_message',
      primaryActorId: 58712,
      primaryActorType: 'Message',
      primaryActor: { conversationId: 14427, id: 58712 },
    };
    const installationUrl = 'https://app.chatwoot.com';
    const transformedNotification = transformNotification(notification);
    const result = findConversationLinkFromPush({
      notification: transformedNotification,
      installationUrl,
    });
    expect(result).toBe(undefined);
  });
});

describe('buildPushPayload', () => {
  const baseArgs = {
    appId: 'br.com.arqos.atendimento',
    fcmToken: 'tok',
    deviceId: 'abc',
    deviceName: 'Apple iPhone',
    devicePlatform: 'iOS',
    apiLevel: '17',
    brandName: 'Apple',
    buildNumber: '42',
  };

  it('builds an fcm subscription identified by the Arqos app id', () => {
    const payload = buildPushPayload(baseArgs);
    expect(payload).toEqual({
      subscription_type: 'fcm',
      subscription_attributes: {
        app_id: 'br.com.arqos.atendimento',
        device_id: 'br.com.arqos.atendimento:abc',
        push_token: 'tok',
        deviceName: 'Apple iPhone',
        devicePlatform: 'iOS',
        apiLevel: '17',
        brandName: 'Apple',
        buildNumber: '42',
      },
    });
  });

  it('gives dev and production installs on the same device distinct device ids', () => {
    const production = buildPushPayload(baseArgs);
    const dev = buildPushPayload({ ...baseArgs, appId: 'br.com.arqos.atendimento.dev' });
    expect(dev.subscription_attributes.app_id).toBe('br.com.arqos.atendimento.dev');
    expect(dev.subscription_attributes.device_id).toBe('br.com.arqos.atendimento.dev:abc');
    expect(dev.subscription_attributes.device_id).not.toBe(
      production.subscription_attributes.device_id,
    );
  });
});
