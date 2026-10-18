import { AppState } from 'react-native';

import { registerLigacaoAccessRefresh } from '../ligacaoAccessRefresh';

const remove = jest.fn();

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('@/store/ligacao/ligacaoActions', () => ({
  ligacaoActions: { checkAccess: jest.fn(() => 'checkAccess-thunk') },
}));

const addEventListener = AppState.addEventListener as jest.Mock;

const currentListener = (): ((status: string) => void) => addEventListener.mock.calls[0][1];

describe('registerLigacaoAccessRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    addEventListener.mockReturnValue({ remove });
  });

  it('subscribes to AppState change without dispatching by itself', () => {
    const dispatch = jest.fn();
    registerLigacaoAccessRefresh(dispatch);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches checkAccess when the app becomes active', () => {
    const dispatch = jest.fn();
    registerLigacaoAccessRefresh(dispatch);
    currentListener()('active');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('checkAccess-thunk');
  });

  it('ignores background and inactive transitions', () => {
    const dispatch = jest.fn();
    registerLigacaoAccessRefresh(dispatch);
    currentListener()('background');
    currentListener()('inactive');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns a cleanup that removes the subscription', () => {
    const unsubscribe = registerLigacaoAccessRefresh(jest.fn());
    expect(remove).not.toHaveBeenCalled();
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
