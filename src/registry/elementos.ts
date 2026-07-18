/**
 * Registro de elementos.
 *
 * Categorias:
 *  - "base": recebem pontos diretamente do jogador (12 elementos).
 *  - "derivado": não recebem pontos diretos; o nível é o MENOR nível efetivo
 *    entre os componentes da receita (evolução conjunta), desde que todos
 *    atinjam o mínimo. TODAS as 66 combinações de pares existem, mais
 *    triplas e combinações maiores selecionadas.
 *  - "especial": derivados com receita ampla (primordial, ciclo, nulo).
 *
 * Cada elemento tem um PERFIL (pesos de dano/controle/cura/defesa/suporte)
 * que molda o resultado das skills. Derivados herdam a média dos perfis dos
 * componentes — a identidade mecânica da combinação emerge sozinha.
 */

export type ElementoBaseId =
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
  | 'marcial';

export interface PerfilPesos {
  dano: number;
  controle: number;
  cura: number;
  defesa: number;
  suporte: number;
}

export interface ReceitaComponente {
  elemento: ElementoBaseId;
  /** Nível efetivo mínimo do componente para o derivado existir. */
  nivelMinimo: number;
}

export interface ElementoDef {
  id: string;
  nome: string;
  tipo: 'base' | 'derivado' | 'especial';
  descricao: string;
  /** Derivados exigem investimento múltiplo, então pagam melhor por nível. */
  fatorPotencia: number;
  pesos: PerfilPesos;
  receita?: ReceitaComponente[];
}

/** Elementos primais: recebem transbordo de pontos de "vida". */
export const ELEMENTOS_PRIMAIS: ElementoBaseId[] = [
  'fogo',
  'agua',
  'terra',
  'ar',
  'eletricidade',
];

const pesos = (
  dano: number,
  controle: number,
  cura: number,
  defesa: number,
  suporte: number,
): PerfilPesos => ({ dano, controle, cura, defesa, suporte });

const ELEMENTOS_BASE: Record<ElementoBaseId, ElementoDef> = {
  fogo: {
    id: 'fogo',
    nome: 'Fogo',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(1.0, 0, 0, 0, 0),
    descricao: 'Destruição pura: dano direto e queimadura.',
  },
  agua: {
    id: 'agua',
    nome: 'Água',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.4, 0.4, 0.2, 0, 0),
    descricao: 'Fluxo e adaptação: empurra, puxa, afoga e sustenta.',
  },
  terra: {
    id: 'terra',
    nome: 'Terra',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.3, 0.2, 0, 0.5, 0),
    descricao: 'Peso e permanência: muralhas, tremores e imobilidade.',
  },
  ar: {
    id: 'ar',
    nome: 'Ar',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.4, 0.4, 0, 0, 0.2),
    descricao: 'Velocidade e alcance: lâminas de vento e deslocamento.',
  },
  eletricidade: {
    id: 'eletricidade',
    nome: 'Eletricidade',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.8, 0.2, 0, 0, 0),
    descricao: 'Picos instantâneos: dano em cadeia e paralisia breve.',
  },
  arcano: {
    id: 'arcano',
    nome: 'Arcano',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.5, 0.2, 0, 0, 0.3),
    descricao: 'Magia pura: conversa com todas as escolas e elementos mágicos.',
  },
  sombra: {
    id: 'sombra',
    nome: 'Sombra',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.5, 0.3, 0, 0, 0.2),
    descricao: 'Furtividade, drenagem e medo.',
  },
  luz: {
    id: 'luz',
    nome: 'Luz',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.3, 0, 0.3, 0.2, 0.2),
    descricao: 'Revelação, punição e proteção.',
  },
  vileza: {
    id: 'vileza',
    nome: 'Vileza',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.6, 0.3, 0, 0, 0.1),
    descricao: 'Pactos, corrupção e demônios; vizinha do fogo.',
  },
  morte: {
    id: 'morte',
    nome: 'Morte',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.6, 0.3, 0, 0, 0.1),
    descricao: 'Decadência, mortos-vivos e o fim inevitável.',
  },
  vida: {
    id: 'vida',
    nome: 'Vida',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0, 0, 0.6, 0.2, 0.2),
    descricao: 'Cura e crescimento; alimenta os elementos primais.',
  },
  vigor: {
    id: 'vigor',
    nome: 'Vigor',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.6, 0, 0, 0.3, 0.1),
    descricao: 'O espírito do corpo; potencializa o combate físico.',
  },
  marcial: {
    id: 'marcial',
    nome: 'Marcial',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.7, 0.1, 0, 0.2, 0),
    descricao: 'A arte das armas: maestria, técnica e armas evocadas.',
  },
};

