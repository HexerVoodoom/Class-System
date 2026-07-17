/**
 * Registro de elementos.
 *
 * Três categorias:
 *  - "base": recebem pontos diretamente do jogador.
 *  - "derivado": não recebem pontos diretos; o nível deles é calculado a
 *    partir do nível efetivo dos componentes da receita (evolui à medida que
 *    os componentes evoluem juntos — o nível é o MENOR nível entre eles).
 *  - "especial": derivados com condição global (ex.: nulo exige todos os
 *    elementos nivelados).
 */

export type ElementoId =
  | 'fogo'
  | 'agua'
  | 'terra'
  | 'ar'
  | 'eletricidade'
  | 'arcano'
  | 'sombra'
  | 'luz'
  | 'vileza'
  | 'morte'
  | 'vida'
  | 'vigor'
  // derivados
  | 'lava'
  | 'chama_azul'
  | 'vapor'
  | 'gelo'
  | 'tempestade'
  | 'cristal'
  | 'praga'
  | 'equilibrio'
  | 'crepusculo'
  | 'chama_demoniaca'
  // especial
  | 'nulo';

export interface ReceitaComponente {
  elemento: ElementoId;
  /** Nível efetivo mínimo do componente para o derivado começar a existir. */
  nivelMinimo: number;
}

export interface ElementoDef {
  id: ElementoId;
  nome: string;
  tipo: 'base' | 'derivado' | 'especial';
  descricao: string;
  /**
   * Multiplicador de potência por nível. Derivados custam investimento em
   * vários componentes ao mesmo tempo, então pagam melhor por nível.
   */
  fatorPotencia: number;
  /** Só para derivados/especiais. */
  receita?: ReceitaComponente[];
}

/** Elementos primais: recebem transbordo de pontos de "vida". */
export const ELEMENTOS_PRIMAIS: ElementoId[] = [
  'fogo',
  'agua',
  'terra',
  'ar',
  'eletricidade',
];

