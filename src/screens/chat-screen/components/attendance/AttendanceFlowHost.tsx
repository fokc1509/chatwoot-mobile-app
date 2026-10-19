import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';

import { useAppDispatch, useAppSelector } from '@/hooks';
import { attendanceActions } from '@/store/attendance/attendanceActions';
import { canDirectDiscard } from '@/store/attendance/attendanceRules';
import { selectCurrentUserAccountId, selectUser } from '@/store/auth/authSelectors';
import { showToast } from '@/utils/toastUtils';
import {
  INITIAL_FLOW_SESSION,
  flowOutcome,
  flowSessionReducer,
  submitFlow,
  type AttendanceFlow,
  type AttendanceFlowContext,
  type FlowDeps,
  type FlowInput,
  type FlowSession,
} from './attendanceFlowViewModel';
import { AdiarModal } from './AdiarModal';
import { ConfirmModal } from './ConfirmModal';
import { DiscardModal } from './DiscardModal';

export interface AttendanceFlowApi {
  /** Opens the flow's modal; nothing is sent until the agent confirms. */
  open: (flow: AttendanceFlow, ctx: AttendanceFlowContext) => void;
}

const AttendanceFlowContextRef = createContext<AttendanceFlowApi | null>(null);

export const useAttendanceFlow = (): AttendanceFlowApi => {
  const api = useContext(AttendanceFlowContextRef);
  if (!api) throw new Error('useAttendanceFlow must be used inside AttendanceFlowProvider');
  return api;
};

/**
 * Global host (port of cw-arqos AttendanceFlowHost.vue), mounted once around the
 * navigator so the chat header, the conversation actions sheet and the conversation
 * list menu share the same modals.
 */
export const AttendanceFlowProvider = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const accountId = useAppSelector(selectCurrentUserAccountId);
  const [session, dispatchSession] = useReducer(flowSessionReducer, INITIAL_FLOW_SESSION);
  // Synchronous mirror so a double tap in the same frame cannot submit twice.
  const sessionRef = useRef<FlowSession>(INITIAL_FLOW_SESSION);
  const update = useCallback((action: Parameters<typeof flowSessionReducer>[1]) => {
    sessionRef.current = flowSessionReducer(sessionRef.current, action);
    dispatchSession(action);
  }, []);

  const canDirect = canDirectDiscard(user, accountId ?? null);

  const deps = useMemo<FlowDeps>(
    () => ({
      runAction: (conversationId, body) =>
        dispatch(attendanceActions.runAttendanceAction({ conversationId, body })).unwrap(),
      clickOption: payload => dispatch(attendanceActions.clickOption(payload)).unwrap(),
    }),
    [dispatch],
  );

  const open = useCallback<AttendanceFlowApi['open']>(
    (flow, ctx) => update({ type: 'open', flow, ctx, canDirect }),
    [update, canDirect],
  );

  const cancel = useCallback(() => update({ type: 'cancel' }), [update]);
  const clearError = useCallback(() => update({ type: 'clearError' }), [update]);

  const submit = useCallback(
    async (input: FlowInput) => {
      const before = sessionRef.current;
      if (!before.active || before.submitting) return;
      update({ type: 'submit' });
      const result = await submitFlow(deps, before, input);
      if (!result) return;
      const outcome = flowOutcome(before.active.flow, result);
      update({ type: 'finish', outcome });
      if (outcome.toast) showToast({ message: outcome.toast });
    },
    [deps, update],
  );

  const api = useMemo(() => ({ open }), [open]);
  const flow = session.active?.flow;

  return (
    <AttendanceFlowContextRef.Provider value={api}>
      {children}
      <DiscardModal
        visible={flow === 'discard' || flow === 'discard_request_legacy'}
        requestMode={session.active?.requestMode ?? false}
        submitting={session.submitting}
        onSubmit={discard => submit({ discard })}
        onCancel={cancel}
      />
      <AdiarModal
        visible={flow === 'adiar'}
        submitting={session.submitting}
        error={session.error}
        onClearError={clearError}
        onSubmit={adiarMotivo => submit({ adiarMotivo })}
        onCancel={cancel}
      />
      <ConfirmModal
        visible={flow === 'ia' || flow === 'enviar_msg'}
        scope={flow === 'enviar_msg' ? 'ENVIAR_MSG_CONFIRM' : 'IA_CONFIRM'}
        submitting={session.submitting}
        onConfirm={() => submit({})}
        onCancel={cancel}
      />
    </AttendanceFlowContextRef.Provider>
  );
};