interface OpcoesDerivado {
  fator?: number;
  minimo?: number;
  tipo?: 'derivado' | 'especial';
}

function derivado(
  id: string,
  nome: string,
  componentes: ElementoBaseId[],
  descricao: string,
  opts: OpcoesDerivado = {},
): ElementoDef {
  const fator = opts.fator ?? (componentes.length >= 3 ? 1.3 : 1.15);
  const minimo = opts.minimo ?? (componentes.length >= 3 ? 15 : 10);
  const media: PerfilPesos = { dano: 0, controle: 0, cura: 0, defesa: 0, suporte: 0 };
  for (const c of componentes) {
    const p = ELEMENTOS_BASE[c].pesos;
    media.dano += p.dano / componentes.length;
    media.controle += p.controle / componentes.length;
    media.cura += p.cura / componentes.length;
    media.defesa += p.defesa / componentes.length;
    media.suporte += p.suporte / componentes.length;
  }
  return {
    id,
    nome,
    tipo: opts.tipo ?? 'derivado',
    fatorPotencia: fator,
    pesos: media,
    descricao,
    receita: componentes.map((elemento) => ({ elemento, nivelMinimo: minimo })),
  };
}

/**
 * A matriz completa: TODOS os 66 pares dos 12 elementos base, seguidos das
 * combinações de 3+, das amplas (primordial, ciclo) e do nulo.
 */