export const ELEMENTOS: Record<ElementoId, ElementoDef> = {
  fogo: {
    id: 'fogo',
    nome: 'Fogo',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Dano direto e queimadura.',
  },
  agua: {
    id: 'agua',
    nome: 'Água',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Controle, fluxo e sustentação.',
  },
  terra: {
    id: 'terra',
    nome: 'Terra',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Defesa, peso e permanência.',
  },
  ar: {
    id: 'ar',
    nome: 'Ar',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Velocidade, alcance e mobilidade.',
  },
  eletricidade: {
    id: 'eletricidade',
    nome: 'Eletricidade',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Picos de dano e encadeamento entre alvos.',
  },
  arcano: {
    id: 'arcano',
    nome: 'Arcano',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Magia pura; conversa com todas as escolas.',
  },
  sombra: {
    id: 'sombra',
    nome: 'Sombra',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Furtividade, drenagem e medo.',
  },
  luz: {
    id: 'luz',
    nome: 'Luz',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Revelação, punição e proteção.',
  },
  vileza: {
    id: 'vileza',
    nome: 'Vileza',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Pactos e demônios; vizinha do fogo.',
  },
  morte: {
    id: 'morte',
    nome: 'Morte',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Decadência, mortos-vivos e fim.',
  },
  vida: {
    id: 'vida',
    nome: 'Vida',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Cura e crescimento; alimenta os elementos primais.',
  },
  vigor: {
    id: 'vigor',
    nome: 'Vigor',
    tipo: 'base',
    fatorPotencia: 1.0,
    descricao: 'Espírito do corpo; potencializa o combate físico.',
  },

  // ---- derivados (nível = menor nível efetivo entre os componentes) ----
  lava: {
    id: 'lava',
    nome: 'Lava',
    tipo: 'derivado',
    fatorPotencia: 1.15,
    descricao: 'Fogo que adere: dano imediato + dano contínuo pesado.',
    receita: [
      { elemento: 'fogo', nivelMinimo: 10 },
      { elemento: 'terra', nivelMinimo: 10 },
    ],
  },
  chama_azul: {
    id: 'chama_azul',
    nome: 'Chama Azul',
    tipo: 'derivado',
    fatorPotencia: 1.2,
    descricao: 'Fogo que queima a alma; ignora parte da defesa.',
    receita: [
      { elemento: 'fogo', nivelMinimo: 12 },
      { elemento: 'morte', nivelMinimo: 12 },
    ],
  },
  vapor: {
    id: 'vapor',
    nome: 'Vapor',
    tipo: 'derivado',
    fatorPotencia: 1.15,
    descricao: 'Névoa escaldante; área e ocultação.',
    receita: [
      { elemento: 'fogo', nivelMinimo: 10 },
      { elemento: 'agua', nivelMinimo: 10 },
    ],
  },
  gelo: {
    id: 'gelo',
    nome: 'Gelo',
    tipo: 'derivado',
    fatorPotencia: 1.15,
    descricao: 'Água parada no tempo; controle e lentidão.',
    receita: [
      { elemento: 'agua', nivelMinimo: 10 },
      { elemento: 'ar', nivelMinimo: 10 },
    ],
  },
  tempestade: {
    id: 'tempestade',
    nome: 'Tempestade',
    tipo: 'derivado',
    fatorPotencia: 1.15,
    descricao: 'Ar carregado; área grande e dano encadeado.',
    receita: [
      { elemento: 'ar', nivelMinimo: 10 },
      { elemento: 'eletricidade', nivelMinimo: 10 },
    ],
  },
  cristal: {
    id: 'cristal',
    nome: 'Cristal',
    tipo: 'derivado',
    fatorPotencia: 1.15,
    descricao: 'Terra lapidada pelo arcano; barreiras e foco.',
    receita: [
      { elemento: 'terra', nivelMinimo: 10 },
      { elemento: 'arcano', nivelMinimo: 10 },
    ],
  },
  praga: {
    id: 'praga',
    nome: 'Praga',
    tipo: 'derivado',
    fatorPotencia: 1.2,
    descricao: 'Corrupção contagiosa; veneno e maldição se espalham.',
    receita: [
      { elemento: 'morte', nivelMinimo: 12 },
      { elemento: 'vileza', nivelMinimo: 12 },
    ],
  },
  equilibrio: {
    id: 'equilibrio',
    nome: 'Equilíbrio',
    tipo: 'derivado',
    fatorPotencia: 1.25,
    descricao: 'Vida e morte na mesma mão; converte dano em cura e cura em dano.',
    receita: [
      { elemento: 'vida', nivelMinimo: 15 },
      { elemento: 'morte', nivelMinimo: 15 },
    ],
  },
  crepusculo: {
    id: 'crepusculo',
    nome: 'Crepúsculo',
    tipo: 'derivado',
    fatorPotencia: 1.25,
    descricao: 'Fronteira entre luz e sombra; revela e oculta ao mesmo tempo.',
    receita: [
      { elemento: 'luz', nivelMinimo: 15 },
      { elemento: 'sombra', nivelMinimo: 15 },
    ],
  },
  chama_demoniaca: {
    id: 'chama_demoniaca',
    nome: 'Chama Demoníaca',
    tipo: 'derivado',
    fatorPotencia: 1.3,
    descricao: 'Tripla: fogo alimentado por pacto e morte.',
    receita: [
      { elemento: 'fogo', nivelMinimo: 15 },
      { elemento: 'vileza', nivelMinimo: 15 },
      { elemento: 'morte', nivelMinimo: 15 },
    ],
  },

  nulo: {
    id: 'nulo',
    nome: 'Nulo',
    tipo: 'especial',
    fatorPotencia: 1.4,
    descricao:
      'O elemento de quem dominou todos: exige nível mínimo em TODOS os elementos base.',
    receita: [
      { elemento: 'fogo', nivelMinimo: 8 },
      { elemento: 'agua', nivelMinimo: 8 },
      { elemento: 'terra', nivelMinimo: 8 },
      { elemento: 'ar', nivelMinimo: 8 },
      { elemento: 'eletricidade', nivelMinimo: 8 },
      { elemento: 'arcano', nivelMinimo: 8 },
      { elemento: 'sombra', nivelMinimo: 8 },
      { elemento: 'luz', nivelMinimo: 8 },
      { elemento: 'vileza', nivelMinimo: 8 },
      { elemento: 'morte', nivelMinimo: 8 },
      { elemento: 'vida', nivelMinimo: 8 },
      { elemento: 'vigor', nivelMinimo: 8 },
    ],
  },
};

/**
 * Sinergias de transbordo: pontos DIRETOS em `de` geram nível efetivo bônus
 * em cada elemento de `para`, na razão dada (arredondado para baixo).
 * Ex.: vida com razão 0.2 → a cada 5 pontos em vida, +1 em cada primal.
 */
export interface Sinergia {
  de: ElementoId;
  para: ElementoId[];
  razao: number;
}

export const SINERGIAS: Sinergia[] = [
  { de: 'vida', para: [...ELEMENTOS_PRIMAIS], razao: 0.2 },
  { de: 'fogo', para: ['vileza'], razao: 0.1 },
  { de: 'vileza', para: ['fogo'], razao: 0.1 },
  { de: 'sombra', para: ['morte'], razao: 0.1 },
  { de: 'morte', para: ['sombra'], razao: 0.1 },
  { de: 'luz', para: ['vida'], razao: 0.1 },
  { de: 'vida', para: ['luz'], razao: 0.1 },
  // Arcano é magia pura: alimenta de leve tudo que não é físico.
  {
    de: 'arcano',
    para: ['fogo', 'agua', 'terra', 'ar', 'eletricidade', 'sombra', 'luz'],
    razao: 0.05,
  },
];
