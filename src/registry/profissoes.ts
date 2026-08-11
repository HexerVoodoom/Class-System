/**
 * Registro de PROFISSÕES (ofícios de criação), inspirado nas professions de
 * World of Warcraft (Ferraria, Alfaiataria, Engenharia…) e na forja
 * elemental de Ragnarok.
 *
 * A ideia central: o item criado não vem só da profissão — o RESTO DA FICHA
 * o molda. Um ferreiro com maestria em fogo E frio faz uma Têmpera Perfeita;
 * com veneno, uma lâmina envenenada; com gravidade/espaço, um machado
 * flutuante. As "propriedades emergentes" declaram os requisitos (elementos
 * com maestria, talentos, nível de profissão) e o motor descobre quais se
 * aplicam a cada item.
 */

import type { ElementoId } from './elementos';
import type { EscolaId } from './escolas';
import type { TalentoId } from './talentos';
import type { FamiliaCriatura } from './criaturas';

export type ProfissaoId =
  | 'ferreiro'
  | 'tecelao'
  | 'artesao'
  | 'joalheiro'
  | 'alquimista'
  | 'curtidor';

export type CategoriaItem = 'arma' | 'armadura' | 'acessorio' | 'consumivel';

export interface ProfissaoDef {
  id: ProfissaoId;
  nome: string;
  descricao: string;
  /** Pesos: elementos (base ou derivados) que elevam a qualidade do trabalho. */
  fatoresElementos: Partial<Record<ElementoId, number>>;
  /** Pesos de escola que ajudam (ex.: conjuração ajuda o artesão). */
  fatoresEscolas?: Partial<Record<EscolaId, number>>;
}

export interface ItemBaseDef {
  id: string;
  nome: string;
  profissao: ProfissaoId;
  categoria: CategoriaItem;
  descricao: string;
}

/** Uma propriedade que pode emergir num item, dada a ficha do artesão. */
export interface PropriedadeItemDef {
  id: string;
  nome: string;
  descricao: string;
  /** Categorias de item em que pode aparecer. */
  categorias: CategoriaItem[];
  /** Exige maestria (nível efetivo ≥ limiar) em TODOS estes elementos. */
  requerTodos?: ElementoId[];
  /** Exige maestria em ao menos UM destes elementos. */
  requerAlgum?: ElementoId[];
  /** Exige um talento investido. */
  requerTalento?: TalentoId;
  /** Exige nível mínimo na profissão. */
  requerProfissaoNivel?: number;
  /** Quanto adiciona à qualidade do item. */
  bonusQualidade: number;
}

export const PROFISSOES: Record<ProfissaoId, ProfissaoDef> = {
  ferreiro: {
    id: 'ferreiro',
    nome: 'Ferreiro',
    descricao: 'Forja armas e armaduras de metal. Escala com vigor, marcial, fogo e terra.',
    fatoresElementos: { vigor: 0.5, marcial: 0.5, fogo: 0.4, terra: 0.4 },
    fatoresEscolas: { combate_fisico: 0.3 },
  },
  tecelao: {
    id: 'tecelao',
    nome: 'Tecelão',
    descricao: 'Tece vestes e mantos encantados. Escala com arcano, ar e som.',
    fatoresElementos: { arcano: 0.5, ar: 0.4, som: 0.4, luz: 0.3 },
    fatoresEscolas: { benca: 0.3 },
  },
  artesao: {
    id: 'artesao',
    nome: 'Artesão',
    descricao: 'Monta engenhocas e dispositivos. Escala com arcano, eletricidade, gravidade e espaço.',
    fatoresElementos: { arcano: 0.5, eletricidade: 0.4, gravidade: 0.4, espaco: 0.4 },
    fatoresEscolas: { conjuracao: 0.3 },
  },
  joalheiro: {
    id: 'joalheiro',
    nome: 'Joalheiro',
    descricao: 'Lapida gemas e forja joias. Escala com luz, arcano e cristal.',
    fatoresElementos: { luz: 0.5, arcano: 0.5, cristal: 0.5, tempo: 0.3 },
  },
  alquimista: {
    id: 'alquimista',
    nome: 'Alquimista',
    descricao: 'Destila poções, óleos e bombas. Escala com água, vida, morte e vileza.',
    fatoresElementos: { agua: 0.5, vida: 0.4, morte: 0.4, vileza: 0.4 },
    fatoresEscolas: { maldicao: 0.3, benca: 0.2 },
  },
  curtidor: {
    id: 'curtidor',
    nome: 'Curtidor',
    descricao: 'Trabalha couro e peles de criaturas. Escala com vida, vigor e sombra.',
    fatoresElementos: { vida: 0.5, vigor: 0.4, sombra: 0.4, terra: 0.3 },
    fatoresEscolas: { evocacao: 0.2 },
  },
};