const DERIVADOS_LISTA: ElementoDef[] = [
  // ---- fogo + X ----
  derivado('vapor', 'Vapor', ['fogo', 'agua'], 'Névoa escaldante: queima, oculta e sufoca em área.', { fator: 1.2 }),
  derivado('lava', 'Lava', ['fogo', 'terra'], 'Fogo que adere: impacto pesado + queimadura persistente.'),
  derivado('incendio', 'Incêndio', ['fogo', 'ar'], 'Fogo alimentado pelo vento: espalha-se sozinho de alvo em alvo.'),
  derivado('plasma', 'Plasma', ['fogo', 'eletricidade'], 'Matéria ionizada: o dano mais cru do sistema, difícil de resistir.'),
  derivado('fogo_feiticeiro', 'Fogo Feiticeiro', ['fogo', 'arcano'], 'Chama programável: explosões com atraso, formas e gatilhos.'),
  derivado('fogo_negro', 'Fogo Negro', ['fogo', 'sombra'], 'Chama que não ilumina: queima e drena ao mesmo tempo.'),
  derivado('chama_solar', 'Chama Solar', ['fogo', 'luz'], 'Fogo purificador: dano que também abençoa aliados próximos.'),
  derivado('fogo_infernal', 'Fogo Infernal', ['fogo', 'vileza'], 'A fornalha dos pactos: queima a carne e a vontade.'),
  derivado('chama_azul', 'Chama Azul', ['fogo', 'morte'], 'Fogo que queima a alma; ignora parte da defesa.', { fator: 1.2, minimo: 12 }),
  derivado('fenix', 'Fênix', ['fogo', 'vida'], 'Fogo que renasce: dano que retorna como cura.'),
  derivado('fervor', 'Fervor', ['fogo', 'vigor'], 'Sangue fervente: golpes físicos incendiários.'),

  // ---- agua + X ----
  derivado('pantano', 'Pântano', ['agua', 'terra'], 'Lama viva: prende, afunda e engole os inimigos.'),
  derivado('gelo', 'Gelo', ['agua', 'ar'], 'Água parada no tempo: congela, retarda e estilhaça.'),
  derivado('agua_viva', 'Água-Viva', ['agua', 'eletricidade'], 'Corrente condutora: choques que viajam por superfícies molhadas.'),
  derivado('mare', 'Maré', ['agua', 'arcano'], 'Fluxo lunar: ondas que reposicionam aliados e inimigos.'),
  derivado('abismo', 'Abismo', ['agua', 'sombra'], 'Pressão das profundezas: esmaga e cega quem afunda.'),
  derivado('prisma', 'Prisma', ['agua', 'luz'], 'Luz refratada: divide um efeito entre múltiplos feixes.'),
  derivado('acido', 'Ácido', ['agua', 'vileza'], 'Corrosão: derrete armadura e derrete defesas.'),
  derivado('veneno', 'Veneno', ['agua', 'morte'], 'Toxina paciente: dano contínuo que se recusa a sair.'),
  derivado('nascente', 'Nascente', ['agua', 'vida'], 'Fonte restauradora: cura em área que persiste no chão.'),
  derivado('correnteza', 'Correnteza', ['agua', 'vigor'], 'Fluidez marcial: golpes encadeados sem pausa.'),

  // ---- terra + X ----
  derivado('areia', 'Areia', ['terra', 'ar'], 'Tempestade de areia: cega, corrói e desloca.'),
  derivado('magnetismo', 'Magnetismo', ['terra', 'eletricidade'], 'Atração e repulsão: desarma, puxa e prende metais.'),
  derivado('cristal', 'Cristal', ['terra', 'arcano'], 'Terra lapidada pelo arcano: barreiras e foco amplificador.'),
  derivado('obsidiana', 'Obsidiana', ['terra', 'sombra'], 'Vidro vulcânico: lâminas defensivas que cortam quem ataca.'),
  derivado('ouro_vivo', 'Ouro Vivo', ['terra', 'luz'], 'Metal sagrado: armaduras e armas conjuradas brilhantes.'),
  derivado('solo_profano', 'Solo Profano', ['terra', 'vileza'], 'Chão corrompido: território que enfraquece quem pisa.'),
  derivado('ossuario', 'Ossuário', ['terra', 'morte'], 'Os ossos da terra: muralhas e lanças de osso.'),
  derivado('flora', 'Flora', ['terra', 'vida'], 'Natureza desperta: vinhas, raízes e crescimento selvagem.'),
  derivado('tita', 'Titã', ['terra', 'vigor'], 'Corpo de pedra: força colossal e pele impenetrável.'),

  // ---- ar + X ----
  derivado('tempestade', 'Tempestade', ['ar', 'eletricidade'], 'Céu em fúria: área enorme e relâmpagos encadeados.'),
  derivado('eter', 'Éter', ['ar', 'arcano'], 'O vento entre os mundos: teleporte curto e levitação.'),
  derivado('murmurio', 'Murmúrio', ['ar', 'sombra'], 'Vozes no vento: medo, confusão e sussurros que distraem.'),
  derivado('aurora', 'Aurora', ['ar', 'luz'], 'Véu celeste: proteção em área e clareza mental.'),
  derivado('enxofre', 'Enxofre', ['ar', 'vileza'], 'Fumaça infernal: nuvens tóxicas que corrompem o fôlego.'),
  derivado('miasma', 'Miasma', ['ar', 'morte'], 'Ar pútrido: praga aerotransportada de longo alcance.'),
  derivado('alento', 'Alento', ['ar', 'vida'], 'Sopro vital: cura à distância e fôlego renovado.'),
  derivado('impeto', 'Ímpeto', ['ar', 'vigor'], 'Velocidade sobre-humana: investidas e esquivas relâmpago.'),

  // ---- eletricidade + X ----
  derivado('fluxo', 'Fluxo', ['eletricidade', 'arcano'], 'Corrente de mana: sobrecarrega magias e dispositivos.'),
  derivado('trovao_negro', 'Trovão Negro', ['eletricidade', 'sombra'], 'Relâmpago silencioso: atinge sem aviso e sem som.'),
  derivado('fulgor', 'Fulgor', ['eletricidade', 'luz'], 'Clarão ofuscante: cega em área e pune quem ataca.'),
  derivado('tormento', 'Tormento', ['eletricidade', 'vileza'], 'Choque cruel: dor que interrompe e desespera.'),
  derivado('galvanismo', 'Galvanismo', ['eletricidade', 'morte'], 'A centelha que reanima: constructos de carne e raio.'),
  derivado('sinapse', 'Sinapse', ['eletricidade', 'vida'], 'Sistema nervoso: acelera aliados e trava reflexos inimigos.'),
  derivado('reflexo', 'Reflexo', ['eletricidade', 'vigor'], 'Nervos elétricos: contra-ataques instantâneos.'),

  // ---- arcano + X ----
  derivado('ocultismo', 'Ocultismo', ['arcano', 'sombra'], 'Saber proibido: magias que o alvo não vê chegar.'),
  derivado('runa', 'Runa', ['arcano', 'luz'], 'Palavra gravada: efeitos persistentes ancorados no chão ou em aliados.'),
  derivado('pacto', 'Pacto', ['arcano', 'vileza'], 'Contrato de poder: sacrifica recurso por efeito ampliado.'),
  derivado('alma', 'Alma', ['arcano', 'morte'], 'A moeda dos mortos: manipula espíritos e essências.'),
  derivado('essencia', 'Essência', ['arcano', 'vida'], 'A matéria-prima da vida: transmutação e restauração profunda.'),
  derivado('encantamento', 'Encantamento', ['arcano', 'vigor'], 'Corpo como foco: armas e punhos imbuídos de magia.'),

  // ---- sombra + X ----
  derivado('crepusculo', 'Crepúsculo', ['sombra', 'luz'], 'A fronteira: revela e oculta ao mesmo tempo.', { fator: 1.25, minimo: 15 }),
  derivado('terror', 'Terror', ['sombra', 'vileza'], 'Medo encarnado: inimigos fogem ou congelam.'),
  derivado('espectro', 'Espectro', ['sombra', 'morte'], 'Forma incorpórea: atravessa paredes e ignora armadura.'),
  derivado('parasita', 'Parasita', ['sombra', 'vida'], 'Vida roubada: drena o inimigo para curar você.'),
  derivado('assassinio', 'Assassínio', ['sombra', 'vigor'], 'A arte do golpe único: dano massivo pelas costas.'),

  // ---- luz + X ----
  derivado('heresia', 'Heresia', ['luz', 'vileza'], 'Luz falsa: ilusões sagradas e milagres corrompidos.'),
  derivado('julgamento', 'Julgamento', ['luz', 'morte'], 'O veredito final: executa alvos enfraquecidos.'),
  derivado('santidade', 'Santidade', ['luz', 'vida'], 'Graça plena: a cura mais pura do sistema.'),
  derivado('bravura', 'Bravura', ['luz', 'vigor'], 'Coragem radiante: aura que fortalece a linha de frente.'),

  // ---- vileza + X ----
  derivado('praga', 'Praga', ['vileza', 'morte'], 'Corrupção contagiosa: veneno e maldição se espalham.', { fator: 1.2, minimo: 12 }),
  derivado('mutacao', 'Mutação', ['vileza', 'vida'], 'Carne moldável: transforma o próprio corpo em arma.'),
  derivado('carnificina', 'Carnificina', ['vileza', 'vigor'], 'Sede de sangue: quanto mais fere, mais forte fica.'),

  // ---- morte + X ----
  derivado('equilibrio', 'Equilíbrio', ['morte', 'vida'], 'Vida e morte na mesma mão: converte dano em cura e cura em dano.', { fator: 1.25, minimo: 15 }),
  derivado('ceifa', 'Ceifa', ['morte', 'vigor'], 'A foice encarnada: golpes físicos que colhem almas.'),

  // ---- vida + X ----
  derivado('vitalidade', 'Vitalidade', ['vida', 'vigor'], 'Regeneração contínua: o corpo que não aceita cair.'),

  // ---- marcial + X ----
  derivado('forja', 'Forja', ['marcial', 'fogo'], 'Armas nascidas do fogo: lâminas incandescentes e martelos de brasa.'),
  derivado('tempera', 'Têmpera', ['marcial', 'agua'], 'O fio perfeito: lâminas temperadas que nunca perdem o corte.'),
  derivado('aco', 'Aço', ['marcial', 'terra'], 'Metal da terra: armas pesadas e armaduras vivas.'),
  derivado('esgrima', 'Esgrima', ['marcial', 'ar'], 'A dança da lâmina leve: estocadas rápidas como o vento.'),
  derivado('aco_voltaico', 'Aço Voltaico', ['marcial', 'eletricidade'], 'Armas condutoras: cada golpe descarrega um relâmpago.'),
  derivado('arsenal', 'Arsenal', ['marcial', 'arcano'], 'Armas conjuradas do nada: um arsenal etéreo ao seu dispor.'),
  derivado('lamina_oculta', 'Lâmina Oculta', ['marcial', 'sombra'], 'A arma que ninguém vê: golpes das sombras.'),
  derivado('lamina_radiante', 'Lâmina Radiante', ['marcial', 'luz'], 'A espada-voto: arde contra o profano e protege o portador.'),
  derivado('serrilha', 'Serrilha', ['marcial', 'vileza'], 'Armas cruéis: feridas que não fecham.'),
  derivado('fio_funebre', 'Fio Fúnebre', ['marcial', 'morte'], 'A lâmina que colhe: cada abate fortalece o próximo golpe.'),
  derivado('lamina_viva', 'Lâmina Viva', ['marcial', 'vida'], 'Armas que crescem: madeira viva, espinhos e seiva.'),
  derivado('maestria', 'Maestria', ['marcial', 'vigor'], 'Corpo e arma como um só: a técnica além da perfeição.'),

  // ---- triplas ----
  derivado('chama_demoniaca', 'Chama Demoníaca', ['fogo', 'vileza', 'morte'], 'Fogo alimentado por pacto e morte: queima corpo, alma e contrato.'),
  derivado('furacao', 'Furacão', ['agua', 'ar', 'eletricidade'], 'A tempestade perfeita: área devastadora que se move sozinha.'),
  derivado('selva', 'Selva', ['agua', 'terra', 'vida'], 'Ecossistema vivo: terreno inteiro que luta por você.'),
  derivado('abominacao', 'Abominação', ['sombra', 'morte', 'vileza'], 'O horror completo: criaturas que não deveriam existir.'),
  derivado('eclipse', 'Eclipse', ['luz', 'sombra', 'arcano'], 'O instante em que os opostos se alinham: anula magias alheias.'),
  derivado('reencarnacao', 'Reencarnação', ['vida', 'morte', 'arcano'], 'O ciclo dominado: retorno da morte e segunda chance.'),
  derivado('sobrecarga', 'Sobrecarga', ['eletricidade', 'arcano', 'vigor'], 'Corpo-condutor: velocidade e poder além do limite seguro.'),
  derivado('ascensao', 'Ascensão', ['luz', 'vida', 'vigor'], 'Forma exaltada: transcende brevemente a condição mortal.'),
  derivado('nucleo', 'Núcleo', ['fogo', 'terra', 'eletricidade'], 'O coração do mundo: erupções magnéticas e magma pressurizado.'),
  derivado('avatar_de_guerra', 'Avatar de Guerra', ['marcial', 'vigor', 'arcano'], 'A guerra encarnada: cem armas orbitando um corpo perfeito.'),

  // ---- amplas e especiais ----
  derivado(
    'primordial',
    'Primordial',
    ['fogo', 'agua', 'terra', 'ar', 'eletricidade'],
    'Os cinco primais em harmonia: comanda o próprio terreno da batalha.',
    { fator: 1.35, minimo: 12, tipo: 'especial' },
  ),
  derivado(
    'ciclo',
    'Ciclo',
    ['vida', 'morte', 'luz', 'sombra'],
    'Nascimento, morte, dia e noite: inverte estados — cura vira dano, buff vira maldição.',
    { fator: 1.35, minimo: 12, tipo: 'especial' },
  ),
  derivado(
    'nulo',
    'Nulo',
    ['fogo', 'agua', 'terra', 'ar', 'eletricidade', 'arcano', 'sombra', 'luz', 'vileza', 'morte', 'vida', 'vigor', 'marcial'],
    'O elemento de quem dominou todos: nega, absorve e devolve qualquer coisa.',
    { fator: 1.4, minimo: 8, tipo: 'especial' },
  ),
];

