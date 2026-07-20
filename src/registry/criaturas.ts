/**
 * Registro do bestiário — criaturas SELVAGENS que podem ser capturadas.
 *
 * Captura depende da AFINIDADE ELEMENTAL do jogador: cada criatura só pode
 * ser capturada por quem tem pontos em um dos seus elementos de afinidade
 * (ex.: uma fera ígnea exige Fogo; um animal exige Vida ou Vigor).
 *
 * Depois de capturada, a criatura pode ser evocada — opcionalmente imbuída
 * de um elemento no qual o jogador tem MAESTRIA, herdando aquele elemento.
 *
 * As evocações BÁSICAS (elemental do elemento) e ALEATÓRIAS não usam este
 * registro — só a evocação de criatura capturada.
 */

import type { ElementoBaseId } from './elementos';

export type FamiliaCriatura =
  | 'besta'
  | 'ave'
  | 'aquatica'
  | 'ignea'
  | 'morto_vivo'
  | 'aberracao'
  | 'planta'
  | 'espirito'
  | 'construto'
  | 'demonio'
  | 'draconico';

export interface CriaturaDef {
  id: string;
  nome: string;
  familia: FamiliaCriatura;
  /** Elementos que PODEM capturá-la (o jogador precisa de pontos em um deles). */
  afinidades: ElementoBaseId[];
  /**
   * Dificuldade/raridade: o poder de captura do jogador precisa alcançá-la.
   * Também é o poder-base da criatura ao ser evocada.
   */
  poderBase: number;
  descricao: string;
}

export const FAMILIAS: Record<FamiliaCriatura, { nome: string; descricao: string }> = {
  besta: { nome: 'Besta', descricao: 'Animais terrestres de carne e instinto.' },
  ave: { nome: 'Ave', descricao: 'Criaturas aladas.' },
  aquatica: { nome: 'Aquática', descricao: 'Seres das águas e profundezas.' },
  ignea: { nome: 'Ígnea', descricao: 'Feras nascidas do fogo e da lava.' },
  morto_vivo: { nome: 'Morto-vivo', descricao: 'O que retornou da morte.' },
  aberracao: { nome: 'Aberração', descricao: 'Horrores das sombras e da corrupção.' },
  planta: { nome: 'Planta', descricao: 'Vida vegetal desperta.' },
  espirito: { nome: 'Espírito', descricao: 'Entes etéreos e arcanos.' },
  construto: { nome: 'Construto', descricao: 'Máquinas, golens e formas montadas.' },
  demonio: { nome: 'Demônio', descricao: 'Entidades de pacto e vileza.' },
  draconico: { nome: 'Dracônico', descricao: 'Parentes dos dragões — raros e poderosos.' },
};

const c = (
  id: string,
  nome: string,
  familia: FamiliaCriatura,
  afinidades: ElementoBaseId[],
  poderBase: number,
  descricao: string,
): CriaturaDef => ({ id, nome, familia, afinidades, poderBase, descricao });

export const CRIATURAS: Record<string, CriaturaDef> = Object.fromEntries(
  [
    // bestas — vida/vigor
    c('lobo', 'Lobo Cinzento', 'besta', ['vida', 'vigor'], 24, 'Caçador de matilha, rápido e leal.'),
    c('urso', 'Urso das Cavernas', 'besta', ['vida', 'vigor'], 42, 'Força bruta e resistência.'),
    c('felino', 'Pantera Sombria', 'besta', ['vida', 'sombra'], 38, 'Predador furtivo das florestas escuras.'),
    c('javali', 'Javali de Presa', 'besta', ['vigor', 'terra'], 30, 'Investida imparável.'),
    // aves — ar/vida
    c('falcao', 'Falcão Real', 'ave', ['ar', 'vida'], 26, 'Olhos aguçados e mergulho veloz.'),
    c('coruja', 'Coruja Arcana', 'ave', ['ar', 'arcano'], 34, 'Voa em silêncio; sente magia.'),
    // aquáticas — agua
    c('serpente_marinha', 'Serpente Marinha', 'aquatica', ['agua'], 48, 'Constritora das correntes profundas.'),
    c('tubarao', 'Tubarão Abissal', 'aquatica', ['agua', 'sombra'], 52, 'Frenesi das profundezas.'),
    // ígneas — fogo
    c('salamandra', 'Salamandra', 'ignea', ['fogo'], 30, 'Lagarto que trilha em brasa.'),
    c('cao_de_lava', 'Cão de Lava', 'ignea', ['fogo', 'terra'], 46, 'Matilha incandescente.'),
    c('fenix_menor', 'Fênix Menor', 'ignea', ['fogo', 'vida'], 72, 'Renasce das próprias cinzas.'),
    // mortos-vivos — morte
    c('ghoul', 'Ghoul', 'morto_vivo', ['morte'], 28, 'Devorador de cadáveres.'),
    c('cavaleiro_morto', 'Cavaleiro Morto', 'morto_vivo', ['morte', 'marcial'], 58, 'Guerreiro que a morte não deteve.'),
    // aberrações — sombra/vileza
    c('sombra_rastejante', 'Sombra Rastejante', 'aberracao', ['sombra'], 32, 'Vulto que se cola às paredes.'),
    c('olho_vil', 'Olho Vil', 'aberracao', ['vileza', 'arcano'], 50, 'Muitos olhos, muitas maldições.'),
    // plantas — vida/terra
    c('trevo_carnivoro', 'Trevo Carnívoro', 'planta', ['vida', 'terra'], 22, 'Devora o incauto que se aproxima.'),
    c('ent', 'Ent Ancião', 'planta', ['vida', 'terra'], 64, 'Guardião centenário da floresta.'),
    // espíritos — arcano/luz
    c('fada', 'Fada Cintilante', 'espirito', ['arcano', 'luz'], 26, 'Pequena, veloz e travessa.'),
    c('anjo_menor', 'Anjo Menor', 'espirito', ['luz'], 68, 'Mensageiro radiante.'),
    c('espectro', 'Espectro Errante', 'espirito', ['morte', 'arcano'], 44, 'Alma presa entre mundos.'),
    // construtos — terra/marcial/eletricidade
    c('golem_pedra', 'Golem de Pedra', 'construto', ['terra'], 54, 'Muralha que anda.'),
    c('automato', 'Autômato Voltaico', 'construto', ['eletricidade', 'marcial'], 60, 'Engenho movido a raios.'),
    // demônios — vileza
    c('imp', 'Imp', 'demonio', ['vileza'], 30, 'Pequeno demônio zombeteiro.'),
    c('demonio_maior', 'Demônio Maior', 'demonio', ['vileza', 'fogo'], 80, 'Pactos são selados com sangue.'),
    // dracônicos — raros, exigem afinidade dupla e muito poder
    c('wyvern', 'Wyvern', 'draconico', ['ar', 'fogo'], 90, 'Primo alado dos dragões.'),
    c('dragao_jovem', 'Dragão Jovem', 'draconico', ['fogo', 'arcano'], 120, 'Ainda jovem — e já aterrador.'),
  ].map((def) => [def.id, def]),
);

export function criaturas(): CriaturaDef[] {
  return Object.values(CRIATURAS);
}
