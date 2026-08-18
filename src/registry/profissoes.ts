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
  | 'curtidor'
  | 'encantador'
  | 'escriba'
  | 'cozinheiro'
  | 'luthier'
  | 'cartografo';

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
  encantador: {
    id: 'encantador',
    nome: 'Encantador',
    descricao:
      'Grava elementos em objetos já prontos. É a profissão que mais depende de combinações: quanto mais derivados você domina, mais fundo o encantamento vai.',
    fatoresElementos: { arcano: 0.6, luz: 0.35, sombra: 0.35, espaco: 0.3 },
    fatoresEscolas: { benca: 0.3, conjuracao: 0.2 },
  },
  escriba: {
    id: 'escriba',
    nome: 'Escriba',
    descricao: 'Redige pergaminhos, glifos e contratos vinculantes. Escala com arcano, tempo, luz e vileza.',
    fatoresElementos: { arcano: 0.5, tempo: 0.45, luz: 0.35, vileza: 0.3 },
    fatoresEscolas: { maldicao: 0.25, benca: 0.25 },
  },
  cozinheiro: {
    id: 'cozinheiro',
    nome: 'Cozinheiro',
    descricao: 'Prepara banquetes e rações que sustentam o grupo. Escala com vida, fogo, água e vigor.',
    fatoresElementos: { vida: 0.55, fogo: 0.4, agua: 0.35, vigor: 0.3 },
    fatoresEscolas: { benca: 0.35 },
  },
  luthier: {
    id: 'luthier',
    nome: 'Luthier',
    descricao: 'Constrói instrumentos que conduzem canções de guerra. Escala com som, ar, vida e marcial.',
    fatoresElementos: { som: 0.65, ar: 0.35, vida: 0.3, marcial: 0.25 },
    fatoresEscolas: { benca: 0.3 },
  },
  cartografo: {
    id: 'cartografo',
    nome: 'Cartógrafo',
    descricao: 'Desenha cartas do espaço, do tempo e do que há entre eles. Escala com espaço, tempo, gravidade e luz.',
    fatoresElementos: { espaco: 0.6, tempo: 0.45, gravidade: 0.35, luz: 0.25 },
    fatoresEscolas: { conjuracao: 0.25 },
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
    // encantador
    item('selo', 'Selo Elemental', 'encantador', 'acessorio', 'Marca gravada que carrega um elemento inteiro.'),
    item('orbe', 'Orbe de Foco', 'encantador', 'acessorio', 'Esfera que concentra e devolve a magia canalizada.'),
    item('inscricao_arma', 'Inscrição de Arma', 'encantador', 'arma', 'Gravação que transforma a arma sem refazê-la.'),
    item('velamento', 'Velamento', 'encantador', 'armadura', 'Camada invisível de proteção tecida sobre a peça.'),
    // escriba
    item('pergaminho', 'Pergaminho', 'escriba', 'consumivel', 'Uma conjuração inteira guardada em papel.'),
    item('glifo', 'Glifo', 'escriba', 'acessorio', 'Símbolo persistente que dispara ao ser pisado.'),
    item('grimorio', 'Grimório', 'escriba', 'acessorio', 'Volume que amplia tudo que você conjura.'),
    item('contrato', 'Contrato', 'escriba', 'consumivel', 'Acordo vinculante: cobra um preço, entrega um poder.'),
    // cozinheiro
    item('banquete', 'Banquete', 'cozinheiro', 'consumivel', 'Mesa que fortalece o grupo inteiro por horas.'),
    item('racao', 'Ração de Marcha', 'cozinheiro', 'consumivel', 'Comida densa que sustenta longas jornadas.'),
    item('caldo', 'Caldo Restaurador', 'cozinheiro', 'consumivel', 'Sopa quente que devolve o fôlego e a vontade.'),
    item('conserva', 'Conserva', 'cozinheiro', 'consumivel', 'Preparo que guarda um efeito por muito tempo.'),
    // luthier
    item('alaude', 'Alaúde', 'luthier', 'arma', 'Instrumento de corda que dispara acordes cortantes.'),
    item('tambor', 'Tambor de Guerra', 'luthier', 'acessorio', 'Batida que marca o ritmo da linha de frente.'),
    item('corno', 'Corno de Batalha', 'luthier', 'acessorio', 'Sopro que se ouve do outro lado do campo.'),
    item('diapasao', 'Diapasão', 'luthier', 'acessorio', 'Referência perfeita: afina magias como afina cordas.'),
    // cartógrafo
    item('carta_estelar', 'Carta Estelar', 'cartografo', 'acessorio', 'Mapa do céu que aponta onde o poder está agora.'),
    item('bussola', 'Bússola Dimensional', 'cartografo', 'acessorio', 'Agulha que aponta para lugares que não existem aqui.'),
    item('atlas', 'Atlas', 'cartografo', 'acessorio', 'Compêndio de rotas entre lugares e épocas.'),
    item('marco', 'Marco de Retorno', 'cartografo', 'consumivel', 'Âncora fincada: você sempre pode voltar a este ponto.'),
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
      ['arma'], { requerAlgum: ['gravidade', 'espaco', 'ar', 'espaco'] }, 9),
    prop('abencoada', 'Abençoada', 'Consagrada: dano sagrado e proteção contra o profano.',
      ['arma', 'armadura', 'acessorio'], { requerAlgum: ['luz', 'santidade', 'bravura'] }, 6),
    prop('espectral', 'Espectral', 'Fere a alma: ignora parte da armadura.',
      ['arma'], { requerAlgum: ['sombra', 'espectro', 'horizonte_de_eventos'] }, 7),
    prop('regenerativa', 'Regenerativa', 'Tece vida no portador: regeneração contínua.',
      ['armadura', 'acessorio'], { requerAlgum: ['vida', 'vigor', 'nascente'] }, 6),
    prop('gravitacional', 'Gravitacional', 'Campo de massa: puxa e prende inimigos próximos.',
      ['arma'], { requerAlgum: ['gravidade', 'buraco_negro', 'tempo'] }, 8),
    prop('dimensional', 'Dimensional', 'Dobra o espaço: teleporte curto ao portador.',
      ['acessorio'], { requerAlgum: ['espaco', 'continuum', 'continuum', 'eter'] }, 8),
    prop('temporal', 'Temporal', 'Ancorado no tempo: concede pressa ao portador.',
      ['acessorio'], { requerAlgum: ['tempo', 'tempo', 'continuum'] }, 8),
    prop('vampirica', 'Vampírica', 'Sedenta: rouba parte da vida do alvo.',
      ['arma'], { requerAlgum: ['parasita', 'morte', 'abismo'] }, 7),
    prop('runica', 'Rúnica', 'Gravada com runas: amplia o poder mágico do portador.',
      ['arma', 'armadura', 'acessorio'], { requerAlgum: ['runa', 'arcano', 'cristal'] }, 6),
    prop('ressonante', 'Ressonante', 'Vibra ao golpear: onda de choque sônica.',
      ['arma', 'acessorio'], { requerAlgum: ['som', 'trovao', 'cadencia'] }, 6),
    prop('obra_prima', 'Obra-Prima', 'Trabalho de mestre: qualidade excepcional em tudo.',
      ['arma', 'armadura', 'acessorio', 'consumivel'], { requerProfissaoNivel: 12 }, 12),

    // ---- propriedades que só emergem de COMBINAÇÕES de aridade alta ----
    prop('tempestuosa', 'Tempestuosa', 'Vento, água e raio no mesmo objeto: cada golpe chama o céu.',
      ['arma', 'acessorio'], { requerTodos: ['agua', 'ar', 'eletricidade'] }, 13),
    prop('cataclismica', 'Cataclísmica', 'Peso de mundo: o impacto abre cratera onde acerta.',
      ['arma'], { requerTodos: ['terra', 'gravidade', 'fogo'] }, 15),
    prop('sepulcral', 'Sepulcral', 'Morte, sombra e vileza costuradas: a peça se alimenta de quem cai perto.',
      ['arma', 'armadura'], { requerTodos: ['morte', 'sombra', 'vileza'] }, 14),
    prop('consagrada', 'Consagrada', 'Luz, vida e vigor consagrados juntos: protege e ergue quem porta.',
      ['armadura', 'acessorio'], { requerTodos: ['luz', 'vida', 'vigor'] }, 14),
    prop('paradoxal', 'Paradoxal', 'Tempo e espaço trançados no material: o objeto está sempre um instante à frente.',
      ['arma', 'acessorio'], { requerTodos: ['tempo', 'espaco'] }, 12),
    prop('primordial_item', 'Primordial', 'Os cinco primais assentados numa peça só: ela responde ao terreno.',
      ['arma', 'armadura', 'acessorio'],
      { requerTodos: ['fogo', 'agua', 'terra', 'ar', 'eletricidade'], requerProfissaoNivel: 15 }, 20),

    // ---- propriedades das profissões novas ----
    prop('harmonica', 'Harmônica', 'Afinada com precisão: as canções que saem daqui alcançam mais longe.',
      ['arma', 'acessorio'], { requerAlgum: ['som', 'harmonia', 'cantico', 'som'] }, 8),
    prop('dissonante', 'Dissonante', 'Propositalmente desafinada: quem escuta perde o compasso.',
      ['arma', 'acessorio'], { requerAlgum: ['dissonancia', 'sussurro', 'requiem'] }, 8),
    prop('nutritiva', 'Nutritiva', 'Sustento de verdade: o efeito dura muito além da refeição.',
      ['consumivel'], { requerAlgum: ['vida', 'vigor', 'nascente', 'flora'] }, 7),
    prop('inebriante', 'Inebriante', 'Sobe à cabeça: coragem emprestada, juízo suspenso.',
      ['consumivel'], { requerAlgum: ['vileza', 'fervor', 'carnificina'] }, 7),
    prop('vinculante', 'Vinculante', 'O que está escrito passa a valer: o efeito não pode ser dissipado.',
      ['consumivel', 'acessorio'], { requerAlgum: ['pacto', 'runa', 'arcano'] }, 9),
    prop('profetica', 'Profética', 'Registra o que ainda não aconteceu: revela a próxima ação do inimigo.',
      ['acessorio'], { requerAlgum: ['tempo', 'tempo', 'presagio', 'continuum'] }, 11),
    prop('cartografada', 'Cartografada', 'O espaço já foi medido: teleporte preciso em vez de aproximado.',
      ['acessorio'], { requerAlgum: ['espaco', 'continuum', 'espaco', 'constelacao'] }, 10),
    prop('gravada_fundo', 'Gravada Fundo', 'Encantamento assentado na estrutura, não na superfície: não se apaga.',
      ['arma', 'armadura', 'acessorio'],
      { requerAlgum: ['arcano', 'cristal', 'runa'], requerProfissaoNivel: 10 }, 11),
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
  gigante: {
    familia: 'gigante', material: 'Ossatura Colossal',
    propriedade: { nome: 'Descomunal', descricao: 'Peso e alcance fora da escala: golpes mais pesados.', categorias: ['arma', 'armadura'], bonusQualidade: 10 },
    qualidadePorPoder: 0.24,
  },
  geleia: {
    familia: 'geleia', material: 'Gel Reativo',
    propriedade: { nome: 'Absorvente', descricao: 'Amortece impacto ao se deformar sob o golpe.', categorias: ['armadura', 'acessorio'], bonusQualidade: 6 },
    qualidadePorPoder: 0.17,
  },
  humanoide: {
    familia: 'humanoide', material: 'Couro Curtido',
    propriedade: { nome: 'Versátil', descricao: 'Trabalhado por mãos hábeis: encaixe confortável em qualquer peça.', categorias: ['arma', 'armadura', 'acessorio'], bonusQualidade: 5 },
    qualidadePorPoder: 0.14,
  },
};