const item = (
  id: string,
  nome: string,
  profissao: ProfissaoId,
  categoria: CategoriaItem,
  descricao: string,
): ItemBaseDef => ({ id, nome, profissao, categoria, descricao });

export const ITENS_BASE: Record<string, ItemBaseDef> = Object.fromEntries(
  [
    // ferreiro
    item('espada', 'Espada', 'ferreiro', 'arma', 'Lâmina versátil de corte e estocada.'),
    item('adaga', 'Adaga', 'ferreiro', 'arma', 'Lâmina curta, rápida e furtiva.'),
    item('machado', 'Machado', 'ferreiro', 'arma', 'Peso e corte brutais.'),
    item('martelo_guerra', 'Martelo de Guerra', 'ferreiro', 'arma', 'Impacto que quebra armaduras.'),
    item('elmo', 'Elmo', 'ferreiro', 'armadura', 'Proteção para a cabeça.'),
    item('peitoral', 'Peitoral de Placas', 'ferreiro', 'armadura', 'Armadura pesada de metal.'),
    item('escudo', 'Escudo', 'ferreiro', 'armadura', 'Barreira de metal na mão.'),
    // tecelão
    item('tunica', 'Túnica Arcana', 'tecelao', 'armadura', 'Veste leve que amplia a magia.'),
    item('manto', 'Manto', 'tecelao', 'armadura', 'Capa que protege dos elementos.'),
    item('luvas_pano', 'Luvas de Pano', 'tecelao', 'armadura', 'Luvas finas para conjurar.'),
    item('estandarte', 'Estandarte', 'tecelao', 'acessorio', 'Bandeira que inspira aliados.'),
    // artesão
    item('besta_mecanica', 'Besta Mecânica', 'artesao', 'arma', 'Arma de repetição engenhosa.'),
    item('bracadeira', 'Braçadeira Engenhosa', 'artesao', 'acessorio', 'Dispositivo de pulso multiuso.'),
    item('dispositivo', 'Dispositivo', 'artesao', 'acessorio', 'Engenhoca de efeito variável.'),
    item('granada', 'Granada', 'artesao', 'consumivel', 'Explosivo arremessável.'),
    // joalheiro
    item('anel', 'Anel', 'joalheiro', 'acessorio', 'Aro encantado para o dedo.'),
    item('amuleto', 'Amuleto', 'joalheiro', 'acessorio', 'Pingente de poder protetor.'),
    item('coroa', 'Coroa', 'joalheiro', 'acessorio', 'Diadema que amplia a mente.'),
    item('gema', 'Gema Lapidada', 'joalheiro', 'acessorio', 'Cristal que engasta em outro item.'),
    // alquimista
    item('pocao', 'Poção', 'alquimista', 'consumivel', 'Frasco de efeito imediato.'),
    item('bomba', 'Bomba', 'alquimista', 'consumivel', 'Frasco instável arremessável.'),
    item('oleo', 'Óleo de Arma', 'alquimista', 'consumivel', 'Unção que imbui uma arma.'),
    item('elixir', 'Elixir', 'alquimista', 'consumivel', 'Poção duradoura e potente.'),
    // curtidor
    item('armadura_couro', 'Armadura de Couro', 'curtidor', 'armadura', 'Proteção leve e flexível.'),
    item('botas', 'Botas', 'curtidor', 'armadura', 'Calçado resistente de couro.'),
    item('capa_pele', 'Capa de Pele', 'curtidor', 'armadura', 'Manto quente de pele de fera.'),
    item('aljava', 'Aljava', 'curtidor', 'acessorio', 'Porta-flechas que agiliza os tiros.'),
  ].map((d) => [d.id, d]),
);

export function itensDaProfissao(profissao: ProfissaoId): ItemBaseDef[] {
  return Object.values(ITENS_BASE).filter((i) => i.profissao === profissao);
}

