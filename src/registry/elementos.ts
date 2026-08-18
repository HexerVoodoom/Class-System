/**
 * Registro de elementos.
 *
 * Categorias:
 *  - "base": recebem pontos diretamente do jogador (17 elementos).
 *  - "derivado": não recebem pontos diretos; o nível é o MENOR nível efetivo
 *    entre os componentes da receita (evolução conjunta), desde que todos
 *    atinjam o mínimo. TODOS os 136 pares existem aqui, nomeados à mão.
 *    Triplas e quádruplas moram em `combinacoes.ts`: as de identidade forte
 *    são curadas, as outras 3.000 são geradas sob demanda.
 *  - "especial": derivados com receita ampla (primordial, ciclo, nulo).
 *
 * Cada elemento tem um PERFIL (pesos de dano/controle/cura/defesa/suporte)
 * que molda o resultado das skills. Derivados herdam a média dos perfis dos
 * componentes — a identidade mecânica da combinação emerge sozinha.
 */

import { DIVISOR_CASCATA_ESPECIAL } from './geracoes';

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
  | 'marcial'
  | 'gravidade';

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

/**
 * Regra de CASCATA declarativa — o escape hatch dos elementos cuja cascata
 * foge do padrão (os `especial`). Sem este campo, o motor usa o default:
 * pais = sub-combinações de aridade N−1, divisor = DIVISOR_CASCata da
 * aridade, destravável. Exceção declarada no REGISTRO, nunca `if` por id
 * dentro do motor.
 */
export interface RegraCascata {
  /** Pais explícitos (default: sub-combinações de aridade N−1). */
  pais?: string[];
  /** Divisor próprio (default: DIVISOR_CASCATA[aridade]). */
  divisor?: number;
  /** false = nunca aceita ponto direto. Default: true para aridade 2..4. */
  destravavel?: boolean;
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
  cascata?: RegraCascata;
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
  marcial: {
    id: 'marcial',
    nome: 'Marcial',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.7, 0.1, 0, 0.2, 0),
    descricao: 'A arte das armas: maestria, técnica e armas evocadas.',
  },
  gravidade: {
    id: 'gravidade',
    nome: 'Gravidade',
    tipo: 'base',
    fatorPotencia: 1.0,
    pesos: pesos(0.5, 0.4, 0, 0.1, 0),
    descricao: 'A força que puxa e esmaga: peso, atração e colapso.',
  },
};

interface OpcoesDerivado {
  fator?: number;
  minimo?: number;
  tipo?: 'derivado' | 'especial';
  cascata?: RegraCascata;
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
  // Especiais têm receita AMPLA (5/4/17 componentes) sem sub-combinações de
  // aridade N−1 no espaço enumerado: a cascata deles vem declarada — pais são
  // as próprias bases, divisor alto, nunca destraváveis para ponto direto.
  const cascata =
    opts.cascata ??
    (opts.tipo === 'especial'
      ? { pais: [...componentes], divisor: DIVISOR_CASCATA_ESPECIAL, destravavel: false }
      : undefined);
  return {
    id,
    nome,
    tipo: opts.tipo ?? 'derivado',
    fatorPotencia: fator,
    pesos: media,
    descricao,
    receita: componentes.map((elemento) => ({ elemento, nivelMinimo: minimo })),
    ...(cascata ? { cascata } : {}),
  };
}

/**
 * A matriz completa: TODOS os 136 pares dos 17 elementos base, seguidos das
 * triplas curadas historicamente, das amplas (primordial, ciclo) e do nulo.
 */
