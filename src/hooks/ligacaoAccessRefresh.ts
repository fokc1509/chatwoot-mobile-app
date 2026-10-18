import { AppState, AppStateStatus } from 'react-native';

import { ligacaoActions } from '@/store/ligacao/ligacaoActions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dispatch = (action: any) => unknown;

/**
 * Re-checks access to the "Ligações" tab whenever the app comes back to the
 * foreground. Returns the unsubscribe function.
 */
export const registerLigacaoAccessRefresh = (dispatch: Dispatch): (() => void) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'active') {
      dispatch(ligacaoActions.checkAccess());
    }
  });
  return () => subscription.remove();
};