const prop = (
  id: string,
  nome: string,
  descricao: string,
  categorias: CategoriaItem[],
  cond: Omit<PropriedadeItemDef, 'id' | 'nome' | 'descricao' | 'categorias' | 'bonusQualidade'>,
  bonusQualidade: number,
): PropriedadeItemDef => ({ id, nome, descricao, categorias, ...cond, bonusQualidade });

/**
 * Propriedades emergentes: cada uma exige uma combinação da ficha. O motor
 * verifica maestria (nível efetivo) nos elementos exigidos.
 */
export const PROPRIEDADES_ITEM: Record<string, PropriedadeItemDef> = Object.fromEntries(
  [
    prop('tempera_perfeita', 'Têmpera Perfeita', 'Fogo e frio no metal: durabilidade e corte superiores.',
      ['arma', 'armadura'], { requerTodos: ['fogo', 'agua'] }, 10),
    prop('flamejante', 'Flamejante', 'A arma arde: adiciona queimadura.',
      ['arma'], { requerAlgum: ['fogo', 'lava', 'chama_azul', 'plasma'] }, 6),
    prop('gelida', 'Gélida', 'O toque congela: lentidão e congelamento.',
      ['arma'], { requerAlgum: ['gelo', 'agua'] }, 6),
    prop('envenenada', 'Envenenada', 'Lâmina untada: aplica veneno persistente.',
      ['arma'], { requerAlgum: ['veneno', 'morte', 'vileza', 'praga'] }, 7),
    prop('condutora', 'Condutora', 'Metal eletrificado: choque em cadeia.',
      ['arma'], { requerAlgum: ['eletricidade', 'plasma', 'tempestade', 'aco_voltaico'] }, 6),
    prop('flutuante', 'Flutuante', 'A arma orbita e ataca sozinha, sem mãos.',
      ['arma'], { requerAlgum: ['gravidade', 'espaco', 'ar', 'dobra'] }, 9),
    prop('abencoada', 'Abençoada', 'Consagrada: dano sagrado e proteção contra o profano.',
      ['arma', 'armadura', 'acessorio'], { requerAlgum: ['luz', 'santidade', 'bravura'] }, 6),
    prop('espectral', 'Espectral', 'Fere a alma: ignora parte da armadura.',
      ['arma'], { requerAlgum: ['sombra', 'espectro', 'vazio'] }, 7),
    prop('regenerativa', 'Regenerativa', 'Tece vida no portador: regeneração contínua.',
      ['armadura', 'acessorio'], { requerAlgum: ['vida', 'vitalidade', 'nascente'] }, 6),
    prop('gravitacional', 'Gravitacional', 'Campo de massa: puxa e prende inimigos próximos.',
      ['arma'], { requerAlgum: ['gravidade', 'buraco_negro', 'singularidade'] }, 8),
    prop('dimensional', 'Dimensional', 'Dobra o espaço: teleporte curto ao portador.',
      ['acessorio'], { requerAlgum: ['espaco', 'portal', 'continuum', 'eter'] }, 8),
    prop('temporal', 'Temporal', 'Ancorado no tempo: concede pressa ao portador.',
      ['acessorio'], { requerAlgum: ['tempo', 'cronomancia', 'aceleracao'] }, 8),
    prop('vampirica', 'Vampírica', 'Sedenta: rouba parte da vida do alvo.',
      ['arma'], { requerAlgum: ['parasita', 'morte', 'abismo'] }, 7),
    prop('runica', 'Rúnica', 'Gravada com runas: amplia o poder mágico do portador.',
      ['arma', 'armadura', 'acessorio'], { requerAlgum: ['runa', 'arcano', 'cristal'] }, 6),
    prop('ressonante', 'Ressonante', 'Vibra ao golpear: onda de choque sônica.',
      ['arma', 'acessorio'], { requerAlgum: ['som', 'trovao', 'brado'] }, 6),
    prop('obra_prima', 'Obra-Prima', 'Trabalho de mestre: qualidade excepcional em tudo.',
      ['arma', 'armadura', 'acessorio', 'consumivel'], { requerProfissaoNivel: 12 }, 12),
  ].map((d) => [d.id, d]),
);

export function propriedades(): PropriedadeItemDef[] {
  return Object.values(PROPRIEDADES_ITEM);
}

