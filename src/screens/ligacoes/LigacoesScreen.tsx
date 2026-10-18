import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TAB_BAR_HEIGHT } from '@/constants';
import { useAppDispatch, useAppSelector } from '@/hooks';
import I18n from '@/i18n';
import type { TabBarExcludedScreenParamList } from '@/navigation/tabs/AppTabs';
import { ligacaoActions } from '@/store/ligacao/ligacaoActions';
import {
  selectIsLigacaoLoading,
  selectLigacaoJanela,
  selectLigacaoJanelas,
  selectLigacaoTab,
  selectMinhaReserva,
  selectOrphanReservation,
  selectPendingDisplayId,
  selectVisibleLeads,
} from '@/store/ligacao/ligacaoSelectors';
import { setTab } from '@/store/ligacao/ligacaoSlice';
import type { LigacaoJanela, LigacaoLead, LigacaoTab } from '@/store/ligacao/ligacaoTypes';
import { tailwind } from '@/theme';
import { startLeadCall } from '@/utils/leadCall';
import { showToast } from '@/utils/toastUtils';
import { LigacaoFilters } from './components/LigacaoFilters';
import { LigacaoLeadCard } from './components/LigacaoLeadCard';
import { LigacaoResumoModal } from './components/LigacaoResumoModal';
import { OrphanReservationBanner } from './components/OrphanReservationBanner';
import { getCardView, normalizeResumo, shouldShowInitialLoader } from './ligacaoViewModel';

/** The queue changes when someone reserves/releases; 60 s keeps up without hammering. */
const REFRESH_MS = 60000;
/** Only used until the first response brings `meta.janelas`. */
const JANELAS_PADRAO: LigacaoJanela[] = [30, 60, 90, 120];

type Navigation = NativeStackNavigationProp<TabBarExcludedScreenParamList>;

interface ResumoPendente {
  displayId: number;
  lead: string | null;
}

const errorMessage = (error: unknown): string =>
  typeof error === 'string' && error ? error : I18n.t('LIGACOES.ERRORS.GENERIC');

const toastError = (error: unknown) => {
  showToast({ message: errorMessage(error) });
};

const LigacoesScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Navigation>();

  const leads = useAppSelector(selectVisibleLeads);
  const minhaReserva = useAppSelector(selectMinhaReserva);
  const orphan = useAppSelector(selectOrphanReservation);
  const janela = useAppSelector(selectLigacaoJanela);
  const janelasDoServidor = useAppSelector(selectLigacaoJanelas);
  const tab = useAppSelector(selectLigacaoTab);
  const isLoading = useAppSelector(selectIsLigacaoLoading);
  const pendingDisplayId = useAppSelector(selectPendingDisplayId);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resumo, setResumo] = useState<ResumoPendente | null>(null);
  const [isSavingResumo, setIsSavingResumo] = useState(false);
  // Shown inside the summary modal: a toast would render under it.
  const [resumoError, setResumoError] = useState<string | null>(null);

  // The poll must keep the selected window without re-arming the interval.
  const janelaRef = useRef(janela);
  janelaRef.current = janela;

  const janelas = janelasDoServidor.length ? janelasDoServidor : JANELAS_PADRAO;
  // Only one write action at a time: any in-flight action locks every card's
  // write buttons (Ligar / Abrir conversa stay available).
  const actionsDisabled = pendingDisplayId !== null;

  useFocusEffect(
    useCallback(() => {
      const fetch = () => dispatch(ligacaoActions.fetchLigacoes(janelaRef.current ?? undefined));
      fetch();
      // Android keeps JS timers running in background: skip those ticks.
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') fetch();
      }, REFRESH_MS);
      return () => clearInterval(interval);
    }, [dispatch]),
  );

  const fetchWithFeedback = useCallback(
    (dias: LigacaoJanela | undefined) =>
      dispatch(ligacaoActions.fetchLigacoes(dias))
        .unwrap()
        .catch(() => toastError(null)),
    [dispatch],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchWithFeedback(janelaRef.current ?? undefined).finally(() => setIsRefreshing(false));
  }, [fetchWithFeedback]);

  const handleJanela = useCallback(
    (dias: LigacaoJanela) => {
      if (dias === janelaRef.current) return;
      // The pending action already selects the chip; the ref also blocks a
      // second tap that lands before the re-render.
      janelaRef.current = dias;
      fetchWithFeedback(dias);
    },
    [fetchWithFeedback],
  );

  const handleTab = useCallback((value: LigacaoTab) => dispatch(setTab(value)), [dispatch]);

  const openConversation = useCallback(
    (displayId: number) => navigation.navigate('ChatScreen', { conversationId: displayId }),
    [navigation],
  );

  const handleReservar = useCallback(
    (lead: LigacaoLead) => {
      dispatch(ligacaoActions.reservar(lead.display_id))
        .unwrap()
        .then(() => showToast({ message: I18n.t('LIGACOES.TOAST.RESERVADO') }))
        .catch(toastError);
    },
    [dispatch],
  );

  const handleLiberar = useCallback(
    (displayId: number) => {
      dispatch(ligacaoActions.liberar(displayId))
        .unwrap()
        .then(() => showToast({ message: I18n.t('LIGACOES.TOAST.LIBERADO') }))
        .catch(toastError);
    },
    [dispatch],
  );

  const handleLiberarLead = useCallback(
    (lead: LigacaoLead) => handleLiberar(lead.display_id),
    [handleLiberar],
  );

  const handleLigar = useCallback((lead: LigacaoLead, telefone: string | null) => {
    startLeadCall({ displayId: lead.display_id, telefone: telefone ?? '' });
  }, []);

  const handleAbrir = useCallback(
    (lead: LigacaoLead) => openConversation(lead.display_id),
    [openConversation],
  );

  // The summary comes BEFORE the conversation: right after hanging up is when
  // the broker still remembers what was said.
  const handlePuxar = useCallback(
    (lead: LigacaoLead) => {
      dispatch(ligacaoActions.puxar(lead.display_id))
        .unwrap()
        // No toast here: the summary modal opens at once and would cover it.
        .then(displayId => {
          setResumoError(null);
          setResumo({ displayId, lead: lead.lead });
        })
        .catch(toastError);
    },
    [dispatch],
  );

  const handleSaveResumo = useCallback(
    (texto: string) => {
      if (!resumo || isSavingResumo) return;
      setIsSavingResumo(true);
      setResumoError(null);
      dispatch(
        ligacaoActions.resumo({ displayId: resumo.displayId, texto: normalizeResumo(texto) }),
      )
        .unwrap()
        .then(() => {
          showToast({ message: I18n.t('LIGACOES.TOAST.RESUMO_SALVO') });
          setResumoError(null);
          setResumo(null);
          openConversation(resumo.displayId);
        })
        // A refused summary keeps the modal open with the text typed and the
        // error shown inline.
        .catch(error => setResumoError(errorMessage(error)))
        .finally(() => setIsSavingResumo(false));
    },
    [dispatch, isSavingResumo, openConversation, resumo],
  );

  const handleSkipResumo = useCallback(() => {
    if (!resumo || isSavingResumo) return;
    setResumoError(null);
    setResumo(null);
    openConversation(resumo.displayId);
  }, [isSavingResumo, openConversation, resumo]);

  const clearResumoError = useCallback(() => setResumoError(null), []);

  const items = useMemo(() => {
    const now = new Date();
    return leads.map(lead => ({ lead, view: getCardView(lead, minhaReserva, now) }));
  }, [leads, minhaReserva]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof items)[number] }) => (
      <LigacaoLeadCard
        lead={item.lead}
        view={item.view}
        actionsDisabled={actionsDisabled}
        onReservar={handleReservar}
        onLigar={handleLigar}
        onAbrir={handleAbrir}
        onPuxar={handlePuxar}
        onLiberar={handleLiberarLead}
      />
    ),
    [actionsDisabled, handleAbrir, handleLiberarLead, handleLigar, handlePuxar, handleReservar],
  );

  const showInitialLoader = shouldShowInitialLoader({
    isLoading,
    isRefreshing,
    hasItems: items.length > 0,
    janela,
  });

  return (
    <SafeAreaView edges={['top']} style={tailwind.style('flex-1 bg-white')}>
      <StatusBar
        translucent
        backgroundColor={tailwind.color('bg-white')}
        barStyle={'dark-content'}
      />
      <View style={tailwind.style('px-4 pt-2 pb-3')}>
        <Text
          style={tailwind.style(
            'text-[17px] text-center leading-[17px] tracking-[0.32px] font-inter-medium-24 text-gray-950',
          )}>
          {I18n.t('LIGACOES.HEADER')}
        </Text>
      </View>
      <LigacaoFilters
        janelas={janelas}
        janela={janela}
        tab={tab}
        total={items.length}
        onJanela={handleJanela}
        onTab={handleTab}
      />
      {orphan ? (
        <OrphanReservationBanner
          reserva={orphan}
          disabled={actionsDisabled}
          onLiberar={handleLiberar}
        />
      ) : null}
      {showInitialLoader ? (
        <View style={tailwind.style('flex-1 items-center justify-center')}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.lead.display_id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={tailwind.style('pt-12 px-4 text-center text-md text-gray-800')}>
              {I18n.t('LIGACOES.EMPTY')}
            </Text>
          }
          contentContainerStyle={tailwind.style(`pb-[${TAB_BAR_HEIGHT + 16}px]`)}
          showsVerticalScrollIndicator={false}
        />
      )}
      <LigacaoResumoModal
        visible={resumo !== null}
        leadNome={resumo?.lead ?? null}
        saving={isSavingResumo}
        error={resumoError}
        onClearError={clearResumoError}
        onSave={handleSaveResumo}
        onSkip={handleSkipResumo}
      />
    </SafeAreaView>
  );
};

export default LigacoesScreen;
