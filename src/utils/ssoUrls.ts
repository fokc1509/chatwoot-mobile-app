// SSO URLs bound to the app variant's own scheme. The server only redirects back to
// `<scheme>://auth/saml` when `target=mobile:<scheme>` names an allow-listed Arqos scheme.
export function getSsoCallbackUrl(scheme: string): string {
  return `${scheme}://auth/saml`;
}

export function buildSsoAuthUrl(installationUrl: string, scheme: string): string {
  return `${installationUrl}app/login/sso?target=mobile:${scheme}`;
}
