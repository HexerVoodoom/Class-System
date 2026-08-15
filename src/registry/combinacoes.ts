/**
 * Motor de COMBINAÇÕES N-ÁRIAS — o espaço completo de triplas e quádruplas.
 *
 * Os 136 pares dos 17 elementos base são todos curados à mão em
 * `elementos.ts`. A partir de 3 componentes o espaço explode:
 *
 *   C(17,3) =   680 triplas
 *   C(17,4) = 2.380 quádruplas
 *
 * Curar 3.060 entradas à mão é inviável e desnecessário. A estratégia é
 * HÍBRIDA:
 *
 *  1. **Curadas** — combinações com identidade forte ganham nome, descrição e
 *     eventualmente arquétipo à mão (em `elementos.ts` ou em `CURADAS` aqui).
 *  2. **Procedurais** — todas as outras existem e são alcançáveis; nome,
 *     descrição, perfil e números são DERIVADOS das partes, sob demanda.
 *
 * A nomenclatura procedural é composicional e ensina a linhagem:
 *
 *   tripla   {a,b,c}   → "{Par(a,b)} {adjetivo(c)}"        → Lava Umbria
 *   quádrupla {a,b,c,d} → "{Par(a,b)} d{o|a} {Par(c,d)}"   → Lava do Espectro
 *
 * Como os pares já são únicos e a ordenação dos componentes é determinística,
 * os nomes gerados são provadamente únicos e estáveis entre execuções.
 *
 * COERÊNCIA — nem toda convergência custa o mesmo. Para cada par de
 * componentes olhamos as sinergias (aliados) e a tabela de afinidade
 * (opostos):
 *
 *   harmonia  → componentes que já se alimentam: barato, potência modesta.
 *   tensão    → componentes que se negam: caro de sustentar, potência maior.
 *   paradoxo  → maioria de opostos: o extremo dos dois eixos.
 *
 * Resolução é PREGUIÇOSA e cacheada: enumerar 3.060 chaves numéricas é
 * barato, materializar 3.060 objetos com nome e descrição não é.
 */

import {
  ELEMENTOS,
  SINERGIAS,
  elementosBase,
  type ElementoBaseId,
  type ElementoDef,
  type ElementoId,
  type PerfilPesos,
} from './elementos';
import {
  AFINIDADES,
  MULT_NEUTRO,
  MULT_FORTE,
  MULT_FRACO,
  baseDominanteDoDef,
} from './afinidades';

export const ARIDADE_MAXIMA = 4;

export type Coerencia = 'harmonia' | 'neutra' | 'tensao' | 'paradoxo';

/** Metadados leves de uma combinação — o que é enumerado eagerly. */
export interface CombinacaoInfo {
  id: ElementoId;
  componentes: ElementoBaseId[];
  aridade: number;
  /** Fração de pares de componentes em oposição (0..1). */
  tensao: number;
  /** Fração de pares de componentes aliados (0..1). */
  harmonia: number;
  coerencia: Coerencia;
  fatorPotencia: number;
  nivelMinimo: number;
  /** true quando a combinação tem nome/descrição escritos à mão. */
  curada: boolean;
}

// ---------------------------------------------------------------------------
// Constantes de balanceamento das combinações (ajuste fino num lugar só)
// ---------------------------------------------------------------------------

/** Fator de potência base por aridade, antes da modulação por coerência. */
export const FATOR_BASE_ARIDADE: Record<number, number> = { 2: 1.15, 3: 1.32, 4: 1.52 };
/** Nível mínimo exigido de cada componente, antes da modulação. */
export const MINIMO_BASE_ARIDADE: Record<number, number> = { 2: 10, 3: 14, 4: 18 };
/** Quanto a tensão total soma ao fator de potência. */
const FATOR_POR_TENSAO = 0.1;
/** Quanto a harmonia total desconta do fator de potência. */
const FATOR_POR_HARMONIA = 0.03;
/** Quanto a tensão encarece o nível mínimo (em níveis). */
const MINIMO_POR_TENSAO = 4;
/** Quanto a harmonia barateia o nível mínimo (em níveis). */
const MINIMO_POR_HARMONIA = 2;
/** Acima desta fração de pares opostos, a combinação vira paradoxo. */
const LIMIAR_PARADOXO = 0.5;
const LIMIAR_TENSAO = 0.25;
const LIMIAR_HARMONIA = 0.5;

// ---------------------------------------------------------------------------
// Léxico de nomenclatura procedural
// ---------------------------------------------------------------------------

