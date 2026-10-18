import { Linking } from 'react-native';

import { startLeadCall } from '../leadCall';
import { showToast } from '@/utils/toastUtils';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/utils/toastUtils', () => ({
  showToast: jest.fn(),
}));

const openURL = Linking.openURL as jest.Mock;

describe('startLeadCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openURL.mockResolvedValue(true);
  });

  it('keeps a leading + and strips everything else but digits', async () => {
    await startLeadCall({ displayId: 1, telefone: '+55 (11) 98765-4321' });
    expect(openURL).toHaveBeenCalledWith('tel:+5511987654321');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('dials digits only when there is no leading +', async () => {
    await startLeadCall({ displayId: 1, telefone: '(11) 3333-4444' });
    expect(openURL).toHaveBeenCalledWith('tel:1133334444');
  });

  it('drops a + that is not leading', async () => {
    await startLeadCall({ displayId: 1, telefone: ' 11+3333' });
    expect(openURL).toHaveBeenCalledWith('tel:113333');
  });

  it('shows NO_PHONE and does not dial when the phone is empty', async () => {
    await startLeadCall({ displayId: 1, telefone: '' });
    expect(openURL).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ message: 'LIGACOES.ERRORS.NO_PHONE' });
  });

  it('shows NO_PHONE when nothing but a + is left after normalizing', async () => {
    await startLeadCall({ displayId: 1, telefone: '+ ( ) -' });
    expect(openURL).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ message: 'LIGACOES.ERRORS.NO_PHONE' });
  });

  it('shows DIALER when the dialer cannot be opened', async () => {
    openURL.mockRejectedValue(new Error('no dialer'));
    await expect(startLeadCall({ displayId: 1, telefone: '1133334444' })).resolves.toBeUndefined();
    expect(showToast).toHaveBeenCalledWith({ message: 'LIGACOES.ERRORS.DIALER' });
  });
});
