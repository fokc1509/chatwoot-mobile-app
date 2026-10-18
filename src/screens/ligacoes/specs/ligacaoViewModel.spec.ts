import {
  RESUMO_MAX,
  canSaveResumo,
  formatHora,
  formatRelativo,
  getCardView,
  getCvLabel,
  getTentativaLabel,
  normalizeResumo,
} from '../ligacaoViewModel';
import type { LigacaoLead, LigacaoMinhaReserva } from '@/store/ligacao/ligacaoTypes';
import { mockLigacaoLead, mockLigacaoLeadNulls } from '@/store/ligacao/specs/ligacaoMockData';

const NOW = new Date('2026-10-18T17:00:00Z');

// Ruling R3: the expected "HH:mm" comes from the device-local clock of the same
// instant, so the test holds in any timezone.
const localHHmm = (iso: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const lead = (overrides: Partial<LigacaoLead> = {}): LigacaoLead => ({
  ...mockLigacaoLead,
  ...overrides,
});

const minhaReserva: LigacaoMinhaReserva = {
  display_id: 42,
  lead: 'Maria Souza',
  until: '2026-10-18T14:50:00-03:00',
  telefone: '+55 11 98765-4321',
};

describe('getCardView', () => {
  it('mine: phone from minhaReserva, "sua até" label and the four actions', () => {
    const view = getCardView(
      lead({
        reserva: {
          agent_id: 1,
          agent_nome: 'Eu',
          until: '2026-10-18T14:50:00-03:00',
          minha: true,
        },
      }),
      minhaReserva,
      NOW,
    );
    expect(view.state).toBe('mine');
    expect(view.telefone).toBe('+55 11 98765-4321');
    expect(view.untilLabel).toBe(`Sua reserva até ${localHHmm(minhaReserva.until)}`);
    expect(view.actions).toEqual(['ligar', 'abrir', 'puxar', 'liberar']);
  });

  it('mine without a matching minhaReserva never borrows another phone', () => {
    const view = getCardView(
      lead({
        reserva: { agent_id: 1, agent_nome: 'Eu', until: '2026-10-18T14:50:00-03:00', minha: true },
      }),
      { ...minhaReserva, display_id: 999 },
      NOW,
    );
    expect(view.state).toBe('mine');
    expect(view.telefone).toBeNull();
    expect(view.actions).toEqual(['ligar', 'abrir', 'puxar', 'liberar']);
  });

  it('reserved_by_other: "Reservado por Ana até 14:35" and no actions', () => {
    const until = '2026-10-18T14:35:00-03:00';
    const view = getCardView(
      lead({
        reserva: { agent_id: 9, agent_nome: 'Ana', until, minha: false },
        pode_reservar: false,
      }),
      null,
      NOW,
    );
    expect(view.state).toBe('reserved_by_other');
    expect(view.reservedLabel).toBe(`Reservado por Ana até ${localHHmm(until)}`);
    expect(view.actions).toEqual([]);
  });

  it('reserved_by_other with a null agent name still renders a label', () => {
    const view = getCardView(mockLigacaoLeadNulls, null, NOW);
    expect(view.state).toBe('reserved_by_other');
    expect(view.reservedLabel).toBe(
      `Reservado por outro corretor até ${localHHmm('2026-10-18T15:00:00Z')}`,
    );
  });

  it('reservable → ["reservar"]', () => {
    const view = getCardView(lead(), null, NOW);
    expect(view.state).toBe('reservable');
    expect(view.actions).toEqual(['reservar']);
  });

  it('disabled → []', () => {
    const view = getCardView(lead({ pode_reservar: false }), null, NOW);
    expect(view.state).toBe('disabled');
    expect(view.actions).toEqual([]);
  });

  it('fills the descriptive labels, with "—" for nulls', () => {
    const view = getCardView(lead(), null, NOW);
    expect(view.nome).toBe('Maria Souza');
    expect(view.empreendimentos).toBe('Residencial Aurora');
    expect(view.respondeuLabel).toBe('Respondeu há 1 d');
    expect(view.ia).toBe('fup-15d');
    expect(view.cvLabel).toBe('prateleira');
    expect(view.tentativaLabel).toBe('João · não atendeu · há 2 d');

    const empty = getCardView(mockLigacaoLeadNulls, null, NOW);
    expect(empty.nome).toBe('—');
    expect(empty.empreendimentos).toBe('—');
    expect(empty.respondeuLabel).toBe('—');
    expect(empty.ia).toBe('—');
    expect(empty.tentativaLabel).toBe('—');
  });
});

describe('formatHora', () => {
  it('formats the local HH:mm and falls back to "—"', () => {
    expect(formatHora('2026-10-18T14:35:00-03:00')).toBe(localHHmm('2026-10-18T14:35:00-03:00'));
    expect(formatHora(null)).toBe('—');
    expect(formatHora('not a date')).toBe('—');
  });
});

describe('formatRelativo', () => {
  it('uses agora / min / h / d', () => {
    expect(formatRelativo('2026-10-18T16:59:40Z', NOW)).toBe('agora');
    expect(formatRelativo('2026-10-18T16:15:00Z', NOW)).toBe('45 min');
    expect(formatRelativo('2026-10-18T14:00:00Z', NOW)).toBe('3 h');
    expect(formatRelativo('2026-10-15T17:00:00Z', NOW)).toBe('3 d');
    expect(formatRelativo(null, NOW)).toBe('—');
  });
});

describe('getCvLabel', () => {
  it('describes each CV state', () => {
    expect(getCvLabel({ estado: 'vinculado', nome: 'Bia', minha: true })).toBe('vinculado a você');
    expect(getCvLabel({ estado: 'vinculado', nome: 'Bia', minha: false })).toBe('vinculado a Bia');
    expect(getCvLabel({ estado: 'vinculado', nome: null, minha: false })).toBe('vinculado no CV');
    expect(getCvLabel({ estado: 'vinculado_sem_usuario', nome: null, minha: false })).toBe(
      'vinculado no CV',
    );
    expect(getCvLabel({ estado: 'livre', nome: null, minha: false })).toBe('prateleira');
  });
});

describe('getTentativaLabel', () => {
  it('uses "?" for a missing agent and "—" without a result', () => {
    expect(
      getTentativaLabel({ agent_nome: null, at: '2026-10-18T16:00:00Z', resultado: 'falei' }, NOW),
    ).toBe('? · falou · há 1 h');
    expect(getTentativaLabel({ agent_nome: 'Ana', at: null, resultado: 'expirou' }, NOW)).toBe(
      'Ana · expirou',
    );
    expect(getTentativaLabel(null, NOW)).toBe('—');
  });
});

describe('resumo helpers', () => {
  it('canSaveResumo rejects empty and whitespace-only text', () => {
    expect(canSaveResumo('')).toBe(false);
    expect(canSaveResumo('   ')).toBe(false);
    expect(canSaveResumo('\n\t ')).toBe(false);
    expect(canSaveResumo(' falei com ele ')).toBe(true);
  });

  it('normalizeResumo trims and cuts at 2000 characters', () => {
    expect(RESUMO_MAX).toBe(2000);
    expect(normalizeResumo('  oi  ')).toBe('oi');
    expect(normalizeResumo('a'.repeat(2500))).toHaveLength(2000);
  });
});

describe('respondeu label', () => {
  it('says "Respondeu agora" under a minute', () => {
    const view = getCardView(lead({ respondeu_at: '2026-10-18T16:59:50Z' }), null, NOW);
    expect(view.respondeuLabel).toBe('Respondeu agora');
  });
});