const DERIVADOS_LISTA: ElementoDef[] = [
  // ---- fogo + X ----
  derivado('vapor', 'Vapor', ['agua', 'fogo'], 'Névoa escaldante: queima, oculta e sufoca em área.', { fator: 1.2 }),
  derivado('lava', 'Lava', ['fogo', 'terra'], 'Fogo que adere: impacto pesado + queimadura persistente.'),
  derivado('incendio', 'Incêndio', ['ar', 'fogo'], 'Fogo alimentado pelo vento: espalha-se sozinho de alvo em alvo.'),
  derivado('plasma', 'Plasma', ['eletricidade', 'fogo'], 'Matéria ionizada: o dano mais cru do sistema, difícil de resistir.'),
  derivado('fogo_feiticeiro', 'Fogo Feiticeiro', ['arcano', 'fogo'], 'Chama programável: explosões com atraso, formas e gatilhos.'),
  derivado('fogo_negro', 'Fogo Negro', ['fogo', 'sombra'], 'Chama que não ilumina: queima e drena ao mesmo tempo.'),
  derivado('chama_solar', 'Chama Solar', ['fogo', 'luz'], 'Fogo purificador: dano que também abençoa aliados próximos.'),
  derivado('fogo_infernal', 'Fogo Infernal', ['fogo', 'vileza'], 'A fornalha dos pactos: queima a carne e a vontade.'),
  derivado('chama_azul', 'Chama Azul', ['fogo', 'morte'], 'Fogo que queima a alma; ignora parte da defesa.', { fator: 1.2, minimo: 12 }),
  derivado('fenix', 'Fênix', ['fogo', 'vida'], 'Fogo que renasce: dano que retorna como cura.'),
  derivado('fervor', 'Fervor', ['fogo', 'marcial', 'vida'], 'Sangue fervente: golpes físicos incendiários.'),

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
  derivado('correnteza', 'Correnteza', ['agua', 'marcial', 'vida'], 'Fluidez marcial: golpes encadeados sem pausa.'),

  // ---- terra + X ----
  derivado('areia', 'Areia', ['ar', 'terra'], 'Tempestade de areia: cega, corrói e desloca.'),
  derivado('magnetismo', 'Magnetismo', ['eletricidade', 'terra'], 'Atração e repulsão: desarma, puxa e prende metais.'),
  derivado('cristal', 'Cristal', ['arcano', 'terra'], 'Terra lapidada pelo arcano: barreiras e foco amplificador.'),
  derivado('obsidiana', 'Obsidiana', ['sombra', 'terra'], 'Vidro vulcânico: lâminas defensivas que cortam quem ataca.'),
  derivado('ouro_vivo', 'Ouro Vivo', ['luz', 'terra'], 'Metal sagrado: armaduras e armas conjuradas brilhantes.'),
  derivado('solo_profano', 'Solo Profano', ['terra', 'vileza'], 'Chão corrompido: território que enfraquece quem pisa.'),
  derivado('ossuario', 'Ossuário', ['morte', 'terra'], 'Os ossos da terra: muralhas e lanças de osso.'),
  derivado('flora', 'Flora', ['terra', 'vida'], 'Natureza desperta: vinhas, raízes e crescimento selvagem.'),
  derivado('tita', 'Titã', ['marcial', 'terra', 'vida'], 'Corpo de pedra: força colossal e pele impenetrável.'),

  // ---- ar + X ----
  derivado('tempestade', 'Tempestade', ['ar', 'eletricidade'], 'Céu em fúria: área enorme e relâmpagos encadeados.'),
  derivado('eter', 'Éter', ['ar', 'arcano'], 'O vento entre os mundos: teleporte curto e levitação.'),
  derivado('murmurio', 'Murmúrio', ['ar', 'sombra'], 'Vozes no vento: medo, confusão e sussurros que distraem.'),
  derivado('aurora', 'Aurora', ['ar', 'luz'], 'Véu celeste: proteção em área e clareza mental.'),
  derivado('enxofre', 'Enxofre', ['ar', 'vileza'], 'Fumaça infernal: nuvens tóxicas que corrompem o fôlego.'),
  derivado('miasma', 'Miasma', ['ar', 'morte'], 'Ar pútrido: praga aerotransportada de longo alcance.'),

  // ---- eletricidade + X ----
  derivado('fluxo', 'Fluxo', ['arcano', 'eletricidade'], 'Corrente de mana: sobrecarrega magias e dispositivos.'),
  derivado('trovao_negro', 'Trovão Negro', ['eletricidade', 'sombra'], 'Relâmpago silencioso: atinge sem aviso e sem som.'),
  derivado('fulgor', 'Fulgor', ['eletricidade', 'luz'], 'Clarão ofuscante: cega em área e pune quem ataca.'),
  derivado('tormento', 'Tormento', ['eletricidade', 'vileza'], 'Choque cruel: dor que interrompe e desespera.'),
  derivado('galvanismo', 'Galvanismo', ['eletricidade', 'morte'], 'A centelha que reanima: constructos de carne e raio.'),
  derivado('sinapse', 'Sinapse', ['eletricidade', 'vida'], 'Sistema nervoso: acelera aliados e trava reflexos inimigos.'),
  derivado('reflexo', 'Reflexo', ['eletricidade', 'marcial', 'vida'], 'Nervos elétricos: contra-ataques instantâneos.'),

  // ---- arcano + X ----
  derivado('ocultismo', 'Ocultismo', ['arcano', 'sombra'], 'Saber proibido: magias que o alvo não vê chegar.'),
  derivado('runa', 'Runa', ['arcano', 'luz'], 'Palavra gravada: efeitos persistentes ancorados no chão ou em aliados.'),
  derivado('pacto', 'Pacto', ['arcano', 'vileza'], 'Contrato de poder: sacrifica recurso por efeito ampliado.'),
  derivado('alma', 'Alma', ['arcano', 'morte'], 'A moeda dos mortos: manipula espíritos e essências.'),
  derivado('essencia', 'Essência', ['arcano', 'vida'], 'A matéria-prima da vida: transmutação e restauração profunda.'),
  derivado('encantamento', 'Encantamento', ['arcano', 'marcial', 'vida'], 'Corpo como foco: armas e punhos imbuídos de magia.'),

  // ---- sombra + X ----
  derivado('crepusculo', 'Crepúsculo', ['luz', 'sombra'], 'A fronteira: revela e oculta ao mesmo tempo.', { fator: 1.25, minimo: 15 }),
  derivado('terror', 'Terror', ['sombra', 'vileza'], 'Medo encarnado: inimigos fogem ou congelam.'),
  derivado('espectro', 'Espectro', ['morte', 'sombra'], 'Forma incorpórea: atravessa paredes e ignora armadura.'),
  derivado('parasita', 'Parasita', ['sombra', 'vida'], 'Vida roubada: drena o inimigo para curar você.'),
  derivado('assassinio', 'Assassínio', ['marcial', 'sombra', 'vida'], 'A arte do golpe único: dano massivo pelas costas.'),

  // ---- luz + X ----
  derivado('heresia', 'Heresia', ['luz', 'vileza'], 'Luz falsa: ilusões sagradas e milagres corrompidos.'),
  derivado('julgamento', 'Julgamento', ['luz', 'morte'], 'O veredito final: executa alvos enfraquecidos.'),
  derivado('santidade', 'Santidade', ['luz', 'vida'], 'Graça plena: a cura mais pura do sistema.'),
  derivado('bravura', 'Bravura', ['luz', 'marcial', 'vida'], 'Coragem radiante: aura que fortalece a linha de frente.'),

  // ---- vileza + X ----
  derivado('praga', 'Praga', ['morte', 'vileza'], 'Corrupção contagiosa: veneno e maldição se espalham.', { fator: 1.2, minimo: 12 }),
  derivado('mutacao', 'Mutação', ['vida', 'vileza'], 'Carne moldável: transforma o próprio corpo em arma.'),
  derivado('carnificina', 'Carnificina', ['marcial', 'vida', 'vileza'], 'Sede de sangue: quanto mais fere, mais forte fica.'),

  // ---- morte + X ----
  derivado('equilibrio', 'Equilíbrio', ['morte', 'vida'], 'Vida e morte na mesma mão: converte dano em cura e cura em dano.', { fator: 1.25, minimo: 15 }),
  derivado('ceifa', 'Ceifa', ['marcial', 'morte', 'vida'], 'A foice encarnada: golpes físicos que colhem almas.'),

  // ---- vida + X ----

  // ---- marcial + X ----
  derivado('forja', 'Forja', ['fogo', 'marcial'], 'Armas nascidas do fogo: lâminas incandescentes e martelos de brasa.'),
  derivado('tempera', 'Têmpera', ['agua', 'marcial'], 'O fio perfeito: lâminas temperadas que nunca perdem o corte.'),
  derivado('aco', 'Aço', ['marcial', 'terra'], 'Metal da terra: armas pesadas e armaduras vivas.'),
  derivado('esgrima', 'Esgrima', ['ar', 'marcial'], 'A dança da lâmina leve: estocadas rápidas como o vento.'),
  derivado('aco_voltaico', 'Aço Voltaico', ['eletricidade', 'marcial'], 'Armas condutoras: cada golpe descarrega um relâmpago.'),
  derivado('arsenal', 'Arsenal', ['arcano', 'marcial'], 'Armas conjuradas do nada: um arsenal etéreo ao seu dispor.'),
  derivado('lamina_oculta', 'Lâmina Oculta', ['marcial', 'sombra'], 'A arma que ninguém vê: golpes das sombras.'),
  derivado('lamina_radiante', 'Lâmina Radiante', ['luz', 'marcial'], 'A espada-voto: arde contra o profano e protege o portador.'),
  derivado('serrilha', 'Serrilha', ['marcial', 'vileza'], 'Armas cruéis: feridas que não fecham.'),
  derivado('fio_funebre', 'Fio Fúnebre', ['marcial', 'morte'], 'A lâmina que colhe: cada abate fortalece o próximo golpe.'),

  // ---- tempo + X (o 14º elemento base fecha a matriz) ----
  derivado('pira_eterna', 'Pira Eterna', ['arcano', 'fogo', 'gravidade'], 'Fogo que arde desde sempre: queima acelerada que nunca se apaga.'),
  derivado('erosao', 'Erosão', ['agua', 'arcano', 'gravidade'], 'A água que desgasta a montanha: dano que cresce com o tempo.'),
  derivado('fossil', 'Fossilização', ['arcano', 'gravidade', 'terra'], 'O peso das eras: petrifica e imobiliza lentamente.'),
  derivado('instante', 'Instante', ['arcano', 'eletricidade', 'gravidade'], 'O relâmpago fora do tempo: golpe que acontece antes de ser visto.'),
  derivado('ruina', 'Ruína', ['arcano', 'gravidade', 'vileza'], 'A maldição da idade: corrói corpo e vontade lentamente.'),
  derivado('florescer', 'Florescer', ['arcano', 'gravidade', 'vida'], 'O tempo a favor da vida: crescimento e rejuvenescimento acelerados.'),
  derivado('frenesi', 'Frenesi', ['arcano', 'gravidade', 'marcial', 'vida'], 'O corpo além do limite: cada segundo vale por dois.'),
  derivado('contratempo', 'Contratempo', ['arcano', 'gravidade', 'marcial'], 'A lâmina no tempo certo: contragolpes e cortes preemptivos.'),

  // ---- som + X ----
  derivado('estrondo', 'Estrondo', ['ar', 'fogo', 'vida'], 'Explosão sonora: o estouro que ensurdece e queima.'),
  derivado('terremoto', 'Terremoto', ['ar', 'terra', 'vida'], 'Ondas sísmicas: o chão treme e rasga em área.'),
  derivado('trovao', 'Trovão', ['ar', 'eletricidade', 'vida'], 'O estouro do raio: choque e onda de choque juntos.'),
  derivado('cantico', 'Cântico', ['ar', 'arcano', 'vida'], 'Palavra cantada de poder: encantamentos que ecoam.'),
  derivado('sussurro', 'Sussurro', ['ar', 'sombra', 'vida'], 'Vozes que enlouquecem: medo sussurrado ao ouvido.'),
  derivado('harmonia', 'Harmonia', ['ar', 'luz', 'vida'], 'Acorde perfeito: cura e conforto que restauram a alma.'),
  derivado('dissonancia', 'Dissonância', ['ar', 'vida', 'vileza'], 'Acorde quebrado: dor que corrói a mente.'),
  derivado('requiem', 'Réquiem', ['ar', 'morte', 'vida'], 'A canção fúnebre: paralisa os vivos e comanda os mortos.'),
  derivado('cadencia', 'Cadência', ['ar', 'marcial', 'vida'], 'Ritmo de batalha: golpes no compasso perfeito.'),
  derivado('eco', 'Eco', ['ar', 'arcano', 'gravidade', 'vida'], 'O som que volta do passado: repete efeitos com atraso.'),

  // ---- gravidade + X ----
  derivado('fornalha_estelar', 'Fornalha Estelar', ['fogo', 'gravidade'], 'O coração de uma estrela: fusão que consome tudo por perto.'),
  derivado('voragem', 'Voragem', ['agua', 'gravidade'], 'Redemoinho colossal: engole e afoga em espiral.'),
  derivado('colapso', 'Colapso', ['gravidade', 'terra'], 'Desabamento: o terreno afunda sobre os inimigos.'),
  derivado('magnetar', 'Magnetar', ['eletricidade', 'gravidade'], 'Campo magnético estelar: prende, atrai e eletrocuta.'),
  derivado('buraco_negro', 'Buraco Negro', ['gravidade', 'sombra'], 'Nem a luz escapa: engole tudo num ponto de trevas.', { fator: 1.25, minimo: 12 }),
  derivado('halo_gravitacional', 'Halo Gravitacional', ['gravidade', 'luz'], 'Lente de luz curvada: cega e revela ao mesmo tempo.'),
  derivado('jugo', 'Jugo', ['gravidade', 'vileza'], 'O peso da opressão: prende o alvo esmagado ao solo.'),
  derivado('implosao', 'Implosão', ['gravidade', 'morte'], 'Colapso interno: comprime o alvo até o fim.'),
  derivado('ancora_vital', 'Âncora Vital', ['gravidade', 'vida'], 'Massa que fixa a alma: impede que os aliados caiam.'),
  derivado('ariete', 'Aríete', ['gravidade', 'marcial'], 'A arma que pesa mundos: impacto que atravessa muralhas.'),

  // ---- espaço + X ----
  derivado('cometa', 'Cometa', ['agua', 'ar', 'gravidade'], 'Bola de gelo sideral: risca o céu e congela ao cair.'),
  derivado('asteroide', 'Asteroide', ['ar', 'gravidade', 'terra'], 'Fragmento de mundo: bombardeio de rocha do espaço.'),
  derivado('pulsar', 'Pulsar', ['ar', 'eletricidade', 'gravidade'], 'Farol estelar: pulsos de energia em intervalos precisos.'),
  derivado('constelacao', 'Constelação', ['ar', 'gravidade', 'luz'], 'Mapa de estrelas: guia, abençoa e marca alvos.'),
  derivado('devorador', 'Devorador', ['ar', 'gravidade', 'vileza'], 'O que vem de além: horror cósmico que não deveria existir.'),
  derivado('nebulosa', 'Nebulosa', ['ar', 'gravidade', 'morte'], 'Berço e túmulo de estrelas: névoa que mata e cria.'),
  derivado('semente_estelar', 'Semente Estelar', ['ar', 'gravidade', 'vida'], 'Vida vinda do cosmos: brota onde nada deveria crescer.'),
  derivado('gigante_estelar', 'Gigante Estelar', ['ar', 'gravidade', 'marcial', 'vida'], 'Corpo de proporções cósmicas: força além da escala.'),
  derivado('lamina_sideral', 'Lâmina Sideral', ['ar', 'gravidade', 'marcial'], 'Corte que atravessa a distância: fende o próprio espaço.'),
  derivado('continuum', 'Continuum', ['ar', 'arcano', 'gravidade'], 'Espaço-tempo dominado: mover-se por onde e quando quiser.', { fator: 1.3, minimo: 12 }),

  // ---- os quatro que saíram da base e voltaram como par de 2ª geração ----
  //
  // Não foram apagados: foram REBAIXADOS. Cada um continua existindo, com
  // nível efetivo e arquétipos próprios — só deixou de aceitar ponto direto.
  // As identidades que ocupavam estas quatro casas eram, uma a uma, sinônimos
  // do elemento que as engoliu (Maestria e Vitalidade eram Vigor; Cronomancia
  // e Dilatação eram Tempo; Vácuo e Dobra eram Espaço; Alento e Melodia eram
  // Som), então a fusão não perdeu fantasia — juntou nomes que diziam a mesma
  // coisa por caminhos diferentes.
  derivado('vigor', 'Vigor', ['vida', 'marcial'], 'O corpo treinado: força, fôlego e a resistência que sustenta o combate físico.'),
  derivado('tempo', 'Tempo', ['gravidade', 'arcano'], 'A corrente do tempo: pressa, lentidão, decadência e reversão.'),
  derivado('espaco', 'Espaço', ['gravidade', 'ar'], 'A distância entre os pontos: portais, teleporte e o vazio entre as estrelas.'),
  derivado('som', 'Som', ['ar', 'vida'], 'Vibração e ressonância: a voz, o brado, a canção e a onda de choque.'),

  // ---- triplas ----
  derivado('chama_demoniaca', 'Chama Demoníaca', ['fogo', 'morte', 'vileza'], 'Fogo alimentado por pacto e morte: queima corpo, alma e contrato.'),
  derivado('paradoxo', 'Paradoxo', ['arcano', 'gravidade', 'morte'], 'Vida e morte fora de ordem: desfaz causas e efeitos.'),
  derivado('big_bang', 'Big Bang', ['gravidade', 'arcano', 'fogo', 'luz'], 'O início e o fim de tudo: a criação comprimida num instante.', { fator: 1.35, minimo: 15 }),
  derivado('furacao', 'Furacão', ['agua', 'ar', 'eletricidade'], 'A tempestade perfeita: área devastadora que se move sozinha.'),
  derivado('selva', 'Selva', ['agua', 'terra', 'vida'], 'Ecossistema vivo: terreno inteiro que luta por você.'),
  derivado('abominacao', 'Abominação', ['morte', 'sombra', 'vileza'], 'O horror completo: criaturas que não deveriam existir.'),
  derivado('eclipse', 'Eclipse', ['arcano', 'luz', 'sombra'], 'O instante em que os opostos se alinham: anula magias alheias.'),
  derivado('reencarnacao', 'Reencarnação', ['arcano', 'morte', 'vida'], 'O ciclo dominado: retorno da morte e segunda chance.'),
  derivado('sobrecarga', 'Sobrecarga', ['arcano', 'eletricidade', 'marcial', 'vida'], 'Corpo-condutor: velocidade e poder além do limite seguro.'),
  derivado('nucleo', 'Núcleo', ['eletricidade', 'fogo', 'terra'], 'O coração do mundo: erupções magnéticas e magma pressurizado.'),
  derivado('avatar_de_guerra', 'Avatar de Guerra', ['marcial', 'vida', 'arcano', 'fogo'], 'A guerra encarnada: cem armas orbitando um corpo perfeito.'),

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
    ['fogo', 'agua', 'terra', 'ar', 'eletricidade', 'arcano', 'sombra', 'luz', 'vileza', 'morte', 'vida', 'marcial', 'gravidade'],
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

/**
 * LAÇO DE SINERGIA — a relação, não a seta.
 *
 * Sinergia é de MÃO DUPLA por definição do jogo: se investir em Fogo fortalece
 * a Vida, investir em Vida fortalece o Fogo. Declarar as duas direções à mão
 * deixava metade delas se perder numa refatoração — foi o que aconteceu quando
 * a base caiu de 17 para 13 e sobraram setas apontando para elementos que
 * tinham virado derivados. Aqui a volta é gerada, não escrita: **não existe
 * como declarar uma sinergia de mão única por descuido**.
 *
 * As duas taxas são diferentes de propósito, porque os lados têm cardinalidade
 * diferente. No laço Vida ↔ os quatro clássicos:
 *
 *   ida  0.20 → 5 de Vida rendem 1 ponto em CADA um dos quatro;
 *   volta 0.25 → 1 ponto em CADA um dos quatro rende 1 de Vida.
 *
 * A conta da volta só fecha porque o transbordo SOMA antes de arredondar
 * (ver `calcularProgressao`): quatro contribuições de 0.25 viram 1, enquanto
 * arredondar cada uma isolada daria zero.
 */
export interface LacoSinergia {
  a: ElementoBaseId;
  b: ElementoBaseId[];
  /** Quanto 1 ponto em `a` rende em CADA elemento de `b`. */
  ida: number;
  /** Quanto 1 ponto em CADA elemento de `b` rende em `a`. */
  volta: number;
  /** Por que estes elementos se alimentam. */
  motivo: string;
}

/** Os quatro clássicos. Eletricidade é primal mas não entra no laço da Vida. */
const CLASSICOS: ElementoBaseId[] = ['fogo', 'agua', 'terra', 'ar'];

export const LACOS_SINERGIA: LacoSinergia[] = [
  // --- o laço da Vida, a regra do dono do projeto ---
  {
    a: 'vida',
    b: CLASSICOS,
    ida: 0.2,
    volta: 0.25,
    motivo: 'O corpo é feito dos quatro; e o que vive alimenta os quatro de volta.',
  },
  { a: 'vida', b: ['luz'], ida: 0.12, volta: 0.12, motivo: 'Cura sagrada é o encontro das duas.' },
  {
    a: 'vida',
    b: ['marcial'],
    ida: 0.12,
    volta: 0.12,
    motivo: 'O corpo treinado é o par das duas — absorveu o antigo Vigor.',
  },

  // --- os quatro clássicos entre si e com o que os cerca ---
  { a: 'fogo', b: ['vileza'], ida: 0.14, volta: 0.14, motivo: 'A fornalha dos pactos queima a carne e a vontade.' },
  { a: 'fogo', b: ['marcial'], ida: 0.12, volta: 0.12, motivo: 'A forja: o metal só cede ao calor.' },
  { a: 'agua', b: ['morte'], ida: 0.14, volta: 0.14, motivo: 'O afogamento e a toxina: a água paciente corrói.' },
  { a: 'agua', b: ['ar'], ida: 0.12, volta: 0.12, motivo: 'Névoa e gelo nascem do encontro dos dois.' },
  { a: 'terra', b: ['marcial'], ida: 0.14, volta: 0.14, motivo: 'O minério vira lâmina; a lâmina volta ao minério.' },
  { a: 'terra', b: ['gravidade'], ida: 0.14, volta: 0.14, motivo: 'Matéria e peso são a mesma pergunta vista de dois lados.' },
  { a: 'ar', b: ['eletricidade'], ida: 0.16, volta: 0.16, motivo: 'A descarga precisa do meio, e o vento carrega a carga.' },
  { a: 'ar', b: ['luz'], ida: 0.12, volta: 0.12, motivo: 'A aurora: a luz só se vê porque o ar a espalha.' },

  // --- o eixo escuro ---
  { a: 'sombra', b: ['morte'], ida: 0.16, volta: 0.16, motivo: 'O que se esconde e o que termina caminham juntos.' },
  { a: 'sombra', b: ['vileza'], ida: 0.14, volta: 0.14, motivo: 'A corrupção precisa do escuro para crescer.' },
  { a: 'sombra', b: ['gravidade'], ida: 0.12, volta: 0.12, motivo: 'Nem a luz escapa do que é denso demais.' },
  { a: 'morte', b: ['vileza'], ida: 0.14, volta: 0.14, motivo: 'A putrefação é o encontro das duas.' },

  // --- o eixo luminoso ---
  { a: 'luz', b: ['eletricidade'], ida: 0.12, volta: 0.12, motivo: 'O fulgor: o raio é luz que se ouve.' },
  { a: 'eletricidade', b: ['terra'], ida: 0.12, volta: 0.12, motivo: 'Magnetismo: a carga procura o solo.' },

  // --- a trama ---
  { a: 'gravidade', b: ['arcano'], ida: 0.16, volta: 0.16, motivo: 'Tempo e Espaço são pares dos dois: a trama responde à magia pura.' },
  { a: 'gravidade', b: ['morte'], ida: 0.12, volta: 0.12, motivo: 'O que cai fundo o bastante não volta.' },
  {
    a: 'arcano',
    b: ['fogo', 'agua', 'terra', 'eletricidade', 'sombra', 'luz'],
    ida: 0.05,
    volta: 0.05,
    motivo: 'Magia pura alimenta de leve tudo que não é físico — e é alimentada de volta.',
  },
  { a: 'arcano', b: ['marcial'], ida: 0.08, volta: 0.08, motivo: 'A lâmina encantada exige as duas mãos.' },
];

/**
 * As setas, geradas dos laços. É isto que o motor lê; ninguém escreve à mão.
 */
export const SINERGIAS: Sinergia[] = LACOS_SINERGIA.flatMap((l) => [
  { de: l.a, para: [...l.b], razao: l.ida },
  ...l.b.map((alvo) => ({ de: alvo, para: [l.a], razao: l.volta })),
]);