interface LexicoElemento {
  /** Adjetivo nas duas concordâncias — o português exige. */
  adjetivo: { m: string; f: string };
  /** Substantivo abstrato usado em epítetos e descrições. */
  dominio: string;
  genero: 'm' | 'f';
}

export const LEXICO: Record<ElementoBaseId, LexicoElemento> = {
  fogo: { adjetivo: { m: 'Ígneo', f: 'Ígnea' }, dominio: 'Fornalha', genero: 'm' },
  agua: { adjetivo: { m: 'Aquático', f: 'Aquática' }, dominio: 'Correnteza', genero: 'f' },
  terra: { adjetivo: { m: 'Telúrico', f: 'Telúrica' }, dominio: 'Solo', genero: 'f' },
  ar: { adjetivo: { m: 'Etéreo', f: 'Etérea' }, dominio: 'Ventania', genero: 'm' },
  eletricidade: { adjetivo: { m: 'Voltaico', f: 'Voltaica' }, dominio: 'Corrente', genero: 'f' },
  arcano: { adjetivo: { m: 'Arcano', f: 'Arcana' }, dominio: 'Segredo', genero: 'm' },
  sombra: { adjetivo: { m: 'Umbrio', f: 'Umbria' }, dominio: 'Penumbra', genero: 'f' },
  luz: { adjetivo: { m: 'Radiante', f: 'Radiante' }, dominio: 'Aurora', genero: 'f' },
  vileza: { adjetivo: { m: 'Profano', f: 'Profana' }, dominio: 'Pacto', genero: 'f' },
  morte: { adjetivo: { m: 'Fúnebre', f: 'Fúnebre' }, dominio: 'Sepulcro', genero: 'f' },
  vida: { adjetivo: { m: 'Vivaz', f: 'Vivaz' }, dominio: 'Seiva', genero: 'f' },
  vigor: { adjetivo: { m: 'Bruto', f: 'Bruta' }, dominio: 'Ímpeto', genero: 'm' },
  marcial: { adjetivo: { m: 'Marcial', f: 'Marcial' }, dominio: 'Arte da Lâmina', genero: 'm' },
  tempo: { adjetivo: { m: 'Eterno', f: 'Eterna' }, dominio: 'Era', genero: 'm' },
  som: { adjetivo: { m: 'Sonoro', f: 'Sonora' }, dominio: 'Eco', genero: 'm' },
  gravidade: { adjetivo: { m: 'Denso', f: 'Densa' }, dominio: 'Peso', genero: 'f' },
  espaco: { adjetivo: { m: 'Sideral', f: 'Sideral' }, dominio: 'Vazio', genero: 'm' },
};

/**
 * Gênero de nomes derivados. A heurística lê a PALAVRA-CABEÇA (a primeira),
 * que é como o português constrói sintagmas nominais: "Chama Azul" é
 * feminino por causa de "Chama", não de "Azul".
 */
const GENERO_EXCECOES: Record<string, 'm' | 'f'> = {
  // gregos em -ma são masculinos apesar da terminação
  Miasma: 'm', Plasma: 'm', Prisma: 'm', Enigma: 'm', Carisma: 'm', Dogma: 'm',
  // outros que a terminação engana
  Parasita: 'm', Cometa: 'm', Titã: 'm', Fênix: 'f', Maré: 'f', Nascente: 'f',
  Tempestade: 'f', Aljava: 'f', Ponte: 'f', Fonte: 'f', Corrente: 'f', Serpente: 'f',
};

export function generoDoNome(nome: string): 'm' | 'f' {
  const cabeca = nome.split(/[\s-]/)[0];
  const excecao = GENERO_EXCECOES[cabeca];
  if (excecao) return excecao;
  // -ção e -são são femininos; outros -ão (trovão, furacão) são masculinos
  if (/(ção|são)$/i.test(cabeca)) return 'f';
  if (/(dade|gem|ice|ência|ância|eza|ura)$/i.test(cabeca)) return 'f';
  if (/[aã]$/i.test(cabeca)) return 'f';
  return 'm';
}

/** "do" / "da", concordando com o gênero do nome que vem depois. */
function preposicao(nome: string): string {
  return generoDoNome(nome) === 'f' ? 'da' : 'do';
}

// ---------------------------------------------------------------------------
// Índice de pares e de combinações curadas já existentes
// ---------------------------------------------------------------------------

