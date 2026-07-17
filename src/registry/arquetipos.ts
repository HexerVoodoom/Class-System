/**
 * Registro de arquétipos: identidades desbloqueadas por COMBINAÇÕES de
 * elementos + escolas + proficiência de recurso. Não são escolhidas — são
 * consequência da distribuição de pontos ("se ele coloca ponto em morte e
 * evocação, ele vira um necromante").
 *
 * Cada arquétipo pode liberar formas de invocação/efeito exclusivas.
 */

import type { ElementoId } from './elementos';
import type { EscolaId } from './escolas';
import type { RecursoId } from './recursos';

export type ArquetipoId =
  | 'necromante'
  | 'verdejante'
  | 'demonologista'
  | 'senhor_dos_mortos_vis'
  | 'arsenal_espectral'
  | 'piromante_vegetal'
  | 'toxicologista';

export interface CondicaoArquetipo {
  elementos?: Partial<Record<ElementoId, number>>;
  escolas?: Partial<Record<EscolaId, number>>;
  recursos?: Partial<Record<RecursoId, number>>;
}

export interface ArquetipoDef {
  id: ArquetipoId;
  nome: string;
  descricao: string;
  condicao: CondicaoArquetipo;
  /** Chaves de capacidade que as skills podem exigir. */
  capacidades: string[];
}

export const ARQUETIPOS: Record<ArquetipoId, ArquetipoDef> = {
  necromante: {
    id: 'necromante',
    nome: 'Necromante',
    descricao: 'Morte + Evocação: ergue mortos-vivos para lutar por você.',
    condicao: { elementos: { morte: 10 }, escolas: { evocacao: 10 } },
    capacidades: ['evocar_mortos_vivos'],
  },
  verdejante: {
    id: 'verdejante',
    nome: 'Verdejante',
    descricao: 'Vida + Evocação: invoca plantas guardiãs e vinhas.',
    condicao: { elementos: { vida: 10 }, escolas: { evocacao: 10 } },
    capacidades: ['evocar_plantas'],
  },
  demonologista: {
    id: 'demonologista',
    nome: 'Demonologista',
    descricao: 'Vileza + Evocação: sela pactos e invoca demônios.',
    condicao: { elementos: { vileza: 10 }, escolas: { evocacao: 10 } },
    capacidades: ['evocar_demonios'],
  },
  senhor_dos_mortos_vis: {
    id: 'senhor_dos_mortos_vis',
    nome: 'Senhor dos Mortos Vis',
    descricao:
      'Necromante com Vileza: invoca demônios mortos — o pior dos dois mundos.',
    condicao: {
      elementos: { morte: 15, vileza: 15 },
      escolas: { evocacao: 15 },
    },
    capacidades: ['evocar_demonios_mortos'],
  },
  arsenal_espectral: {
    id: 'arsenal_espectral',
    nome: 'Arsenal Espectral',
    descricao:
      'Evocação + Combate Físico + Fúria: evoca armas que orbitam você e lutam sozinhas.',
    condicao: {
      escolas: { evocacao: 12, combate_fisico: 12 },
      recursos: { furia: 8 },
    },
    capacidades: ['evocar_armas_autonomas'],
  },
  piromante_vegetal: {
    id: 'piromante_vegetal',
    nome: 'Piromante Vegetal',
    descricao: 'Verdejante com Fogo: plantas e vinhas em chamas.',
    condicao: {
      elementos: { vida: 12, fogo: 12 },
      escolas: { evocacao: 10 },
    },
    capacidades: ['evocar_plantas_de_fogo', 'conjurar_vinha_de_fogo'],
  },
  toxicologista: {
    id: 'toxicologista',
    nome: 'Toxicologista',
    descricao: 'Maldição focada em veneno que corrói ao longo do tempo.',
    condicao: {
      elementos: { morte: 8, agua: 8 },
      escolas: { maldicao: 10 },
    },
    capacidades: ['maldicao_veneno'],
  },
};
