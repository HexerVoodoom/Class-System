/**
 * Registro de estados/condições (status ailments), inspirado nas condições
 * de D&D, nos status de Final Fantasy/Ragnarok e nos debuffs de Warcraft.
 *
 * Cada elemento base e cada escola declara quais estados suas skills podem
 * infligir. O motor reúne os estados de uma skill a partir do elemento, da
 * escola e de talentos, para a UI exibir "esta skill pode causar…".
 */

import type { ElementoBaseId } from './elementos';
import type { EscolaId } from './escolas';

export type EstadoId =
  | 'queimadura'
  | 'congelamento'
  | 'choque'
  | 'petrificacao'
  | 'derrubada'
  | 'veneno'
  | 'sangramento'
  | 'atordoamento'
  | 'silencio'
  | 'cegueira'
  | 'medo'
  | 'maldicao'
  | 'lentidao'
  | 'definhamento'
  | 'encantado'
  // positivos (bênção)
  | 'regeneracao'
  | 'pressa'
  | 'escudo'
  | 'furia_abencoada';

export interface EstadoDef {
  id: EstadoId;
  nome: string;
  tipo: 'ofensivo' | 'controle' | 'positivo';
  descricao: string;
}

export const ESTADOS: Record<EstadoId, EstadoDef> = {
  queimadura: { id: 'queimadura', nome: 'Queimadura', tipo: 'ofensivo', descricao: 'Dano de fogo ao longo do tempo.' },
  congelamento: { id: 'congelamento', nome: 'Congelamento', tipo: 'controle', descricao: 'Alvo preso no gelo, sem agir.' },
  choque: { id: 'choque', nome: 'Choque', tipo: 'controle', descricao: 'Paralisia breve por eletricidade.' },
  petrificacao: { id: 'petrificacao', nome: 'Petrificação', tipo: 'controle', descricao: 'Alvo vira pedra, imóvel.' },
  derrubada: { id: 'derrubada', nome: 'Derrubada', tipo: 'controle', descricao: 'Alvo é jogado no chão/empurrado.' },
  veneno: { id: 'veneno', nome: 'Veneno', tipo: 'ofensivo', descricao: 'Dano tóxico contínuo, difícil de remover.' },
  sangramento: { id: 'sangramento', nome: 'Sangramento', tipo: 'ofensivo', descricao: 'Ferida que sangra ao longo do tempo.' },
  atordoamento: { id: 'atordoamento', nome: 'Atordoamento', tipo: 'controle', descricao: 'Alvo atordoado, incapaz de agir.' },
  silencio: { id: 'silencio', nome: 'Silêncio', tipo: 'controle', descricao: 'Impede conjurar magias.' },
  cegueira: { id: 'cegueira', nome: 'Cegueira', tipo: 'controle', descricao: 'Reduz precisão drasticamente.' },
  medo: { id: 'medo', nome: 'Medo', tipo: 'controle', descricao: 'Alvo foge sem controle.' },
  maldicao: { id: 'maldicao', nome: 'Maldição', tipo: 'ofensivo', descricao: 'Enfraquece atributos e amplia dano recebido.' },
  lentidao: { id: 'lentidao', nome: 'Lentidão', tipo: 'controle', descricao: 'Reduz velocidade de ação e movimento.' },
  definhamento: { id: 'definhamento', nome: 'Definhamento', tipo: 'ofensivo', descricao: 'Decadência da carne; impede cura.' },
  encantado: { id: 'encantado', nome: 'Encantado', tipo: 'controle', descricao: 'Alvo hesita ou luta ao seu lado brevemente.' },
  regeneracao: { id: 'regeneracao', nome: 'Regeneração', tipo: 'positivo', descricao: 'Recupera vida ao longo do tempo.' },
  pressa: { id: 'pressa', nome: 'Pressa', tipo: 'positivo', descricao: 'Acelera ações e conjuração.' },
  escudo: { id: 'escudo', nome: 'Escudo', tipo: 'positivo', descricao: 'Barreira que absorve dano.' },
  furia_abencoada: { id: 'furia_abencoada', nome: 'Fúria Abençoada', tipo: 'positivo', descricao: 'Aumenta o dano do alvo.' },
};

/** Estados que cada elemento base pode infligir. */
export const ESTADOS_POR_ELEMENTO: Record<ElementoBaseId, EstadoId[]> = {
  fogo: ['queimadura'],
  agua: ['congelamento', 'lentidao'],
  terra: ['petrificacao', 'derrubada'],
  // Ar herdou o atordoamento do Som, que virou o par Ar+Vida.
  ar: ['derrubada', 'atordoamento'],
  eletricidade: ['choque'],
  arcano: ['silencio'],
  sombra: ['cegueira', 'medo'],
  luz: ['cegueira'],
  vileza: ['maldicao', 'medo'],
  morte: ['definhamento', 'medo'],
  vida: ['regeneracao'],
  marcial: ['sangramento', 'atordoamento'],
  // Gravidade absorveu Tempo e Espaço: herdou a pressa que era do Tempo.
  gravidade: ['derrubada', 'lentidao', 'atordoamento', 'pressa'],
};

/** Estados que cada escola tende a aplicar, além do elemento. */
export const ESTADOS_POR_ESCOLA: Record<EscolaId, EstadoId[]> = {
  combate_fisico: ['sangramento', 'atordoamento'],
  longo_alcance: ['sangramento'],
  evocacao: [],
  conjuracao: [],
  maldicao: ['maldicao', 'veneno', 'lentidao', 'silencio'],
  benca: ['regeneracao', 'pressa', 'escudo', 'furia_abencoada'],
};
