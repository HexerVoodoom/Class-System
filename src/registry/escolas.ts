/**
 * Registro de classes/escolas. O jogador coloca pontos diretamente nelas.
 * O perfil (pesos) da escola combina com o do elemento para moldar o
 * resultado final da skill.
 */

import type { PerfilPesos } from './elementos';

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
  entregaPadrao: 'dano' | 'invocacao' | 'efeito';
  pesos: PerfilPesos;
}

export const ESCOLAS: Record<EscolaId, EscolaDef> = {
  combate_fisico: {
    id: 'combate_fisico',
    nome: 'Combate Físico',
    tipo: 'marcial',
    entregaPadrao: 'dano',
    pesos: { dano: 0.7, controle: 0, cura: 0, defesa: 0.3, suporte: 0 },
    descricao: 'Corpo a corpo; escala com vigor e alimenta a fúria.',
  },
  longo_alcance: {
    id: 'longo_alcance',
    nome: 'Longo Alcance',
    tipo: 'marcial',
    entregaPadrao: 'dano',
    pesos: { dano: 0.9, controle: 0.1, cura: 0, defesa: 0, suporte: 0 },
    descricao: 'Projéteis e precisão à distância.',
  },
  evocacao: {
    id: 'evocacao',
    nome: 'Evocação',
    tipo: 'magica',
    entregaPadrao: 'invocacao',
    pesos: { dano: 0.6, controle: 0, cura: 0, defesa: 0.2, suporte: 0.2 },
    descricao: 'Traz criaturas e construtos para lutar por você.',
  },
  conjuracao: {
    id: 'conjuracao',
    nome: 'Conjuração',
    tipo: 'magica',
    entregaPadrao: 'dano',
    pesos: { dano: 0.7, controle: 0.3, cura: 0, defesa: 0, suporte: 0 },
    descricao: 'Molda o elemento em efeito direto: projétil, explosão, parede.',
  },
  benca: {
    id: 'benca',
    nome: 'Bênção (Buff)',
    tipo: 'magica',
    entregaPadrao: 'efeito',
    pesos: { dano: 0, controle: 0, cura: 0.3, defesa: 0.3, suporte: 0.4 },
    descricao: 'Fortalece aliados: escudos, auras e êxtase.',
  },
  maldicao: {
    id: 'maldicao',
    nome: 'Maldição (Debuff)',
    tipo: 'magica',
    entregaPadrao: 'efeito',
    pesos: { dano: 0.4, controle: 0.6, cura: 0, defesa: 0, suporte: 0 },
    descricao: 'Enfraquece, envenena e amaldiçoa inimigos.',
  },
};
