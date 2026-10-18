import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/hooks';
import { selectCurrentUserAccountId } from '@/store/auth/authSelectors';
import { ligacaoActions } from '@/store/ligacao/ligacaoActions';

import { registerLigacaoAccessRefresh } from './ligacaoAccessRefresh';

/**
 * Checks access to the "Ligações" tab on mount, whenever the current account
 * changes and whenever the app returns to the foreground.
 */
export const useLigacaoAccess = (): void => {
  const dispatch = useAppDispatch();
  const accountId = useAppSelector(selectCurrentUserAccountId);

  useEffect(() => {
    dispatch(ligacaoActions.checkAccess());
    return registerLigacaoAccessRefresh(dispatch);
  }, [accountId, dispatch]);
};
