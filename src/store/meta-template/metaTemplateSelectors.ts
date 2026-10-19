import type { RootState } from '@/store';
import type { Inbox } from '@/types/Inbox';
import type { MetaTemplate } from './metaTemplateTypes';

const EMPTY_TEMPLATES: MetaTemplate[] = [];

const entryOf = (state: RootState, inboxId: number | undefined) =>
  inboxId === undefined ? undefined : state.metaTemplates.byInbox[inboxId];

/** null = not checked yet; false = denied by the server (401/403). */
export const selectTemplateAccess =
  (inboxId: number | undefined) =>
  (state: RootState): boolean | null =>
    entryOf(state, inboxId)?.access ?? null;

export const selectTemplates =
  (inboxId: number | undefined) =>
  (state: RootState): MetaTemplate[] =>
    entryOf(state, inboxId)?.templates ?? EMPTY_TEMPLATES;

export const selectTemplatesLoading =
  (inboxId: number | undefined) =>
  (state: RootState): boolean =>
    entryOf(state, inboxId)?.isLoading ?? false;

export const selectEmpreendimentos = (state: RootState) => state.metaTemplates.empreendimentos;

/**
 * The app does not replicate the server permission rule: the button shows when
 * the inbox has the feature on and the server has not denied it yet.
 */
export const shouldShowTemplateButton = (
  inbox: Pick<Inbox, 'metaInboxConfig'> | undefined,
  access: boolean | null,
  isPrivateNote: boolean,
): boolean => Boolean(inbox?.metaInboxConfig?.enabled) && !isPrivateNote && access !== false;
