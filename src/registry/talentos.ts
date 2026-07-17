/**
 * Registro de talentos — o "como" do playstyle.
 *
 * Organização:
 *  - Talentos GERAIS: destravam limites de configuração (área, tempo,
 *    energia, custo, alcance).
 *  - RAMOS DE PLAYSTYLE: pares/trios mutuamente exclusivos que definem
 *    identidade (burst vs DoT, enxame vs colosso, precisão vs rajada...).
 *  - Talentos de ESCOLA: exigem nível na escola.
 *  - Talentos de RECURSO: exigem proficiência no recurso e mudam a
 *    dinâmica dele.
 *
 * Efeitos são declarativos; o motor lê `efeitos` e o simulador exibe as
 * propriedades resultantes na skill.
 */

import type { EscolaId } from './escolas';
import type { RecursoId } from './recursos';

export type TalentoId =
  // gerais
  | 'area_ampliada'
  | 'conjuracao_rapida'
  | 'alcance_estendido'
  | 'canalizacao_profunda'
  | 'economia_de_recurso'
  | 'persistencia'
  // playstyle: entrega
  | 'impacto_imediato'
  | 'dano_ao_longo_do_tempo'
  // conjuração
  | 'perfuracao'
  | 'estilhaco'
  | 'eco_arcano'
  // evocação
  | 'enxame'
  | 'colosso'
  | 'vinculo_marcial'
  | 'simbiose'
  | 'autonomia'
  | 'comando'
  // maldição
  | 'contagio'
  | 'aflicao_profunda'
  // bênção
  | 'egide'
  | 'exaltacao'
  | 'vinculo_de_grupo'
  // combate físico
  | 'sequencia_marcial'
  | 'golpe_devastador'
  | 'postura_inabalavel'
  // longo alcance
  | 'olho_de_aguia'
  | 'rajada'
  // recursos
  | 'devocao'
  | 'fluxo_constante'
  | 'sede_de_batalha';

export type EfeitoTalento =
  | { tipo: 'raio_maximo_bonus'; valorPorRank: number }
  | { tipo: 'tempo_conjuracao_minimo_reducao'; valorPorRank: number }
  | { tipo: 'alcance_bonus_metros'; valorPorRank: number }
  | { tipo: 'energia_maxima_bonus_fracao'; valorPorRank: number }
  | { tipo: 'custo_reducao_fracao'; valorPorRank: number }
  | { tipo: 'foco_entrega'; entrega: 'instantaneo' | 'continuo'; bonusFracaoPorRank: number }
  | { tipo: 'invocacao_quantidade_bonus'; valorPorRank: number }
  | { tipo: 'invocacao_potencia_bonus_fracao'; valorPorRank: number }
  /**
   * Propriedade qualitativa que aparece na skill calculada (o runtime do
   * jogo aplica o efeito; a calculadora exibe chave + magnitude).
   */
  | { tipo: 'propriedade'; chave: string; rotulo: string; valorPorRank: number; escola?: EscolaId };

export interface TalentoDef {
  id: TalentoId;
  nome: string;
  descricao: string;
  ranksMaximos: number;
  requisito?: { escola?: EscolaId; recurso?: RecursoId; nivelMinimo: number };
  /** Ramos exclusivos: ter ranks aqui bloqueia ranks nos listados. */
  exclusivoCom?: TalentoId[];
  efeitos: EfeitoTalento[];
}

