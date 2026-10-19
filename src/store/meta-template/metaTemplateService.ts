import type { AxiosRequestConfig } from 'axios';

import { apiService } from '@/services/APIService';
import I18n from '@/i18n';
import type { EmpreendimentosResponse, MetaTemplateRow } from './metaTemplateTypes';

// The server answers permission denials with 401/403, which the global handler
// could turn into a logout. Every template request handles its own errors.
// Responses are returned as-is (no camelCase): variable names must stay intact.
const OPT_OUT: AxiosRequestConfig = { skipGlobalErrorHandler: true };

export class MetaTemplateService {
  static async list(inboxId: number): Promise<MetaTemplateRow[]> {
    const response = await apiService.get<MetaTemplateRow[]>(`inboxes/${inboxId}/meta_templates`, {
      ...OPT_OUT,
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  static async sync(inboxId: number): Promise<void> {
    await apiService.post(`inboxes/${inboxId}/meta_templates/sync`, undefined, { ...OPT_OUT });
  }

  // Endpoint may be absent on older servers (404): any failure means "free text only".
  static async empreendimentos(): Promise<string[]> {
    try {
      const response = await apiService.get<EmpreendimentosResponse>('empreendimentos', {
        ...OPT_OUT,
      });
      const nomes = response.data?.nomes;
      return Array.isArray(nomes)
        ? nomes.filter((nome): nome is string => typeof nome === 'string')
        : [];
    } catch {
      return [];
    }
  }

  static async rawConversation(displayId: number): Promise<Record<string, unknown>> {
    const response = await apiService.get<Record<string, unknown>>(`conversations/${displayId}`, {
      ...OPT_OUT,
    });
    return response.data;
  }

  static async rawInbox(inboxId: number): Promise<Record<string, unknown>> {
    const response = await apiService.get<Record<string, unknown>>(`inboxes/${inboxId}`, {
      ...OPT_OUT,
    });
    return response.data;
  }

  static async sendToWebhook(inboxId: number, payload: unknown): Promise<void> {
    await apiService.post(
      `inboxes/${inboxId}/send_template_to_webhook`,
      { payload },
      { ...OPT_OUT },
    );
  }
}

type ErrorWithResponse = {
  response?: { data?: { error?: unknown } };
};

export const getTemplateErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const message = (error as ErrorWithResponse).response?.data?.error;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return I18n.t('META_TEMPLATES.ERRORS.GENERIC');
};