const BASES: ElementoBaseId[] = elementosBase().map((e) => e.id as ElementoBaseId);
/** Ordem canônica dos elementos base — define a ordenação dos componentes. */
const ORDEM = new Map<ElementoBaseId, number>(BASES.map((id, i) => [id, i]));

export function ordenarComponentes(comps: ElementoBaseId[]): ElementoBaseId[] {
  return [...comps].sort((a, b) => (ORDEM.get(a) ?? 99) - (ORDEM.get(b) ?? 99));
}

export function chaveCombinacao(comps: ElementoBaseId[]): string {
  return ordenarComponentes(comps).join('+');
}

/** chave de receita → id do elemento já registrado à mão (qualquer aridade). */
const INDICE_CURADAS = new Map<string, ElementoId>();
for (const def of Object.values(ELEMENTOS)) {
  if (!def.receita) continue;
  INDICE_CURADAS.set(
    chaveCombinacao(def.receita.map((c) => c.elemento)),
    def.id,
  );
}

/** Nome do par (a,b) — todos os 136 existem em `elementos.ts`. */
function nomeDoPar(a: ElementoBaseId, b: ElementoBaseId): string | undefined {
  const id = INDICE_CURADAS.get(chaveCombinacao([a, b]));
  return id ? ELEMENTOS[id].nome : undefined;
}

// ---------------------------------------------------------------------------
// Coerência: harmonia × tensão entre os componentes
// ---------------------------------------------------------------------------

type Relacao = 'aliado' | 'oposto' | 'neutro';

function relacao(a: ElementoBaseId, b: ElementoBaseId): Relacao {
  const afA = AFINIDADES[a];
  const afB = AFINIDADES[b];
  const oposto =
    afA.forteContra.includes(b) ||
    afA.fracoContra.includes(b) ||
    afB.forteContra.includes(a) ||
    afB.fracoContra.includes(a);
  if (oposto) return 'oposto';
  const aliado =
    SINERGIAS.some((s) => s.de === a && s.para.includes(b)) ||
    SINERGIAS.some((s) => s.de === b && s.para.includes(a));
  return aliado ? 'aliado' : 'neutro';
}

export interface Coesao {
  tensao: number;
  harmonia: number;
  coerencia: Coerencia;
}

export function coesaoDe(comps: ElementoBaseId[]): Coesao {
  let opostos = 0;
  let aliados = 0;
  let total = 0;
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      total++;
      const r = relacao(comps[i], comps[j]);
      if (r === 'oposto') opostos++;
      else if (r === 'aliado') aliados++;
    }
  }
  const tensao = total ? opostos / total : 0;
  const harmonia = total ? aliados / total : 0;
  let coerencia: Coerencia = 'neutra';
  if (tensao >= LIMIAR_PARADOXO) coerencia = 'paradoxo';
  else if (tensao >= LIMIAR_TENSAO) coerencia = 'tensao';
  else if (harmonia >= LIMIAR_HARMONIA) coerencia = 'harmonia';
  return { tensao, harmonia, coerencia };
}

export const ROTULO_COERENCIA: Record<Coerencia, string> = {
  harmonia: 'Harmônica',
  neutra: 'Neutra',
  tensao: 'Em Tensão',
  paradoxo: 'Paradoxal',
};

export const DESCRICAO_COERENCIA: Record<Coerencia, string> = {
  harmonia: 'Os componentes já se alimentam: barata de sustentar, potência contida.',
  neutra: 'Componentes independentes: custo e potência medianos.',
  tensao: 'Forças que se negam parcialmente: exige mais de cada parte e paga melhor.',
  paradoxo: 'A maioria dos componentes se opõe: o extremo do custo e do poder.',
};

// ---------------------------------------------------------------------------
// Números derivados
// ---------------------------------------------------------------------------

export function fatorDeCombinacao(comps: ElementoBaseId[], coesao = coesaoDe(comps)): number {
  const base = FATOR_BASE_ARIDADE[comps.length] ?? 1 + 0.2 * (comps.length - 1);
  const f = base + FATOR_POR_TENSAO * coesao.tensao - FATOR_POR_HARMONIA * coesao.harmonia;
  return Math.round(f * 1000) / 1000;
}

export function minimoDeCombinacao(comps: ElementoBaseId[], coesao = coesaoDe(comps)): number {
  const base = MINIMO_BASE_ARIDADE[comps.length] ?? 10 + 4 * (comps.length - 2);
  return Math.max(
    1,
    Math.round(base + MINIMO_POR_TENSAO * coesao.tensao - MINIMO_POR_HARMONIA * coesao.harmonia),
  );
}

