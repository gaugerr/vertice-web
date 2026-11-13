import { icon } from './ui.mjs';
import {
  WorkspaceClient,
  openPreviewWorkspace,
  workspaceEnvironment,
  selectionKey,
} from './workspaces.js';
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
let client,
  spaces = [],
  lastInvite,
  creating = false;
const environment = await workspaceEnvironment();
document.documentElement.dataset.workspaceAuthenticated = String(Boolean(environment.actor));
const actor = environment.actor ?? { uid: 'unauthenticated', email: '', name: '', licensed: false },
  transport = environment.transport;
$('#workspace-login').hidden = environment.mode !== 'staging' || Boolean(environment.actor);
$('#workspace-login').disabled = !environment.configured;
$('#workspace-logout').hidden = environment.mode !== 'staging' || !environment.actor;
$('#workspace-login').onclick = async () => {
  try {
    await environment.login?.();
  } catch (error) {
    feedback(error.message);
  }
};
$('#workspace-logout').onclick = () => void environment.logout?.();
const feedback = (message) => {
  $('#workspace-message').textContent = message;
  $('#workspace-menu-message').textContent = message;
};
function personal() {
  return spaces.find((s) => s.kind === 'personal');
}
async function canSwitch() {
  if ($('#financial-dialog').open || $('#catalog-dialog').open || $('#goal-history').open) {
    feedback('Salve ou cancele o formulário antes de trocar de espaço.');
    return false;
  }
  const frame = $('#shopping-frame');
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const handler = (e) => {
      if (
        e.origin !== location.origin ||
        e.source !== frame.contentWindow ||
        e.data?.type !== 'vertice:workspace-check-result' ||
        e.data.requestId !== requestId
      )
        return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      if (!e.data.allowed)
        feedback('Salve ou feche o formulário de compras antes de trocar de espaço.');
      resolve(e.data.allowed);
    };
    window.addEventListener('message', handler);
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(!client);
    }, 3000);
    frame.contentWindow?.postMessage(
      { type: 'vertice:workspace-check', requestId },
      location.origin,
    );
  });
}
async function activate(id) {
  if (!(await canSwitch())) {
    await render(true);
    return;
  }
  await client?.flush();
  localStorage.setItem(selectionKey(actor.uid), id);
  location.reload();
}
const memberDetails = new Map();
async function refreshSpaces() {
  spaces = environment.spaces ?? spaces;
}
let detailsRequest;
function refreshDetails() {
  return (detailsRequest ??= loadDetails().finally(() => {
    detailsRequest = null;
  }));
}
async function loadDetails() {
  if (!transport) return;
  await environment.refreshSpaces?.();
  await refreshSpaces();
  for (const space of spaces.filter((s) => s.kind === 'shared' && s.status === 'active')) {
    const key = `vertice_members_${environment.project}_${actor.uid}_${space.id}`;
    try {
      const value = await transport.request('members', { workspace_id: space.id });
      memberDetails.set(space.id, value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value) memberDetails.set(space.id, value);
      } catch {
        /* Preserve cached display. */
      }
    }
  }
}
async function render(force = false) {
  if (force) await refreshDetails();
  const revocation = await client?.db.workspaceMeta.get('revoked'),
    access = (await client?.db.workspaceMeta.get('access'))?.value;
  const authRequired = (await client?.db.workspaceMeta.get('auth-required'))?.value;
  $('#workspace-login').hidden =
    environment.mode !== 'staging' || (Boolean(environment.actor) && !authRequired);
  let accessError;
  try {
    await client?.assertRead();
  } catch (error) {
    accessError = error;
  }
  const revoked = Boolean(
    accessError ||
      authRequired ||
      (revocation?.value &&
        (!revocation.generation || revocation.generation === client?.space.generation)) ||
      (access && access.generation !== client?.space.generation),
  );
  document.body.dataset.workspaceBlocked = String(revoked);
  document.body.dataset.workspaceAuthRequired = String(
    environment.mode === 'staging' && !environment.actor,
  );
  $('#workspace-login-panel').hidden = environment.mode !== 'staging' || Boolean(environment.actor);
  $('#workspace-login-start').disabled = !environment.configured;
  $('#workspace-login-start').onclick = () => $('#workspace-login').click();
  $('#workspace-access-block').hidden = !revoked;
  if (authRequired) $('#workspace-access-block h2').textContent = 'Entre novamente com Google';
  else if (accessError?.code === 'access_expired') {
    $('#workspace-access-block h2').textContent = 'Reconecte para validar o acesso';
    $('#workspace-access-block p').textContent = accessError.message;
  }
  if (!environment.actor) {
    feedback(
      environment.configured
        ? 'Entre com Google para abrir o espaço ou aceitar o convite.'
        : (environment.connectionError ??
            'Não foi possível conectar sua conta. Tente novamente em instantes.'),
    );
    $('#workspace-settings-content').textContent =
      'Entre com Google para acessar seu espaço e seus backups.';
    return;
  }
  await refreshSpaces();
  const current = spaces.find((s) => s.id === client?.space.id);
  if (client && current) client.space.writable = current.writable;
  $('#workspace-selector').innerHTML =
    spaces
      .filter((s) => s.status === 'active' || s.id === current?.id)
      .map(
        (s) =>
          `<option value="${esc(s.id)}" ${s.id === current?.id ? 'selected' : ''}>${esc(s.name)}${s.status === 'closed' ? ' · encerrado' : ''}</option>`,
      )
      .join('') || '<option>Sem espaço</option>';
  $('#workspace-selector').disabled =
    spaces.filter((s) => s.status === 'active').length < 2 && current?.status !== 'closed';
  const status =
    current && !current.writable
      ? 'Somente consulta'
      : client
        ? await client.status()
        : 'Aceite um convite';
  const lastSynced = (await client?.db.workspaceMeta.get('last-synced'))?.value;
  $('#workspace-sync').textContent = status;
  $('#sync-last').textContent = lastSynced
    ? 'Última sincronização completa: ' + new Date(lastSynced).toLocaleString('pt-BR')
    : 'Aguardando a primeira sincronização completa';
  const kind =
    status === 'Sincronizado'
      ? 'synced'
      : status.startsWith('Atualizando')
        ? 'syncing'
        : status === 'Sem conexão'
          ? 'offline'
          : 'attention';
  const paths = {
    synced: '<path d="m5 12 4 4L19 6"/>',
    syncing: '<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5M4 17a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',
    offline:
      '<path d="m3 3 18 18M7 7a6 6 0 0 0-1 9H5a4 4 0 0 1-1-8m7-4a6 6 0 0 1 7 5h1a4 4 0 0 1 2 7M10 17h5"/>',
    attention: '<path d="m12 3 10 18H2ZM12 9v4m0 4h.01"/>',
  };
  $('#sync-toggle').dataset.state = kind;
  $('#sync-toggle').setAttribute('aria-label', 'Sincronização: ' + status);
  $('#sync-toggle').title = status;
  $('#sync-icon').innerHTML = paths[kind];
  $('#sync-review').hidden = status !== 'Precisa de atenção';
  let content = '<p>Seu login pessoal continua separado do espaço compartilhado.</p>';
  actor.licensed =
    environment.mode === 'demo'
      ? actor.licensed
      : spaces.some((s) => s.kind === 'personal' && s.writable);
  const shared = spaces.find((s) => s.kind === 'shared' && s.status === 'active');
  if (!shared) {
    content += actor.licensed
      ? '<button class="primary" id="workspace-create">Compartilhar com alguém</button>'
      : '<p>Use o link recebido da outra pessoa para entrar no espaço compartilhado. Para ter seu espaço pessoal, entre com a conta Google vinculada à sua compra.</p>';
  } else {
    const data = memberDetails.get(shared.id);
    if (!data) content += '<p class="muted">Atualizando participantes…</p>';
    else {
      content += `<h3>${esc(shared.name)}</h3><p class="muted">Compras e todo o financeiro deste espaço são visíveis para os dois.</p>${data.members.map((m) => `<div class="workspace-member"><div><strong>${esc(m.display_name ?? m.name)}</strong><small>${m.role === 'owner' ? 'Titular' : 'Participante'} · ${esc(m.email)}</small></div>${shared.role === 'owner' && m.role !== 'owner' ? `<button class="secondary" data-workspace-remove="${esc(m.user_id)}">Remover</button>` : ''}</div>`).join('')}`;
      if (shared.role === 'owner') {
        if (data.members.length < 2)
          content += `<label>E-mail Google do convidado<input id="workspace-invite-email" type="email" value="${esc(data.pending[0]?.email ?? '')}"></label><button class="secondary" id="workspace-invite">${data.pending.length ? 'Gerar novo convite' : 'Gerar convite'}</button>${data.pending.length ? '<button class="text-button" id="workspace-revoke">Cancelar convite</button>' : ''}`;
        if (lastInvite)
          content += `<label>Link do convite<input id="workspace-invite-link" readonly value="${esc(lastInvite)}"></label><div class="workspace-buttons"><button class="primary" id="workspace-share">Compartilhar convite</button><button class="secondary" id="workspace-copy-link">Copiar link</button></div>`;
        if (personal())
          content +=
            '<button class="secondary" id="workspace-copy-data">Copiar meus dados para o casal</button>';
        content +=
          '<button class="text-button" id="workspace-close">Encerrar compartilhamento</button>';
      } else content += '<button class="secondary" id="workspace-leave">Sair do espaço</button>';
    }
  }
  const archives = spaces.filter((s) => s.kind === 'shared' && s.status === 'closed');
  if (archives.length)
    content += `<details><summary>Espaços encerrados</summary>${archives.map((s) => `<button class="text-button" data-workspace-open="${s.id}">${esc(s.name)} · consultar e exportar</button>`).join('')}</details>`;
  $('#workspace-settings-content').innerHTML = content;
  $('#workspace-recovery').hidden = !client || (await client.status()) !== 'Precisa de atenção';
}
function dialog(title, body, submit) {
  const d = $('#workspace-dialog');
  delete $('#workspace-form').dataset.createId;
  $('#workspace-form').innerHTML =
    `<div class="dialog-heading"><h2>${esc(title)}</h2><button type="button" class="icon-button" data-workspace-close-dialog aria-label="Fechar">${icon('close')}</button></div>${body}<p class="error" id="workspace-form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-workspace-close-dialog>Cancelar</button><button class="primary" type="submit">${esc(submit)}</button></div>`;
  d.showModal();
}
async function makeInvite(shared, email) {
  const result = await transport.request('invite', { workspace_id: shared.id, email });
  lastInvite = location.origin + location.pathname + '#convite?token=' + result.token;
  return result;
}
async function inspectInvite() {
  if (!environment.actor) {
    feedback('Entre com Google para aceitar o convite.');
    return;
  }
  const params = new URLSearchParams(location.hash.slice('#convite?'.length)),
    token = params.get('token');
  try {
    const invite = await transport.request('inspect_invite', { token });
    dialog(
      'Entrar em ' + invite.name,
      `<p>${esc(invite.owner)} convidou você para compartilhar listas e todo o financeiro de <strong>${esc(invite.name)}</strong>.</p><p>Você está usando ${esc(actor.email)}.</p><input name="inviteToken" type="hidden" value="${esc(token)}">`,
      'Entrar no espaço',
    );
  } catch (e) {
    if (environment.mode === 'staging') {
      dialog(
        'Convite do casal',
        `<p>${esc(e.message)}</p><p>Conta atual: ${esc(actor.email)}</p><input name="switchGoogle" type="hidden" value="1">`,
        'Trocar conta Google',
      );
      return;
    }
    dialog(
      'Convite do casal',
      `<p>${esc(e.message)}</p><input name="recoveryClose" type="hidden" value="1">`,
      'Fechar',
    );
  }
}
$('#sync-review').onclick = () => {
  $('#sync-panel').hidePopover();
  $('#workspace-recovery').click();
};
$('#workspace-manage').onclick = () => {
  $('#app-menu').close();
  location.hash = 'configuracoes';
  $('#workspace-settings').scrollIntoView({ behavior: 'smooth' });
};
$('#workspace-selector').onchange = (e) => void activate(e.target.value);
$('#workspace-form').onsubmit = async (e) => {
  e.preventDefault();
  if (creating) return;
  creating = true;
  const submit = $('#workspace-form button[type=submit]');
  submit.disabled = true;
  try {
    const f = new FormData(e.target);
    if (f.has('switchGoogle')) {
      await environment.logout();
      return;
    }
    if (f.has('recoveryClose')) {
      $('#workspace-dialog').close();
      return;
    }
    if (f.has('inviteToken')) {
      const result = await transport.request('accept', { token: f.get('inviteToken') });
      localStorage.setItem(selectionKey(actor.uid), result.workspace_id);
      location.hash = 'compras';
      location.reload();
      return;
    }
    if (f.has('copyArea')) {
      const shared = spaces.find((s) => s.kind === 'shared' && s.status === 'active');
      const source = personal();
      if (!source) throw Error('Origem indisponível.');
      const sourceClient =
        client?.space.id === source.id
          ? client
          : await new WorkspaceClient({
              project: environment.mode === 'demo' ? 'couple_preview' : environment.project,
              actor,
              space: source,
              transport,
            }).initialize();
      await sourceClient.flush();
      if ((await sourceClient.status()) !== 'Sincronizado')
        throw Error('Sincronize seus dados pessoais antes de copiar.');
      await transport.request('copy', {
        workspace_id: shared.id,
        source_id: source.id,
        area: f.get('copyArea'),
        ledger_version: 2,
        operation_id: e.target.dataset.operationId,
      });
      $('#workspace-dialog').close();
      feedback('Cópia independente concluída. Os dados pessoais foram preservados.');
      if (client?.space.id === shared.id) await client.pull();
      await render(true);
      return;
    }
    const shared = await transport.request('create', {
      name: f.get('name'),
      workspace_id: (e.target.dataset.createId ??= crypto.randomUUID()),
    });
    await makeInvite(shared, String(f.get('email')));
    $('#workspace-dialog').close();
    await render(true);
    feedback('Espaço criado vazio. Compartilhe o convite e escolha Nossa casa no seletor.');
  } catch (error) {
    $('#workspace-form-error').textContent = error.message;
  } finally {
    creating = false;
    submit.disabled = false;
  }
};
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    const shared = spaces.find((s) => s.kind === 'shared' && s.status === 'active');
    if (b.hasAttribute('data-workspace-close-dialog')) $('#workspace-dialog').close();
    if (b.id === 'workspace-create')
      dialog(
        'Compartilhar com alguém',
        `<label>Nome do espaço<input name="name" value="Nossa casa" required maxlength="60"></label><label>E-mail Google do convidado<input name="email" type="email" value="" required></label><p>Vocês compartilharão as listas e todo o financeiro deste espaço. Os seus dados pessoais ficam separados.</p>`,
        'Criar espaço e convite',
      );
    if (b.id === 'workspace-invite') {
      await makeInvite(shared, $('#workspace-invite-email').value);
      await render(true);
      feedback('Convite válido por sete dias. O link só pode ser aceito pela conta convidada.');
    }
    if (b.id === 'workspace-revoke') {
      await transport.request('revoke_invite', { workspace_id: shared.id });
      lastInvite = undefined;
      await render(true);
      feedback('Convite cancelado.');
    }
    if (b.id === 'workspace-copy-link') {
      await navigator.clipboard.writeText(lastInvite);
      feedback('Link copiado.');
    }
    if (b.id === 'workspace-share') {
      if (navigator.share)
        await navigator.share({
          title: 'Vértice · Nossa casa',
          text: 'Convite para compartilhar compras e financeiro',
          url: lastInvite,
        });
      else {
        await navigator.clipboard.writeText(lastInvite);
        feedback('Link copiado para compartilhar.');
      }
    }
    if (b.dataset.workspaceOpen) await activate(b.dataset.workspaceOpen);
    if (
      b.dataset.workspaceRemove &&
      confirm(
        'Remover esta pessoa? Os registros ficam no espaço. Um aparelho offline pode manter a autorização por até 24 horas; cópias exportadas não podem ser recolhidas.',
      )
    ) {
      await transport.request('remove', {
        workspace_id: shared.id,
        user_id: b.dataset.workspaceRemove,
      });
      await render(true);
    }
    if (
      b.id === 'workspace-leave' &&
      confirm(
        'Sair do espaço? Os registros continuam com o titular. Não será criada uma cópia pessoal.',
      )
    ) {
      await transport.request('leave', { workspace_id: shared.id });
      localStorage.removeItem(selectionKey(actor.uid));
      location.reload();
    }
    if (
      b.id === 'workspace-close' &&
      confirm(
        'Encerrar o compartilhamento? O convidado perderá o acesso, e o titular manterá consulta e exportação dos registros.',
      )
    ) {
      await transport.request('close', { workspace_id: shared.id });
      localStorage.setItem(selectionKey(actor.uid), personal()?.id ?? '');
      location.reload();
    }
    if (b.id === 'workspace-copy-data') {
      await client?.flush();
      const source = personal();
      let count = 0;
      if (source) {
        const raw = await transport.request('pull', { workspace_id: source.id, cursor: 0 });
        const latest = new Map();
        for (const r of raw.records ?? []) latest.set(r.entity + '/' + r.id, r);
        for (const batch of raw.batches ?? [])
          for (const r of batch.records) latest.set(r.entity + '/' + r.id, r);
        count = [...latest.values()].filter(
          (r) =>
            !r.body.deleted_at &&
            ['shopping_lists', 'finance_entries', 'finance_goals'].includes(r.entity),
        ).length;
      }
      dialog(
        'Copiar meus dados',
        `<p>Encontramos ${count} listas, lançamentos ou metas no espaço pessoal. Será uma cópia independente, visível para os dois.</p><label>O que copiar<select name="copyArea"><option value="both">Compras e financeiro</option><option value="shopping">Somente compras</option><option value="finance">Somente financeiro</option></select></label><p>O destino precisa estar vazio. Os dados pessoais originais serão preservados.</p>`,
        'Confirmar cópia',
      );
      $('#workspace-form').dataset.operationId = crypto.randomUUID();
    }
    if (b.id === 'workspace-recovery') {
      dialog(
        'Revisar alterações pendentes',
        '<p>Outra pessoa alterou os mesmos registros, ou sua participação mudou. Baixe uma cópia antes de usar a versão atual do servidor.</p><button type="button" class="secondary" id="workspace-download-recovery">Baixar minhas alterações</button><button type="button" class="secondary" id="workspace-use-server">Usar versão atual</button><p class="muted">Pagamentos não serão reaplicados automaticamente. Depois de atualizar, confira o restante antes de registrar outro pagamento.</p>',
        'Fechar',
      );
      $('#workspace-form').insertAdjacentHTML(
        'beforeend',
        '<input name="recoveryClose" type="hidden" value="1">',
      );
    }
    if (b.id === 'workspace-download-recovery') {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(await client.recovery(), null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vertice-alteracoes-pendentes.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (
      b.id === 'workspace-use-server' &&
      confirm(
        'Usar os dados atuais do servidor? Sua versão pendente será preservada em uma cópia de recuperação neste aparelho.',
      )
    ) {
      await client.discardConflicts();
      $('#workspace-dialog').close();
      await render(true);
    }
  } catch (error) {
    if (error.name !== 'AbortError') feedback(error.message);
  }
});
try {
  client = await openPreviewWorkspace();
  client.onChange(() => void render().catch((e) => feedback(e.message)));
} catch (e) {
  feedback(e.message);
}
await render().catch((e) => feedback(e.message));
const updateDetails = () =>
  void refreshDetails()
    .then(() => render())
    .catch(() => {});
updateDetails();
setInterval(updateDetails, 30000);
window.addEventListener('online', updateDetails);
window.addEventListener('focus', updateDetails);
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-area=settings],#workspace-manage')) updateDetails();
});
if (location.hash.startsWith('#convite?')) await inspectInvite();
