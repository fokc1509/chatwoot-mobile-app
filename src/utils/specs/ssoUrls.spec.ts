import { buildSsoAuthUrl, getSsoCallbackUrl } from '../ssoUrls';
import { SsoUtils } from '../ssoUtils';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('@/store/auth/authActions', () => ({ authActions: {} }));
jest.mock('../toastUtils', () => ({ showToast: jest.fn() }));
jest.mock('@/i18n', () => ({ t: (key: string) => key }));

describe('ssoUrls', () => {
  it('builds the SSO callback URL for a scheme', () => {
    expect(getSsoCallbackUrl('arqosatendimento')).toBe('arqosatendimento://auth/saml');
  });

  it('builds the SSO auth URL with the mobile target for a scheme', () => {
    expect(buildSsoAuthUrl('https://atendimento.arqos.online/', 'arqosatendimento-dev')).toBe(
      'https://atendimento.arqos.online/app/login/sso?target=mobile:arqosatendimento-dev',
    );
  });
});

describe('SsoUtils.parseCallbackUrl', () => {
  it('parses an Arqos scheme callback', () => {
    expect(
      SsoUtils.parseCallbackUrl('arqosatendimento://auth/saml?email=a%40b.com&sso_auth_token=t'),
    ).toEqual({ email: 'a@b.com', sso_auth_token: 't', error: undefined });
  });
});

describe('SsoUtils.loginWithSSO', () => {
  it('uses the app variant scheme for the redirect and the SSO target', async () => {
    const AuthSession = jest.requireMock('expo-auth-session');
    const WebBrowser = jest.requireMock('expo-web-browser');
    AuthSession.makeRedirectUri.mockReturnValue('arqosatendimento://sso/callback');
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await SsoUtils.loginWithSSO('https://atendimento.arqos.online/');

    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({
      scheme: 'arqosatendimento',
      path: 'sso/callback',
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://atendimento.arqos.online/app/login/sso?target=mobile:arqosatendimento',
      'arqosatendimento://sso/callback',
    );
  });
});