/** Perfil de uma combinação: média dos perfis dos componentes. */
export function perfilDeCombinacao(comps: ElementoBaseId[]): PerfilPesos {
  const media: PerfilPesos = { dano: 0, controle: 0, cura: 0, defesa: 0, suporte: 0 };
  for (const c of comps) {
    const p = ELEMENTOS[c].pesos;
    media.dano += p.dano / comps.length;
    media.controle += p.controle / comps.length;
    media.cura += p.cura / comps.length;
    media.defesa += p.defesa / comps.length;
    media.suporte += p.suporte / comps.length;
  }
  return media;
}

// ---------------------------------------------------------------------------
// Nomenclatura procedural
// ---------------------------------------------------------------------------

/**
 * Nome composicional. Tripla herda o nome do par dominante + o adjetivo do
 * terceiro; quádrupla une os dois pares. O resultado é único porque os pares
 * são únicos e a ordenação é determinística.
 */
export function nomeProcedural(comps: ElementoBaseId[]): string {
  const [a, b, c, d] = ordenarComponentes(comps);
  if (comps.length === 3) {
    const par = nomeDoPar(a, b) ?? `${ELEMENTOS[a].nome}-${ELEMENTOS[b].nome}`;
    const g = generoDoNome(par);
    return `${par} ${LEXICO[c].adjetivo[g]}`;
  }
  if (comps.length === 4) {
    const par1 = nomeDoPar(a, b) ?? `${ELEMENTOS[a].nome}-${ELEMENTOS[b].nome}`;
    const par2 = nomeDoPar(c, d) ?? `${ELEMENTOS[c].nome}-${ELEMENTOS[d].nome}`;
    return `${par1} ${preposicao(par2)} ${par2}`;
  }
  return ordenarComponentes(comps).map((x) => ELEMENTOS[x].nome).join('-');
}

const FRASE_PERFIL: Record<keyof PerfilPesos, string> = {
  dano: 'poder destrutivo',
  controle: 'domínio do campo',
  cura: 'restauração',
  defesa: 'proteção',
  suporte: 'amplificação',
};

