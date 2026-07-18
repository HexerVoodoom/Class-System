/**
 * Registro de recursos (o que alimenta as skills).
 *
 * Cada recurso tem um modelo de custo próprio:
 *  - mana: gasto contínuo e previsível (custo fixo, regen constante).
 *  - fe: quanto mais usa, mais caro fica (penalidade acumulada que decai
 *    quando você fica um tempo sem usar).
 *  - furia: não regenera sozinha; é gerada ao causar e ao receber dano em
 *    combate, e decai fora de combate.
 *  - soullink: paga o custo com a própria VIDA e amplifica o poder da
 *    skill; trava num limiar mínimo para não se matar.
 *  - ressonancia: começa fraca e fica mais forte a cada uso (multiplicador
 *    de poder acumulado); ficar um tempo sem usar reseta o acúmulo.
 */

export type RecursoId = 'mana' | 'fe' | 'furia' | 'soullink' | 'ressonancia';

export interface RecursoDef {
  id: RecursoId;
  nome: string;
  descricao: string;
  /** Pool base no nível 0 de proficiência. */
  poolBase: number;
  /** Pool ganho por ponto de proficiência no recurso. */
  poolPorProficiencia: number;
  parametros: Record<string, number>;
}

export const RECURSOS: Record<RecursoId, RecursoDef> = {
  mana: {
    id: 'mana',
    nome: 'Mana',
    descricao: 'Gasto contínuo e previsível; regenera a taxa constante.',
    poolBase: 100,
    poolPorProficiencia: 10,
    parametros: {
      regenBasePorSegundo: 5,
      regenPorProficiencia: 0.4,
    },
  },
  fe: {
    id: 'fe',
    nome: 'Fé',
    descricao:
      'Cada uso aumenta o custo dos próximos; a penalidade decai com o tempo sem usar.',
    poolBase: 100,
    poolPorProficiencia: 8,
    parametros: {
      regenBasePorSegundo: 6,
      regenPorProficiencia: 0.4,
      /** Quanto de penalidade cada ponto de energia gasto acumula. */
      penalidadePorEnergia: 0.02,
      /** Meia-vida (s) da penalidade quando o recurso não é usado. */
      meiaVidaPenalidadeSegundos: 20,
      /** Proficiência reduz o acúmulo de penalidade (fração por ponto). */
      reducaoPenalidadePorProficiencia: 0.01,
      /** Multiplicador máximo de custo (trava de segurança). */
      multiplicadorMaximo: 4,
    },
  },
  furia: {
    id: 'furia',
    nome: 'Fúria',
    descricao:
      'Gerada ao causar e receber dano; decai fora de combate; sem regeneração passiva.',
    poolBase: 100,
    poolPorProficiencia: 5,
    parametros: {
      ganhoPorDanoCausado: 0.5,
      ganhoPorDanoRecebido: 0.8,
      ganhoPorProficiencia: 0.02,
      decaimentoForaDeCombatePorSegundo: 3,
      segundosParaSairDeCombate: 5,
    },
  },
  soullink: {
    id: 'soullink',
    nome: 'Soullink',
    descricao:
      'Paga o custo com a própria vida e amplifica o poder; nunca desce do limiar vital.',
    poolBase: 100,
    poolPorProficiencia: 10,
    parametros: {
      /** Regeneração de vida lenta. */
      regenBasePorSegundo: 1,
      regenPorProficiencia: 0.2,
      /** Skills pagas com vida rendem mais poder. */
      multiplicadorPoder: 1.3,
      /** Fração da vida abaixo da qual o elo se recusa a consumir. */
      limiarVidaFracao: 0.1,
    },
  },
  ressonancia: {
    id: 'ressonancia',
    nome: 'Ressonância',
    descricao:
      'Começa fraca e amplifica a cada uso consecutivo; parar de usar reseta o acúmulo.',
    poolBase: 100,
    poolPorProficiencia: 8,
    parametros: {
      regenBasePorSegundo: 5,
      regenPorProficiencia: 0.4,
      /** Quanto de multiplicador cada uso acumula. */
      acumuloPorUso: 0.1,
      /** Teto do multiplicador de poder acumulado. */
      multiplicadorPoderMaximo: 1.5,
      /** Segundos sem usar até o acúmulo resetar para o estado fraco. */
      janelaResetSegundos: 8,
    },
  },
};
