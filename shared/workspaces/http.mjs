import { WorkspaceError } from './core.mjs';
import { boundedFetch } from './network.mjs';
import { verifyWorkspaceLease } from './lease.mjs';
export class HttpWorkspaceTransport {
  constructor({ client, endpoint, publicKey, issuer, audience, sessionAllowed = () => true }) {
    this.client = client;
    this.endpoint = endpoint;
    this.publicKey = publicKey;
    this.issuer = issuer;
    this.audience = audience;
    this.sessionAllowed = sessionAllowed;
  }
  async request(action, input = {}) {
    if (!this.sessionAllowed())
      throw new WorkspaceError('unauthorized', 'Entre novamente com sua conta Google.');
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session)
      throw new WorkspaceError('unauthorized', 'Entre novamente com sua conta Google.');
    const response = await boundedFetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + data.session.access_token,
      },
      body: JSON.stringify({ action, input }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new WorkspaceError(
        result.code ?? 'network',
        result.error ?? 'Não foi possível sincronizar.',
        result.detail,
      );
    if (action === 'access') {
      const verified = await verifyWorkspaceLease(result.lease, {
        uid: data.session.user.id,
        workspaceId: input.workspace_id,
        generation: result.generation,
        workspaceKind: result.kind,
        publicKey: this.publicKey,
        issuer: this.issuer,
        audience: this.audience,
      });
      return { ...verified, token: result.lease, kind: result.kind };
    }
    return result;
  }
  subscribe(id, fn) {
    const channel = this.client
      .channel('workspace-' + id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_heads',
          filter: 'workspace_id=eq.' + id,
        },
        fn,
      )
      .subscribe();
    return () => void this.client.removeChannel(channel);
  }
  verifyCached(access, context) {
    return verifyWorkspaceLease(access.token, {
      ...context,
      workspaceKind: access.kind,
      publicKey: this.publicKey,
      issuer: this.issuer,
      audience: this.audience,
    });
  }
}
