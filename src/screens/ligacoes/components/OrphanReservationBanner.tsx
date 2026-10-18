import React from 'react';
import { Text, View } from 'react-native';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import type { LigacaoMinhaReserva } from '@/store/ligacao/ligacaoTypes';
import { VAZIO, formatHora } from '../ligacaoViewModel';
import { LigacaoButton } from './LigacaoButton';

interface OrphanReservationBannerProps {
  reserva: LigacaoMinhaReserva;
  disabled: boolean;
  onLiberar: (displayId: number) => void;
}

/**
 * My live reservation whose lead is no longer listed. Without it every
 * "Vou ligar" stays disabled and there is no way to let go of the lead.
 */
export const OrphanReservationBanner = ({
  reserva,
  disabled,
  onLiberar,
}: OrphanReservationBannerProps) => (
  <View
    style={tailwind.style('mx-4 mt-3 p-3 rounded-[12px] bg-amber-100 flex-row items-center gap-3')}>
    <Text style={tailwind.style('flex-1 text-sm text-gray-950')}>
      {I18n.t('LIGACOES.BANNER_RESERVA', {
        lead: reserva.lead || VAZIO,
        hora: formatHora(reserva.until),
      })}
    </Text>
    <LigacaoButton
      variant="destructive"
      text={I18n.t('LIGACOES.ACTIONS.LIBERAR')}
      disabled={disabled}
      onPress={() => onLiberar(reserva.display_id)}
    />
  </View>
);
