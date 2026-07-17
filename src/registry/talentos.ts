/**
 * Registro de talentos. Talentos são o "como" da skill: área maior, cast
 * menor, dano ao longo do tempo vs. instantâneo, enxame vs. colosso etc.
 *
 * Cada talento tem ranks e efeitos declarativos que o motor de skills lê.
 * Ramos mutuamente exclusivos usam `exclusivoCom`.
 */

import type { EscolaId } from './escolas';

export type TalentoId =
  | 'area_ampliada'
  | 'conjuracao_rapida'
  | 'alcance_estendido'
  | 'canalizacao_profunda'
  | 'impacto_imediato'
  | 'dano_ao_longo_do_tempo'
  | 'enxame'
  | 'colosso'
  | 'vinculo_marcial'
  | 'economia_de_recurso';

export type EfeitoTalento =
  | { tipo: 'raio_maximo_bonus'; valorPorRank: number }
  | { tipo: 'tempo_conjuracao_minimo_reducao'; valorPorRank: number }
  | { tipo: 'alcance_bonus_metros'; valorPorRank: number }
  | { tipo: 'energia_maxima_bonus_fracao'; valorPorRank: number }
  | { tipo: 'foco_entrega'; entrega: 'instantaneo' | 'continuo'; bonusFracaoPorRank: number }
  | { tipo: 'invocacao_quantidade_bonus'; valorPorRank: number }
  | { tipo: 'invocacao_potencia_bonus_fracao'; valorPorRank: number }
  | { tipo: 'custo_reducao_fracao'; valorPorRank: number };

export interface TalentoDef {
  id: TalentoId;
  nome: string;
  descricao: string;
  ranksMaximos: number;
  /** Escola exigida (e nível mínimo nela) para abrir o talento. */
  requisito?: { escola: EscolaId; nivelMinimo: number };
  /** Ramos exclusivos: ter ranks aqui bloqueia ranks nos listados. */
  exclusivoCom?: TalentoId[];
  efeitos: EfeitoTalento[];
}

export const TALENTOS: Record<TalentoId, TalentoDef> = {
  area_ampliada: {
    id: 'area_ampliada',
    nome: 'Área Ampliada',
    descricao: 'Aumenta o raio máximo configurável das suas skills.',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'raio_maximo_bonus', valorPorRank: 2 }],
  },
  conjuracao_rapida: {
    id: 'conjuracao_rapida',
    nome: 'Conjuração Rápida',
    descricao: 'Reduz o tempo mínimo de conjuração configurável.',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'tempo_conjuracao_minimo_reducao', valorPorRank: 0.1 }],
  },
  alcance_estendido: {
    id: 'alcance_estendido',
    nome: 'Alcance Estendido',
    descricao: 'Aumenta a distância máxima de lançamento.',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'alcance_bonus_metros', valorPorRank: 5 }],
  },
  canalizacao_profunda: {
    id: 'canalizacao_profunda',
    nome: 'Canalização Profunda',
    descricao: 'Permite investir mais energia por skill que o normal.',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'energia_maxima_bonus_fracao', valorPorRank: 0.1 }],
  },
  impacto_imediato: {
    id: 'impacto_imediato',
    nome: 'Impacto Imediato',
    descricao: 'Especializa em dano instantâneo (exclui Dano ao Longo do Tempo).',
    ranksMaximos: 3,
    exclusivoCom: ['dano_ao_longo_do_tempo'],
    efeitos: [{ tipo: 'foco_entrega', entrega: 'instantaneo', bonusFracaoPorRank: 0.05 }],
  },
  dano_ao_longo_do_tempo: {
    id: 'dano_ao_longo_do_tempo',
    nome: 'Dano ao Longo do Tempo',
    descricao: 'Especializa em efeitos contínuos (exclui Impacto Imediato).',
    ranksMaximos: 3,
    exclusivoCom: ['impacto_imediato'],
    efeitos: [{ tipo: 'foco_entrega', entrega: 'continuo', bonusFracaoPorRank: 0.05 }],
  },
  enxame: {
    id: 'enxame',
    nome: 'Enxame',
    descricao: 'Evoca mais criaturas, individualmente mais fracas.',
    ranksMaximos: 4,
    requisito: { escola: 'evocacao', nivelMinimo: 5 },
    exclusivoCom: ['colosso'],
    efeitos: [{ tipo: 'invocacao_quantidade_bonus', valorPorRank: 1 }],
  },
  colosso: {
    id: 'colosso',
    nome: 'Colosso',
    descricao: 'Evoca menos criaturas, muito mais poderosas.',
    ranksMaximos: 4,
    requisito: { escola: 'evocacao', nivelMinimo: 5 },
    exclusivoCom: ['enxame'],
    efeitos: [{ tipo: 'invocacao_potencia_bonus_fracao', valorPorRank: 0.1 }],
  },
  vinculo_marcial: {
    id: 'vinculo_marcial',
    nome: 'Vínculo Marcial',
    descricao: 'Suas evocações herdam sua técnica de combate físico.',
    ranksMaximos: 3,
    requisito: { escola: 'combate_fisico', nivelMinimo: 5 },
    efeitos: [{ tipo: 'invocacao_potencia_bonus_fracao', valorPorRank: 0.06 }],
  },
  economia_de_recurso: {
    id: 'economia_de_recurso',
    nome: 'Economia de Recurso',
    descricao: 'Reduz o custo efetivo das skills.',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'custo_reducao_fracao', valorPorRank: 0.03 }],
  },
};