const DERIVADOS: Record<string, ElementoDef> = Object.fromEntries(
  DERIVADOS_LISTA.map((d) => [d.id, d]),
);

export const ELEMENTOS: Record<string, ElementoDef> = {
  ...ELEMENTOS_BASE,
  ...DERIVADOS,
};

export type ElementoId = ElementoBaseId | string;

export function elementosBase(): ElementoDef[] {
  return Object.values(ELEMENTOS_BASE);
}

export function elementosDerivados(): ElementoDef[] {
  return DERIVADOS_LISTA;
}

/**
 * Sinergias de transbordo: pontos DIRETOS em `de` geram nível efetivo bônus
 * em cada elemento de `para`, na razão dada (arredondado para baixo).
 */
export interface Sinergia {
  de: ElementoBaseId;
  para: ElementoBaseId[];
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
  { de: 'vigor', para: ['vida'], razao: 0.1 },
  { de: 'vida', para: ['vigor'], razao: 0.1 },
  { de: 'marcial', para: ['vigor'], razao: 0.1 },
  { de: 'vigor', para: ['marcial'], razao: 0.1 },
  { de: 'terra', para: ['vigor'], razao: 0.05 },
  { de: 'eletricidade', para: ['ar'], razao: 0.05 },
  // Arcano é magia pura: alimenta de leve tudo que não é físico.
  {
    de: 'arcano',
    para: ['fogo', 'agua', 'terra', 'ar', 'eletricidade', 'sombra', 'luz'],
    razao: 0.05,
  },
];
