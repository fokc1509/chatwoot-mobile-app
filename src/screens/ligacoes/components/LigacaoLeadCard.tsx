import React, { memo } from 'react';
import { Text, View } from 'react-native';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import type { LigacaoLead } from '@/store/ligacao/ligacaoTypes';
import { isWriteAction, type LigacaoCardView } from '../ligacaoViewModel';
import { LigacaoButton } from './LigacaoButton';

export interface LigacaoLeadCardProps {
  lead: LigacaoLead;
  view: LigacaoCardView;
  /** True while any queue action is in flight; locks only write actions. */
  actionsDisabled: boolean;
  onReservar: (lead: LigacaoLead) => void;
  onLigar: (lead: LigacaoLead, telefone: string | null) => void;
  onAbrir: (lead: LigacaoLead) => void;
  onPuxar: (lead: LigacaoLead) => void;
  onLiberar: (lead: LigacaoLead) => void;
}

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <Text style={tailwind.style('text-cxs leading-[18px] text-gray-800')}>
    <Text style={tailwind.style('font-inter-medium-24 text-gray-900')}>{label}: </Text>
    {value}
  </Text>
);

const MineSection = ({
  lead,
  view,
  actionsDisabled,
  onLigar,
  onAbrir,
  onPuxar,
  onLiberar,
}: LigacaoLeadCardProps) => (
  <View style={tailwind.style('mt-3 p-3 rounded-[12px] bg-amber-50 gap-2')}>
    {view.telefone ? (
      <Text selectable style={tailwind.style('text-lg font-inter-580-24 text-gray-950')}>
        {view.telefone}
      </Text>
    ) : (
      <Text style={tailwind.style('text-sm text-gray-800')}>
        {I18n.t('LIGACOES.CARD.SEM_TELEFONE')}
      </Text>
    )}
    <Text style={tailwind.style('text-cxs text-amber-900')}>{view.untilLabel}</Text>
    <View style={tailwind.style('flex-row gap-2')}>
      <LigacaoButton
        grow
        variant="primary"
        text={I18n.t('LIGACOES.ACTIONS.LIGAR')}
        disabled={actionsDisabled && isWriteAction('ligar')}
        onPress={() => onLigar(lead, view.telefone ?? null)}
      />
      <LigacaoButton
        grow
        text={I18n.t('LIGACOES.ACTIONS.ABRIR_CONVERSA')}
        disabled={actionsDisabled && isWriteAction('abrir')}
        onPress={() => onAbrir(lead)}
      />
    </View>
    <View style={tailwind.style('flex-row gap-2')}>
      <LigacaoButton
        grow
        variant="success"
        text={I18n.t('LIGACOES.ACTIONS.PUXAR')}
        disabled={actionsDisabled && isWriteAction('puxar')}
        onPress={() => onPuxar(lead)}
      />
      <LigacaoButton
        grow
        variant="destructive"
        text={I18n.t('LIGACOES.ACTIONS.LIBERAR')}
        disabled={actionsDisabled && isWriteAction('liberar')}
        onPress={() => onLiberar(lead)}
      />
    </View>
  </View>
);

const LigacaoLeadCardComponent = (props: LigacaoLeadCardProps) => {
  const { lead, view, actionsDisabled, onReservar } = props;

  return (
    <View
      style={tailwind.style(
        'mx-4 mt-3 p-4 rounded-[16px] bg-white border border-blackA-A3',
        view.state === 'mine' ? 'border-amber-600' : '',
      )}>
      <Text numberOfLines={2} style={tailwind.style('text-base font-inter-580-24 text-gray-950')}>
        {view.nome}
      </Text>
      <Text numberOfLines={2} style={tailwind.style('mt-0.5 text-sm text-gray-900')}>
        {view.empreendimentos}
      </Text>
      <Text style={tailwind.style('mt-1 mb-2 text-cxs text-gray-800')}>{view.respondeuLabel}</Text>
      <InfoLine label={I18n.t('LIGACOES.CARD.IA')} value={view.ia} />
      <InfoLine label={I18n.t('LIGACOES.CARD.CV')} value={view.cvLabel} />
      <InfoLine label={I18n.t('LIGACOES.CARD.TENTATIVA')} value={view.tentativaLabel} />

      {view.state === 'mine' ? <MineSection {...props} /> : null}

      {view.state === 'reserved_by_other' ? (
        <Text style={tailwind.style('mt-3 text-sm font-inter-medium-24 text-gray-800')}>
          {view.reservedLabel}
        </Text>
      ) : null}

      {view.state === 'reservable' || view.state === 'disabled' ? (
        <View style={tailwind.style('mt-3 flex-row')}>
          <LigacaoButton
            variant="primary"
            text={I18n.t('LIGACOES.ACTIONS.RESERVAR')}
            disabled={view.state === 'disabled' || (actionsDisabled && isWriteAction('reservar'))}
            onPress={() => onReservar(lead)}
          />
        </View>
      ) : null}
    </View>
  );
};

export const LigacaoLeadCard = memo(LigacaoLeadCardComponent);