/**
 * Materiais de criatura: a pele/carcaça de cada FAMÍLIA do bestiário vira um
 * material que o artesão pode usar. Cada material adiciona qualidade
 * (proporcional ao poder-base da criatura) e uma propriedade própria — a
 * ponte entre captura e ofício.
 */
export interface MaterialCriaturaDef {
  familia: FamiliaCriatura;
  material: string;
  /** Propriedade concedida ao item, com seu bônus de qualidade. */
  propriedade: { nome: string; descricao: string; categorias: CategoriaItem[]; bonusQualidade: number };
  /** Bônus de qualidade por ponto de poder-base da criatura usada. */
  qualidadePorPoder: number;
}

export const MATERIAIS_CRIATURA: Record<FamiliaCriatura, MaterialCriaturaDef> = {
  besta: {
    familia: 'besta', material: 'Couro Rústico',
    propriedade: { nome: 'Resistente', descricao: 'Couro grosso: aguenta mais castigo.', categorias: ['armadura'], bonusQualidade: 5 },
    qualidadePorPoder: 0.15,
  },
  ave: {
    familia: 'ave', material: 'Plumas',
    propriedade: { nome: 'Leve como Pena', descricao: 'Não pesa nada: mobilidade e velocidade.', categorias: ['armadura', 'acessorio'], bonusQualidade: 6 },
    qualidadePorPoder: 0.15,
  },
  aquatica: {
    familia: 'aquatica', material: 'Escamas',
    propriedade: { nome: 'Escamada', descricao: 'Escamas sobrepostas: desliza golpes e repele água.', categorias: ['armadura'], bonusQualidade: 6 },
    qualidadePorPoder: 0.18,
  },
  ignea: {
    familia: 'ignea', material: 'Couro Ígneo',
    propriedade: { nome: 'Ignífuga', descricao: 'Imune ao fogo; queima quem toca.', categorias: ['armadura', 'acessorio'], bonusQualidade: 8 },
    qualidadePorPoder: 0.2,
  },
  morto_vivo: {
    familia: 'morto_vivo', material: 'Ossos e Mortalha',
    propriedade: { nome: 'Profana', descricao: 'Feita da morte: resiste a definhamento e medo.', categorias: ['armadura', 'arma'], bonusQualidade: 7 },
    qualidadePorPoder: 0.18,
  },
  aberracao: {
    familia: 'aberracao', material: 'Carne Aberrante',
    propriedade: { nome: 'Perturbadora', descricao: 'Errada de propósito: apavora quem encara.', categorias: ['armadura', 'arma', 'acessorio'], bonusQualidade: 7 },
    qualidadePorPoder: 0.2,
  },
  planta: {
    familia: 'planta', material: 'Fibra Viva',
    propriedade: { nome: 'Rebrotante', descricao: 'Fibra que se regenera: repara sozinha com o tempo.', categorias: ['armadura', 'acessorio'], bonusQualidade: 6 },
    qualidadePorPoder: 0.16,
  },
  espirito: {
    familia: 'espirito', material: 'Éctoplasma',
    propriedade: { nome: 'Etérea', descricao: 'Meio-fantasma: às vezes o golpe atravessa você.', categorias: ['armadura', 'acessorio'], bonusQualidade: 9 },
    qualidadePorPoder: 0.22,
  },
  construto: {
    familia: 'construto', material: 'Placas e Engrenagens',
    propriedade: { nome: 'Blindada', descricao: 'Ferro reaproveitado: defesa pesada embutida.', categorias: ['armadura'], bonusQualidade: 8 },
    qualidadePorPoder: 0.2,
  },
  demonio: {
    familia: 'demonio', material: 'Chifres e Couro Vil',
    propriedade: { nome: 'Maldita', descricao: 'Pactuada: amplia o poder, mas cobra seu preço.', categorias: ['arma', 'armadura', 'acessorio'], bonusQualidade: 9 },
    qualidadePorPoder: 0.22,
  },
  draconico: {
    familia: 'draconico', material: 'Escama de Dragão',
    propriedade: { nome: 'Dracônica', descricao: 'A cobiça dos reis: resistência elemental lendária.', categorias: ['arma', 'armadura', 'acessorio'], bonusQualidade: 14 },
    qualidadePorPoder: 0.28,
  },
};