export function descricaoProcedural(comps: ElementoBaseId[], coesao = coesaoDe(comps)): string {
  const perfil = perfilDeCombinacao(comps);
  const eixos = (Object.keys(perfil) as (keyof PerfilPesos)[])
    .filter((k) => perfil[k] > 0)
    .sort((x, y) => perfil[y] - perfil[x]);
  const nomes = ordenarComponentes(comps).map((c) => ELEMENTOS[c].nome);
  const lista = `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  const foco =
    eixos.length >= 2
      ? `${FRASE_PERFIL[eixos[0]]} com ${FRASE_PERFIL[eixos[1]]}`
      : eixos.length === 1
        ? FRASE_PERFIL[eixos[0]]
        : 'equilíbrio sem foco';
  const tom =
    coesao.coerencia === 'paradoxo'
      ? 'Um paradoxo estável'
      : coesao.coerencia === 'tensao'
        ? 'Uma corrente em tensão'
        : coesao.coerencia === 'harmonia'
          ? 'Uma corrente harmônica'
          : 'Uma convergência';
  return `${tom}: ${lista} numa só forma — ${foco}.`;
}

// ---------------------------------------------------------------------------
// Curadoria adicional de triplas e quádruplas
// ---------------------------------------------------------------------------

export interface CombinacaoCurada {
  id: string;
  nome: string;
  componentes: ElementoBaseId[];
  descricao: string;
  fator?: number;
  minimo?: number;
}

const c = (
  id: string,
  nome: string,
  componentes: ElementoBaseId[],
  descricao: string,
  opts: { fator?: number; minimo?: number } = {},
): CombinacaoCurada => ({ id, nome, componentes, descricao, ...opts });

/**
 * Combinações de 3 e 4 com identidade forte demais para serem procedurais.
 * Tudo que NÃO está aqui (nem em `elementos.ts`) continua existindo — só é
 * gerado sob demanda.
 */
export const CURADAS: CombinacaoCurada[] = [
  // ---------------- triplas: os primais e o clima ----------------
  c('vulcao', 'Vulcão', ['fogo', 'terra', 'ar'], 'A montanha que cospe fogo: erupção, cinza e céu escurecido.'),
  c('geiser', 'Gêiser', ['fogo', 'agua', 'terra'], 'Pressão subterrânea: jatos escaldantes que irrompem do chão.'),
  c('nevasca', 'Nevasca', ['agua', 'ar', 'terra'], 'Tempestade branca: congela, cega e enterra sob a neve.'),
  c('monsoes', 'Monção', ['agua', 'ar', 'vida'], 'A chuva que traz a estação: dilúvio que faz tudo brotar.'),
  c('deserto', 'Deserto', ['fogo', 'terra', 'tempo'], 'A paciência da areia: tudo que entra seca e vira pó.'),
  c('aurora_boreal', 'Aurora Boreal', ['ar', 'eletricidade', 'luz'], 'Cortina viva no céu: hipnotiza e recarrega quem olha.'),
  c('relampago_seco', 'Relâmpago Seco', ['fogo', 'ar', 'eletricidade'], 'A tempestade sem chuva: incendeia o que atinge.'),
  c('permafrost', 'Permafrost', ['agua', 'terra', 'tempo'], 'Gelo que nunca derreteu: prende o que toca em eras de imobilidade.'),

  // ---------------- triplas: o corpo e a lâmina ----------------
  c('gladiador', 'Gladiador', ['marcial', 'vigor', 'som'], 'A arena encarnada: cada golpe é aplaudido e ecoa mais forte.'),
  c('lamina_do_juizo', 'Lâmina do Juízo', ['marcial', 'luz', 'morte'], 'A espada que sentencia: corta o que já foi julgado culpado.'),
  c('duelista_temporal', 'Duelista Temporal', ['marcial', 'tempo', 'ar'], 'O golpe que chega antes: aparar, prever e ferir fora de ordem.'),
  c('punho_gravitico', 'Punho Gravítico', ['marcial', 'gravidade', 'vigor'], 'O soco que carrega um mundo: impacto que afunda o alvo no chão.'),
  c('cacador_de_almas', 'Caçador de Almas', ['marcial', 'morte', 'sombra'], 'A lâmina que não corta a carne: colhe direto o que anima o corpo.'),
  c('arauto', 'Arauto', ['marcial', 'som', 'luz'], 'Aquele que anuncia a batalha: o brado vale por um exército.'),

  // ---------------- triplas: as escolas do horror ----------------
  c('peste_negra', 'Peste Negra', ['morte', 'vileza', 'agua'], 'A epidemia perfeita: viaja pela água e não deixa sobrevivente.'),
  c('carniceiro', 'Carniceiro', ['vileza', 'vigor', 'morte'], 'Força sem freio: despedaça e se alimenta do que despedaçou.'),
  c('ossario_vivo', 'Ossário Vivo', ['terra', 'morte', 'vida'], 'O cemitério que respira: os ossos brotam e caminham de novo.'),
  c('coro_dos_afogados', 'Coro dos Afogados', ['agua', 'som', 'morte'], 'A canção que vem do fundo: quem escuta afunda junto.'),
  c('sabbat', 'Sabá', ['vileza', 'arcano', 'sombra'], 'O círculo proibido: rituais que a realidade não deveria permitir.'),

  // ---------------- triplas: a graça ----------------
  c('milagre', 'Milagre', ['luz', 'vida', 'arcano'], 'O impossível concedido: reverte o que não deveria ter volta.'),
  c('coral_celeste', 'Coral Celeste', ['som', 'luz', 'arcano'], 'Vozes em uníssono: bênção que se multiplica por quem canta.'),
  c('jardim_eterno', 'Jardim Eterno', ['vida', 'tempo', 'terra'], 'O que foi plantado nunca murcha: cura que se recusa a expirar.'),
  c('farol', 'Farol', ['luz', 'espaco', 'som'], 'O ponto fixo no caos: guia aliados de qualquer distância.'),
  c('bencao_marcial', 'Bênção Marcial', ['luz', 'marcial', 'vigor'], 'Armas consagradas: a linha de frente que não recua.'),

  // ---------------- triplas: o cosmos ----------------
  c('supernova', 'Supernova', ['espaco', 'fogo', 'gravidade'], 'A morte de uma estrela: tudo num raio absurdo deixa de existir.'),
  c('horizonte_de_eventos', 'Horizonte de Eventos', ['gravidade', 'espaco', 'sombra'], 'O ponto sem retorno: o que cruza não volta, nem a informação.'),
  c('via_lactea', 'Via Láctea', ['espaco', 'luz', 'arcano'], 'O mapa das estrelas: poder retirado da própria posição do céu.'),
  c('pulso_cosmico', 'Pulso Cósmico', ['espaco', 'som', 'eletricidade'], 'A batida do universo: onda que atravessa o vácuo e o corpo.'),
  c('materia_escura', 'Matéria Escura', ['gravidade', 'sombra', 'arcano'], 'O que segura tudo e ninguém vê: massa invisível que puxa.'),
  c('entropia_final', 'Entropia Final', ['tempo', 'morte', 'gravidade'], 'O fim marcado: tudo desacelera, esfria e para.'),

  // ---------------- triplas: mente e vontade ----------------
  c('hipnose', 'Hipnose', ['som', 'arcano', 'sombra'], 'A voz que vira ordem: o alvo obedece achando que quis.'),
  c('delirio', 'Delírio', ['vileza', 'som', 'arcano'], 'A realidade que não fecha: o alvo luta contra o que não existe.'),
  c('memoria', 'Memória', ['tempo', 'arcano', 'luz'], 'O que já foi ainda é: recupera estados anteriores de aliados.'),
  c('presagio', 'Presságio', ['tempo', 'sombra', 'espaco'], 'Ver o golpe antes dele partir: esquiva do que ainda não aconteceu.'),

  // ---------------- quádruplas: as grandes convergências ----------------
  c('tempestade_perfeita', 'Tempestade Perfeita', ['agua', 'ar', 'eletricidade', 'som'],
    'Vento, água, raio e trovão na mesma frente: o clima vira arma de cerco.'),
  c('cataclismo', 'Cataclismo', ['fogo', 'terra', 'gravidade', 'espaco'],
    'O impacto que reescreve o mapa: cratera, magma e céu partido.'),
  c('juizo_final', 'Juízo Final', ['luz', 'morte', 'som', 'tempo'],
    'A trombeta e a sentença: o fim anunciado, cumprido no horário marcado.'),
  c('senhor_da_praga', 'Senhor da Praga', ['agua', 'vileza', 'morte', 'vida'],
    'A doença como jardim: o que mata também se reproduz e se espalha.'),
  c('avatar_elemental', 'Avatar Elemental', ['fogo', 'agua', 'terra', 'ar'],
    'Os quatro clássicos num corpo só: o elementalista completo.', { fator: 1.55 }),
  c('cavaleiro_absoluto', 'Cavaleiro Absoluto', ['marcial', 'vigor', 'luz', 'tempo'],
    'A técnica perfeita, consagrada e fora do tempo: nenhum golpe se perde.'),
  c('arquiteto_da_realidade', 'Arquiteto da Realidade', ['arcano', 'espaco', 'tempo', 'gravidade'],
    'As quatro alavancas da física: dobra o que existe onde e quando quiser.', { fator: 1.6, minimo: 20 }),
  c('sinfonia_do_caos', 'Sinfonia do Caos', ['som', 'vileza', 'sombra', 'arcano'],
    'A orquestra errada de propósito: cada acorde desmonta uma certeza.'),
  c('genesis', 'Gênese', ['vida', 'luz', 'terra', 'agua'],
    'O primeiro dia: onde passa, o mundo começa de novo.'),
  c('ragnarok', 'Ragnarök', ['fogo', 'morte', 'gravidade', 'tempo'],
    'O crepúsculo dos deuses: fogo, fim, peso e a hora marcada.', { fator: 1.6, minimo: 20 }),
  c('leviata', 'Leviatã', ['agua', 'gravidade', 'morte', 'sombra'],
    'O que vive na fossa: pressão, escuridão e fome antigas.'),
  c('titano_forjado', 'Titã Forjado', ['terra', 'fogo', 'marcial', 'vigor'],
    'Nascido da bigorna: corpo de metal vivo que empunha a própria montanha.'),
  c('sopro_do_dragao', 'Sopro do Dragão', ['fogo', 'ar', 'vigor', 'marcial'],
    'A herança dracônica: hálito incandescente e escamas que aparam lâminas.'),
  c('ceifador_estelar', 'Ceifador Estelar', ['morte', 'espaco', 'marcial', 'sombra'],
    'A foice que corta a distância: colhe do outro lado do vazio.'),
  c('renascimento', 'Renascimento', ['vida', 'morte', 'tempo', 'luz'],
    'A roda completa e domada: morrer vira um passo do ciclo, não o fim.', { fator: 1.6 }),
  c('vontade_absoluta', 'Vontade Absoluta', ['arcano', 'vigor', 'som', 'luz'],
    'A convicção que se impõe ao real: o que você declara passa a valer.'),
];

const CURADAS_POR_CHAVE = new Map<string, CombinacaoCurada>(
  CURADAS.map((k) => [chaveCombinacao(k.componentes), k]),
);

// ---------------------------------------------------------------------------
// Enumeração completa do espaço (leve) + resolução preguiçosa (pesada)
// ---------------------------------------------------------------------------

function infoDe(comps: ElementoBaseId[]): CombinacaoInfo {
  const componentes = ordenarComponentes(comps);
  const chave = chaveCombinacao(componentes);
  const curadaExistente = INDICE_CURADAS.get(chave);
  const curadaNova = CURADAS_POR_CHAVE.get(chave);
  const coesao = coesaoDe(componentes);
  const defExistente = curadaExistente ? ELEMENTOS[curadaExistente] : undefined;
  return {
    id: curadaExistente ?? curadaNova?.id ?? `comb_${componentes.join('_')}`,
    componentes,
    aridade: componentes.length,
    tensao: coesao.tensao,
    harmonia: coesao.harmonia,
    coerencia: coesao.coerencia,
    fatorPotencia:
      defExistente?.fatorPotencia ?? curadaNova?.fator ?? fatorDeCombinacao(componentes, coesao),
    nivelMinimo:
      defExistente?.receita?.[0]?.nivelMinimo ??
      curadaNova?.minimo ??
      minimoDeCombinacao(componentes, coesao),
    curada: Boolean(curadaExistente || curadaNova),
  };
}

function enumerar(aridade: number): CombinacaoInfo[] {
  const saida: CombinacaoInfo[] = [];
  const atual: ElementoBaseId[] = [];
  const rec = (inicio: number) => {
    if (atual.length === aridade) {
      saida.push(infoDe(atual));
      return;
    }
    for (let i = inicio; i < BASES.length; i++) {
      atual.push(BASES[i]);
      rec(i + 1);
      atual.pop();
    }
  };
  rec(0);
  return saida;
}

/** Todas as 680 triplas. */
export const TRIPLAS: CombinacaoInfo[] = enumerar(3);
/** Todas as 2.380 quádruplas. */
export const QUADRUPLAS: CombinacaoInfo[] = enumerar(4);
/** O espaço completo de aridade 3 e 4 (3.060 entradas). */
export const TODAS_COMBINACOES: CombinacaoInfo[] = [...TRIPLAS, ...QUADRUPLAS];

const INFO_POR_ID = new Map<ElementoId, CombinacaoInfo>(
  TODAS_COMBINACOES.map((k) => [k.id, k]),
);
const INFO_POR_CHAVE = new Map<string, CombinacaoInfo>(
  TODAS_COMBINACOES.map((k) => [chaveCombinacao(k.componentes), k]),
);

export function combinacaoInfo(id: ElementoId): CombinacaoInfo | undefined {
  return INFO_POR_ID.get(id);
}

export function combinacaoInfoPorComponentes(
  comps: ElementoBaseId[],
): CombinacaoInfo | undefined {
  return INFO_POR_CHAVE.get(chaveCombinacao(comps));
}

// ---- resolução preguiçosa de ElementoDef ----

const CACHE_DEF = new Map<ElementoId, ElementoDef>();

function materializar(info: CombinacaoInfo): ElementoDef {
  const curada = CURADAS_POR_CHAVE.get(chaveCombinacao(info.componentes));
  const coesao = { tensao: info.tensao, harmonia: info.harmonia, coerencia: info.coerencia };
  return {
    id: info.id,
    nome: curada?.nome ?? nomeProcedural(info.componentes),
    tipo: 'derivado',
    fatorPotencia: info.fatorPotencia,
    pesos: perfilDeCombinacao(info.componentes),
    descricao: curada?.descricao ?? descricaoProcedural(info.componentes, coesao),
    receita: info.componentes.map((elemento) => ({
      elemento,
      nivelMinimo: info.nivelMinimo,
    })),
  };
}

/**
 * Resolve QUALQUER elemento por id: base, derivado curado, ou combinação
 * procedural de 3/4 componentes materializada sob demanda e cacheada.
 */
export function elementoDef(id: ElementoId): ElementoDef | undefined {
  const direto = ELEMENTOS[id];
  if (direto) return direto;
  const cache = CACHE_DEF.get(id);
  if (cache) return cache;
  const info = INFO_POR_ID.get(id);
  if (!info) return undefined;
  const def = materializar(info);
  CACHE_DEF.set(id, def);
  return def;
}

/**
 * Resolve pelos componentes, em qualquer ordem e em QUALQUER aridade: um
 * componente devolve o elemento base, dois devolvem o par curado em
 * `elementos.ts`, três e quatro passam pelo espaço enumerado aqui, e receitas
 * mais amplas (primordial, ciclo, nulo) caem no índice de curadas.
 */
export function elementoDePorComponentes(comps: ElementoBaseId[]): ElementoDef | undefined {
  const unicos = ordenarComponentes([...new Set(comps)]);
  if (unicos.length === 0) return undefined;
  if (unicos.length === 1) return ELEMENTOS[unicos[0]];
  const info = combinacaoInfoPorComponentes(unicos);
  if (info) return elementoDef(info.id);
  // pares e receitas amplas moram no registro curado
  const id = INDICE_CURADAS.get(chaveCombinacao(unicos));
  return id ? ELEMENTOS[id] : undefined;
}

/** Nome de exibição de um elemento, resolvendo procedurais. */
export function nomeElemento(id: ElementoId): string {
  return elementoDef(id)?.nome ?? id;
}

/** Aridade de um elemento: 1 para base, N para o tamanho da receita. */
export function aridadeDe(id: ElementoId): number {
  return elementoDef(id)?.receita?.length ?? 1;
}

/**
 * Base dominante de QUALQUER elemento, inclusive combinações procedurais.
 * É a versão que o motor deve usar; `afinidades.baseDominante` só enxerga o
 * registro curado.
 */
export function baseDominanteDe(id: ElementoId): ElementoBaseId {
  return baseDominanteDoDef(elementoDef(id));
}

/** Efetividade contra um alvo, resolvendo combinações procedurais. */
export function efetividadeDe(atacante: ElementoId, alvo: ElementoBaseId): number {
  const af = AFINIDADES[baseDominanteDe(atacante)];
  if (!af) return MULT_NEUTRO;
  if (af.forteContra.includes(alvo)) return MULT_FORTE;
  if (af.fracoContra.includes(alvo)) return MULT_FRACO;
  return MULT_NEUTRO;
}

/**
 * Progresso de uma combinação dado o mapa de níveis efetivos: 0..1, onde 1
 * significa que todos os componentes atingiram o mínimo da receita.
 */
export function progressoCombinacao(
  info: CombinacaoInfo,
  niveis: Partial<Record<ElementoId, number>>,
): number {
  let soma = 0;
  for (const comp of info.componentes) {
    soma += Math.min(1, (niveis[comp] ?? 0) / info.nivelMinimo);
  }
  return soma / info.componentes.length;
}

/**
 * As combinações relevantes para uma ficha: desbloqueadas primeiro, depois as
 * mais próximas de desbloquear. É o que a constelação desenha — nunca as 3.060.
 */
export function combinacoesRelevantes(
  niveis: Partial<Record<ElementoId, number>>,
  opcoes: { limite?: number; progressoMinimo?: number; aridades?: number[] } = {},
): { info: CombinacaoInfo; progresso: number; nivel: number }[] {
  const { limite = 120, progressoMinimo = 0.5, aridades = [3, 4] } = opcoes;
  const saida: { info: CombinacaoInfo; progresso: number; nivel: number }[] = [];
  for (const info of TODAS_COMBINACOES) {
    if (!aridades.includes(info.aridade)) continue;
    const progresso = progressoCombinacao(info, niveis);
    if (progresso < progressoMinimo) continue;
    const nivel =
      progresso >= 1 ? Math.min(...info.componentes.map((k) => niveis[k] ?? 0)) : 0;
    saida.push({ info, progresso, nivel });
  }
  saida.sort(
    (x, y) =>
      y.nivel - x.nivel ||
      y.progresso - x.progresso ||
      Number(y.info.curada) - Number(x.info.curada) ||
      x.info.id.localeCompare(y.info.id),
  );
  return saida.slice(0, limite);
}

/** Busca textual sobre o espaço completo, resolvendo nomes sob demanda. */
export function buscarCombinacoes(termo: string, limite = 40): CombinacaoInfo[] {
  const alvo = termo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!alvo) return [];
  const saida: CombinacaoInfo[] = [];
  for (const info of TODAS_COMBINACOES) {
    const nome = (elementoDef(info.id)?.nome ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    if (nome.includes(alvo)) {
      saida.push(info);
      if (saida.length >= limite) break;
    }
  }
  return saida;
}
