/**
 * FORMAS DE CONFIGURAÇÃO — o vocabulário com que se DESCREVE uma skill ou uma
 * fusão, sem nada que as calcule.
 *
 * Estas interfaces moravam em `engine/skills.ts` e `engine/fusao.ts`. Saíram
 * de lá quando o registro de classes prontas (`presets.ts`) precisou declarar
 * skills: um registro importando do motor — ainda que só o tipo — abre a
 * primeira seta invertida na separação registry → engine → ui. Com as formas
 * aqui, a seta continua apontando num sentido só.
 *
 * O critério do que entra: **descrição, nunca cálculo**. Constantes de
 * balanceamento, limites, normalização de fontes e tudo que produz número
 * continuam no motor. Se algo aqui precisar de uma fórmula para ser entendido,
 * está no arquivo errado.
 */

import type { ElementoBaseId, ElementoId } from './elementos';
import type { EscolaId } from './escolas';
import type { RecursoId } from './recursos';
import type { ModificadorId } from './modificadores';

/**
 * Fonte da evocação, usada só em skills de escola Evocação:
 *  - elemental: um elemental do próprio elemento da skill (padrão).
 *  - aleatoria: criatura qualquer; escala com Evocação, sem preparo.
 *  - capturada: uma criatura do bestiário, imbuída do elemento da skill.
 */
export type ModoEvocacao = 'elemental' | 'aleatoria' | 'capturada';

export interface EvocacaoSkill {
  modo: ModoEvocacao;
  criaturaId?: string;
}

export type AreaConfig = { tipo: 'unico' } | { tipo: 'circulo'; raioMetros: number };

export type EntregaConfig =
  | { tipo: 'instantaneo' }
  | { tipo: 'continuo'; duracaoSegundos: number };

/** Uma fonte de energia da skill; proporções são relativas (normalizadas). */
export interface FonteEnergia {
  recurso: RecursoId;
  proporcao: number;
}

export interface SkillConfig {
  nome: string;
  elemento: ElementoId;
  escola: EscolaId;
  /** Fontes de energia combinadas em proporções livres. */
  fontes: FonteEnergia[];
  /** Quanto de energia é investido; mais energia = mais resultado. */
  energia: number;
  /** Mais tempo de conjuração = mais resultado. */
  tempoConjuracaoSegundos: number;
  /** Distância de lançamento; limitada por talentos, encarece de leve. */
  alcanceMetros: number;
  area: AreaConfig;
  entrega: EntregaConfig;
  /** Capacidade de arquétipo exigida (ex.: 'evocar_demonios_mortos'). */
  capacidadeExigida?: string;
  /** Fonte da evocação (só relevante em escola Evocação; padrão: elemental). */
  evocacao?: EvocacaoSkill;
  /** Criatura montável usada como veículo desta skill (requer talento Montaria). */
  montariaId?: string;
  /** Afinidade elemental do alvo, para calcular efetividade (opcional). */
  alvoElemento?: ElementoBaseId;
  /**
   * Modificadores de 2ª geração aplicados sobre esta skill (support gems).
   * Cada um multiplica o custo e exige compatibilidade de tag.
   */
  modificadores?: ModificadorId[];
}

export interface FusaoConfig {
  nome: string;
  /** 2 a 4 skills componentes. */
  componentes: SkillConfig[];
  /** Escola resultante; padrão: a do primeiro componente. */
  escolaDominante?: EscolaId;
  /** Modificadores aplicados sobre a skill FUNDIDA (não sobre os componentes). */
  modificadores?: ModificadorId[];
  alvoElemento?: ElementoBaseId;
}
