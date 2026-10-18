import { Linking } from 'react-native';

import I18n from '@/i18n';
import { showToast } from '@/utils/toastUtils';

export interface StartLeadCallParams {
  /** Reserved for phase 5 (calls placed through the server); unused for now. */
  displayId: number;
  telefone: string;
}

/** Keeps a leading `+` (if any) and drops every other non-digit character. */
const normalizePhone = (telefone: string): string => {
  const trimmed = telefone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return trimmed.startsWith('+') ? `+${digits}` : digits;
};

/**
 * The single entry point that starts a call to a lead. In this phase it only
 * opens the native dialer with a `tel:` URL.
 */
export const startLeadCall = async ({
  displayId: _displayId,
  telefone,
}: StartLeadCallParams): Promise<void> => {
  const numero = normalizePhone(telefone ?? '');
  if (!numero) {
    showToast({ message: I18n.t('LIGACOES.ERRORS.NO_PHONE') });
    return;
  }
  try {
    await Linking.openURL(`tel:${numero}`);
  } catch {
    showToast({ message: I18n.t('LIGACOES.ERRORS.DIALER') });
  }
};