export const TALENTOS: Record<TalentoId, TalentoDef> = {
  // ------------------- gerais -------------------
  area_ampliada: {
    id: 'area_ampliada',
    nome: 'Área Ampliada',
    descricao: 'Aumenta o raio máximo configurável das suas skills (+2m/rank).',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'raio_maximo_bonus', valorPorRank: 2 }],
  },
  conjuracao_rapida: {
    id: 'conjuracao_rapida',
    nome: 'Conjuração Rápida',
    descricao: 'Reduz o tempo mínimo de conjuração (−0.1s/rank).',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'tempo_conjuracao_minimo_reducao', valorPorRank: 0.1 }],
  },
  alcance_estendido: {
    id: 'alcance_estendido',
    nome: 'Alcance Estendido',
    descricao: 'Aumenta a distância máxima de lançamento (+5m/rank).',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'alcance_bonus_metros', valorPorRank: 5 }],
  },
  canalizacao_profunda: {
    id: 'canalizacao_profunda',
    nome: 'Canalização Profunda',
    descricao: 'Permite investir mais energia por skill (+10%/rank).',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'energia_maxima_bonus_fracao', valorPorRank: 0.1 }],
  },
  economia_de_recurso: {
    id: 'economia_de_recurso',
    nome: 'Economia de Recurso',
    descricao: 'Reduz o custo efetivo das skills (−3%/rank).',
    ranksMaximos: 5,
    efeitos: [{ tipo: 'custo_reducao_fracao', valorPorRank: 0.03 }],
  },
  persistencia: {
    id: 'persistencia',
    nome: 'Persistência',
    descricao: 'Efeitos contínuos e invocações duram mais (+15%/rank).',
    ranksMaximos: 3,
    efeitos: [{ tipo: 'propriedade', chave: 'duracao_bonus', rotulo: 'Duração de efeitos', valorPorRank: 0.15 }],
  },

  // ------------------- playstyle: entrega -------------------
  impacto_imediato: {
    id: 'impacto_imediato',
    nome: 'Impacto Imediato',
    descricao: 'Especializa em dano instantâneo (+5%/rank; exclui DoT).',
    ranksMaximos: 3,
    exclusivoCom: ['dano_ao_longo_do_tempo'],
    efeitos: [{ tipo: 'foco_entrega', entrega: 'instantaneo', bonusFracaoPorRank: 0.05 }],
  },
  dano_ao_longo_do_tempo: {
    id: 'dano_ao_longo_do_tempo',
    nome: 'Dano ao Longo do Tempo',
    descricao: 'Especializa em efeitos contínuos (+5%/rank; exclui Impacto Imediato).',
    ranksMaximos: 3,
    exclusivoCom: ['impacto_imediato'],
    efeitos: [{ tipo: 'foco_entrega', entrega: 'continuo', bonusFracaoPorRank: 0.05 }],
  },

  // ------------------- conjuração -------------------
  perfuracao: {
    id: 'perfuracao',
    nome: 'Perfuração',
    descricao: 'Suas conjurações ignoram parte da defesa (10%/rank; exclui Estilhaço).',
    ranksMaximos: 3,
    requisito: { escola: 'conjuracao', nivelMinimo: 5 },
    exclusivoCom: ['estilhaco'],
    efeitos: [{ tipo: 'propriedade', chave: 'penetracao_defesa', rotulo: 'Penetração de defesa', valorPorRank: 0.1, escola: 'conjuracao' }],
  },
  estilhaco: {
    id: 'estilhaco',
    nome: 'Estilhaço',
    descricao: 'Acertos em alvo único respingam nos vizinhos (12%/rank; exclui Perfuração).',
    ranksMaximos: 3,
    requisito: { escola: 'conjuracao', nivelMinimo: 5 },
    exclusivoCom: ['perfuracao'],
    efeitos: [{ tipo: 'propriedade', chave: 'respingo', rotulo: 'Dano respingado', valorPorRank: 0.12, escola: 'conjuracao' }],
  },
  eco_arcano: {
    id: 'eco_arcano',
    nome: 'Eco Arcano',
    descricao: 'Chance da conjuração repetir de graça (8%/rank).',
    ranksMaximos: 2,
    requisito: { escola: 'conjuracao', nivelMinimo: 10 },
    efeitos: [{ tipo: 'propriedade', chave: 'eco', rotulo: 'Chance de eco', valorPorRank: 0.08, escola: 'conjuracao' }],
  },

  // ------------------- evocação -------------------
  enxame: {
    id: 'enxame',
    nome: 'Enxame',
    descricao: 'Evoca mais criaturas, individualmente mais fracas (+1/rank; exclui Colosso).',
    ranksMaximos: 4,
    requisito: { escola: 'evocacao', nivelMinimo: 5 },
    exclusivoCom: ['colosso'],
    efeitos: [{ tipo: 'invocacao_quantidade_bonus', valorPorRank: 1 }],
  },
  colosso: {
    id: 'colosso',
    nome: 'Colosso',
    descricao: 'Evoca menos criaturas, muito mais poderosas (+10%/rank; exclui Enxame).',
    ranksMaximos: 4,
    requisito: { escola: 'evocacao', nivelMinimo: 5 },
    exclusivoCom: ['enxame'],
    efeitos: [{ tipo: 'invocacao_potencia_bonus_fracao', valorPorRank: 0.1 }],
  },
  vinculo_marcial: {
    id: 'vinculo_marcial',
    nome: 'Vínculo Marcial',
    descricao: 'Suas evocações herdam sua técnica de combate físico (+6%/rank).',
    ranksMaximos: 3,
    requisito: { escola: 'combate_fisico', nivelMinimo: 5 },
    efeitos: [{ tipo: 'invocacao_potencia_bonus_fracao', valorPorRank: 0.06 }],
  },
  simbiose: {
    id: 'simbiose',
    nome: 'Simbiose',
    descricao: 'Suas criaturas curam você com parte do dano que causam (5%/rank).',
    ranksMaximos: 3,
    requisito: { escola: 'evocacao', nivelMinimo: 8 },
    efeitos: [{ tipo: 'propriedade', chave: 'simbiose', rotulo: 'Dano das criaturas vira cura', valorPorRank: 0.05, escola: 'evocacao' }],
  },
  autonomia: {
    id: 'autonomia',
    nome: 'Autonomia',
    descricao: 'Criaturas caçam sozinhas e persistem longe de você (exclui Comando).',
    ranksMaximos: 2,
    requisito: { escola: 'evocacao', nivelMinimo: 10 },
    exclusivoCom: ['comando'],
    efeitos: [{ tipo: 'propriedade', chave: 'autonomia', rotulo: 'Alcance de caça das criaturas', valorPorRank: 0.5, escola: 'evocacao' }],
  },
  comando: {
    id: 'comando',
    nome: 'Comando',
    descricao: 'Criaturas próximas a você ganham poder (+8%/rank; exclui Autonomia).',
    ranksMaximos: 2,
    requisito: { escola: 'evocacao', nivelMinimo: 10 },
    exclusivoCom: ['autonomia'],
    efeitos: [{ tipo: 'invocacao_potencia_bonus_fracao', valorPorRank: 0.08 }],
  },

  // ------------------- maldição -------------------
  contagio: {
    id: 'contagio',
    nome: 'Contágio',
    descricao: 'Maldições pulam para inimigos próximos (+1 salto/rank; exclui Aflição).',
    ranksMaximos: 3,
    requisito: { escola: 'maldicao', nivelMinimo: 5 },
    exclusivoCom: ['aflicao_profunda'],
    efeitos: [{ tipo: 'propriedade', chave: 'saltos_contagio', rotulo: 'Saltos de contágio', valorPorRank: 1, escola: 'maldicao' }],
  },
  aflicao_profunda: {
    id: 'aflicao_profunda',
    nome: 'Aflição Profunda',
    descricao: 'Maldições acumulam no mesmo alvo (+10% por acúmulo/rank; exclui Contágio).',
    ranksMaximos: 3,
    requisito: { escola: 'maldicao', nivelMinimo: 5 },
    exclusivoCom: ['contagio'],
    efeitos: [{ tipo: 'propriedade', chave: 'acumulo_aflicao', rotulo: 'Bônus por acúmulo', valorPorRank: 0.1, escola: 'maldicao' }],
  },

  // ------------------- bênção -------------------
  egide: {
    id: 'egide',
    nome: 'Égide',
    descricao: 'Suas bênçãos criam escudos absorventes (15%/rank; exclui Exaltação).',
    ranksMaximos: 3,
    requisito: { escola: 'benca', nivelMinimo: 5 },
    exclusivoCom: ['exaltacao'],
    efeitos: [{ tipo: 'propriedade', chave: 'escudo', rotulo: 'Fração convertida em escudo', valorPorRank: 0.15, escola: 'benca' }],
  },
  exaltacao: {
    id: 'exaltacao',
    nome: 'Exaltação',
    descricao: 'Suas bênçãos aumentam o dano dos aliados (8%/rank; exclui Égide).',
    ranksMaximos: 3,
    requisito: { escola: 'benca', nivelMinimo: 5 },
    exclusivoCom: ['egide'],
    efeitos: [{ tipo: 'propriedade', chave: 'exaltacao', rotulo: 'Dano concedido a aliados', valorPorRank: 0.08, escola: 'benca' }],
  },
  vinculo_de_grupo: {
    id: 'vinculo_de_grupo',
    nome: 'Vínculo de Grupo',
    descricao: 'Bênçãos em área afetam +1 aliado por rank sem perder força.',
    ranksMaximos: 3,
    requisito: { escola: 'benca', nivelMinimo: 8 },
    efeitos: [{ tipo: 'propriedade', chave: 'alvos_extras_benca', rotulo: 'Aliados extras', valorPorRank: 1, escola: 'benca' }],
  },

  // ------------------- combate físico -------------------
  sequencia_marcial: {
    id: 'sequencia_marcial',
    nome: 'Sequência Marcial',
    descricao: 'Golpes consecutivos aceleram (+6% velocidade por acerto/rank; exclui Golpe Devastador).',
    ranksMaximos: 3,
    requisito: { escola: 'combate_fisico', nivelMinimo: 5 },
    exclusivoCom: ['golpe_devastador'],
    efeitos: [{ tipo: 'propriedade', chave: 'combo', rotulo: 'Aceleração por combo', valorPorRank: 0.06, escola: 'combate_fisico' }],
  },
  golpe_devastador: {
    id: 'golpe_devastador',
    nome: 'Golpe Devastador',
    descricao: 'Golpes lentos com chance de atordoar (10%/rank; exclui Sequência).',
    ranksMaximos: 3,
    requisito: { escola: 'combate_fisico', nivelMinimo: 5 },
    exclusivoCom: ['sequencia_marcial'],
    efeitos: [{ tipo: 'propriedade', chave: 'atordoamento', rotulo: 'Chance de atordoar', valorPorRank: 0.1, escola: 'combate_fisico' }],
  },
  postura_inabalavel: {
    id: 'postura_inabalavel',
    nome: 'Postura Inabalável',
    descricao: 'Reduz dano recebido enquanto ataca (5%/rank).',
    ranksMaximos: 3,
    requisito: { escola: 'combate_fisico', nivelMinimo: 8 },
    efeitos: [{ tipo: 'propriedade', chave: 'mitigacao', rotulo: 'Redução de dano', valorPorRank: 0.05, escola: 'combate_fisico' }],
  },

  // ------------------- longo alcance -------------------
  olho_de_aguia: {
    id: 'olho_de_aguia',
    nome: 'Olho de Águia',
    descricao: 'Tiros precisos: chance de crítico (+8%/rank; exclui Rajada).',
    ranksMaximos: 3,
    requisito: { escola: 'longo_alcance', nivelMinimo: 5 },
    exclusivoCom: ['rajada'],
    efeitos: [{ tipo: 'propriedade', chave: 'critico', rotulo: 'Chance de crítico', valorPorRank: 0.08, escola: 'longo_alcance' }],
  },
  rajada: {
    id: 'rajada',
    nome: 'Rajada',
    descricao: 'Dispara projéteis extras mais fracos (+1/rank; exclui Olho de Águia).',
    ranksMaximos: 3,
    requisito: { escola: 'longo_alcance', nivelMinimo: 5 },
    exclusivoCom: ['olho_de_aguia'],
    efeitos: [{ tipo: 'propriedade', chave: 'projeteis_extras', rotulo: 'Projéteis extras', valorPorRank: 1, escola: 'longo_alcance' }],
  },

  // ------------------- recursos -------------------
  devocao: {
    id: 'devocao',
    nome: 'Devoção',
    descricao: 'Fé: a penalidade por uso cresce 15% mais devagar por rank.',
    ranksMaximos: 3,
    requisito: { recurso: 'fe', nivelMinimo: 5 },
    efeitos: [{ tipo: 'propriedade', chave: 'fe_penalidade_reduzida', rotulo: 'Penalidade de fé reduzida', valorPorRank: 0.15 }],
  },
  fluxo_constante: {
    id: 'fluxo_constante',
    nome: 'Fluxo Constante',
    descricao: 'Mana: regeneração 10% maior por rank.',
    ranksMaximos: 3,
    requisito: { recurso: 'mana', nivelMinimo: 5 },
    efeitos: [{ tipo: 'propriedade', chave: 'mana_regen_bonus', rotulo: 'Regeneração de mana', valorPorRank: 0.1 }],
  },
  sede_de_batalha: {
    id: 'sede_de_batalha',
    nome: 'Sede de Batalha',
    descricao: 'Fúria: ganho por dano 12% maior por rank.',
    ranksMaximos: 3,
    requisito: { recurso: 'furia', nivelMinimo: 5 },
    efeitos: [{ tipo: 'propriedade', chave: 'furia_ganho_bonus', rotulo: 'Ganho de fúria', valorPorRank: 0.12 }],
  },
};
