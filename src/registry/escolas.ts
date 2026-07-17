/**
 * Registro de classes/escolas. O jogador coloca pontos diretamente nelas,
 * do mesmo jeito que em elementos base.
 */

export type EscolaId =
  | 'combate_fisico'
  | 'longo_alcance'
  | 'evocacao'
  | 'conjuracao'
  | 'benca'
  | 'maldicao';

export interface EscolaDef {
  id: EscolaId;
  nome: string;
  tipo: 'marcial' | 'magica';
  descricao: string;
  /** O que a escola entrega quando vira skill. */
  entregaPadrao: 'dano' | 'invocacao' | 'efeito';
}

export const ESCOLAS: Record<EscolaId, EscolaDef> = {
  combate_fisico: {
    id: 'combate_fisico',
    nome: 'Combate Físico',
    tipo: 'marcial',
    entregaPadrao: 'dano',
    descricao: 'Corpo a corpo; escala com vigor.',
  },
  longo_alcance: {
    id: 'longo_alcance',
    nome: 'Longo Alcance',
    tipo: 'marcial',
    entregaPadrao: 'dano',
    descricao: 'Projéteis e precisão à distância.',
  },
  evocacao: {
    id: 'evocacao',
    nome: 'Evocação',
    tipo: 'magica',
    entregaPadrao: 'invocacao',
    descricao: 'Traz criaturas e construtos para lutar por você.',
  },
  conjuracao: {
    id: 'conjuracao',
    nome: 'Conjuração',
    tipo: 'magica',
    entregaPadrao: 'dano',
    descricao: 'Molda o elemento em efeito direto: projétil, explosão, parede.',
  },
  benca: {
    id: 'benca',
    nome: 'Bênção (Buff)',
    tipo: 'magica',
    entregaPadrao: 'efeito',
    descricao: 'Fortalece aliados.',
  },
  maldicao: {
    id: 'maldicao',
    nome: 'Maldição (Debuff)',
    tipo: 'magica',
    entregaPadrao: 'efeito',
    descricao: 'Enfraquece, envenena e amaldiçoa inimigos.',
  },
};
