import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  calcularCascata,
  custoDeAlocacao,
  elementosAlocaveis,
  podeReceberDireto,
} from '../src/engine/cascata';
import {
  CUSTO_CASCATA_EQUIVALENTE,
  CUSTO_PONTO_ALOCACAO,
  DIVISOR_CASCATA,
  LIMIAR_DESTRAVAMENTO,
  pesoDiretoNaCascata,
  type Aridade,
} from '../src/registry/geracoes';
import { aridadeDe, paisDeCascata, combinacaoInfoPorComponentes } from '../src/registry/combinacoes';
import { ELEMENTOS, elementosBase, type ElementoId } from '../src/registry/elementos';
import { criarPersonagem, investirElemento, podeInvestir } from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { analisarFicha } from '../src/api/consultas';

const TRIPLA_FAT = combinacaoInfoPorComponentes(['fogo', 'agua', 'terra'])!.id;
const QUAD_FAT = combinacaoInfoPorComponentes(['fogo', 'agua', 'terra', 'ar'])!.id;

describe('cascata — rendimento passivo', () => {
  it('5 fogo + 5 água → 1 ponto passivo em vapor; 4 + 5 → 0', () => {
    const sim = calcularCascata({ fogo: 5, agua: 5 });
    expect(sim.passivos.get('vapor')).toBe(1);
    const nao = calcularCascata({ fogo: 4, agua: 5 });
    expect(nao.passivos.get('vapor') ?? 0).toBe(0);
  });

  it('o rendimento é o MIN sobre os pais: 20 fogo + 5 água → 1 (não 4)', () => {
    const sim = calcularCascata({ fogo: 20, agua: 5 });
    expect(sim.passivos.get('vapor')).toBe(1);
  });

  it('50+50 → 10 passivos → destrava; 49+50 → não', () => {
    const sim = calcularCascata({ fogo: 50, agua: 50 });
    expect(sim.passivos.get('vapor')).toBe(10);
    expect(sim.destravados.has('vapor')).toBe(true);
    const nao = calcularCascata({ fogo: 49, agua: 50 });
    expect(nao.destravados.has('vapor')).toBe(false);
    expect(nao.progressoDestravamento.get('vapor')).toEqual({ passivos: 9, limiar: 10 });
  });

  it('tripla: os pais são os 3 PARES, não as 3 bases; B=20 em 3 bases → 1 ponto', () => {
    const pais = paisDeCascata(TRIPLA_FAT);
    expect(pais).toHaveLength(3);
    for (const pai of pais) expect(aridadeDe(pai)).toBe(2);
    // B=20: cada par rende floor(20/5)=4 → tripla floor(4/4)=1
    const sim = calcularCascata({ fogo: 20, agua: 20, terra: 20 });
    expect(sim.passivos.get(TRIPLA_FAT)).toBe(1);
  });

  it('quádrupla: os pais são as 4 TRIPLAS; B=60 em 4 bases → 1 ponto', () => {
    const pais = paisDeCascata(QUAD_FAT);
    expect(pais).toHaveLength(4);
    for (const pai of pais) expect(aridadeDe(pai)).toBe(3);
    // B=60: par floor(60/5)=12 → tripla floor(12/4)=3 → quádrupla floor(3/3)=1
    const sim = calcularCascata({ fogo: 60, agua: 60, terra: 60, ar: 60 });
    expect(sim.passivos.get(QUAD_FAT)).toBe(1);
  });

  it('ponto direto num par destravado sobe para a tripla no peso declarado, não 1:1', () => {
    const base = calcularCascata({ fogo: 50, agua: 50 });
    const comDireto = calcularCascata({ fogo: 50, agua: 50, vapor: 10 });
    const peso = pesoDiretoNaCascata(2);
    expect(comDireto.paraCascata.get('vapor')).toBeCloseTo(
      (base.paraCascata.get('vapor') ?? 0) + 10 * peso,
      10,
    );
    expect(peso).toBeLessThan(1);
  });
});

describe('cascata — não-arbitragem e economia', () => {
  it('MARCO MEDIDO: destravar gen-3 pela rota "pares + diretos" nunca é mais barato que pelas bases', () => {
    // A versão antiga deste teste comparava pesoDireto/custo com 1/custoEq —
    // uma identidade algébrica que passava para QUALQUER valor das
    // constantes (auditoria). Este mede a economia de verdade.
    // Rota das bases: 120 em cada uma de 3 bases = 360 → 6 passivos na tripla.
    const pelasBases = custoDeAlocacao({ fogo: 120, agua: 120, terra: 120 });
    expect(pelasBases.total).toBe(360);
    expect(calcularCascata({ fogo: 120, agua: 120, terra: 120 }).destravados.has(TRIPLA_FAT)).toBe(true);
    // Rota alternativa: destravar os 3 pares (50+50+50 nas bases) e despejar
    // diretos nos pares até a tripla destravar. paraCascata(par) = 10 +
    // peso(2)·d; a tripla precisa de floor(paraCascata/4) >= 6 em TODOS.
    const peso = pesoDiretoNaCascata(2);
    const dPorPar = Math.ceil((24 - 10) / peso);
    const diretos: Record<string, number> = { fogo: 50, agua: 50, terra: 50, vapor: dPorPar, pantano: dPorPar, lava: dPorPar };
    const alternativa = custoDeAlocacao(diretos);
    expect(calcularCascata(diretos).destravados.has(TRIPLA_FAT)).toBe(true);
    expect(alternativa.total).toBeGreaterThan(pelasBases.total);
  });

  it('custoDeAlocacao cobra por geração em PARIDADE com os pais: 1 · 2 · 3 · 4', () => {
    const { porAridade, total } = custoDeAlocacao({
      fogo: 10, vapor: 2, [TRIPLA_FAT]: 1, [QUAD_FAT]: 1,
    });
    expect(porAridade[1]).toBe(10);
    expect(porAridade[2]).toBe(4);
    expect(porAridade[3]).toBe(3);
    expect(porAridade[4]).toBe(4);
    expect(total).toBe(21);
    // paridade: +1 nível via direto custa o mesmo que +1 em cada pai
    for (const aridade of [2, 3, 4] as Aridade[]) {
      expect(CUSTO_PONTO_ALOCACAO[aridade]).toBe(aridade);
    }
  });

  it('tabela de marcos: destravar gen-2 custa 100 de orçamento nas bases', () => {
    // 50 em cada uma de 2 bases = 100 pontos → 10 passivos = limiar
    const sim = calcularCascata({ fogo: 50, agua: 50 });
    expect(custoDeAlocacao({ fogo: 50, agua: 50 }).total).toBe(100);
    expect(sim.destravados.has('vapor')).toBe(true);
  });

  it('quádruplas a 1200: disjuntas são impossíveis; a família de 5 bases destrava as 5 irmãs', () => {
    // O alvo de desenho MEDIDO (auditoria): duas quádruplas DISJUNTAS custam
    // 1920 > 1200 — impossível. O que o teto compra é UMA família: 5 bases a
    // 240 (= 1200 cravado) destravam as C(5,4)=5 quádruplas irmãs — dominar
    // uma família elemental inteira, sem sobrar um ponto para nada além.
    const umaQuad = custoDeAlocacao({ fogo: 240, agua: 240, terra: 240, ar: 240 });
    expect(umaQuad.total).toBe(960);
    expect(calcularCascata({ fogo: 240, agua: 240, terra: 240, ar: 240 }).destravados.has(QUAD_FAT)).toBe(true);
    expect(2 * 4 * 240).toBeGreaterThan(1200);
    const familia = { fogo: 240, agua: 240, terra: 240, ar: 240, eletricidade: 240 };
    expect(custoDeAlocacao(familia).total).toBe(1200);
    const sim = calcularCascata(familia);
    const quadsDestravadas = [...sim.destravados].filter(id => aridadeDe(id) === 4);
    expect(quadsDestravadas.length).toBe(5);
  });
});

describe('cascata — estrutura e contratos', () => {
  it('paisDeCascata devolve sempre aridade estritamente menor (aciclicidade)', () => {
    const amostra: ElementoId[] = ['vapor', 'lava', TRIPLA_FAT, QUAD_FAT, 'primordial', 'nulo'];
    for (const id of amostra) {
      for (const pai of paisDeCascata(id)) {
        expect(aridadeDe(pai)).toBeLessThan(Math.max(2, aridadeDe(id)));
      }
    }
  });

  it('especiais nunca destravam e não explodem', () => {
    const bases: Partial<Record<ElementoId, number>> = {};
    for (const def of elementosBase()) bases[def.id] = 100;
    const sim = calcularCascata(bases);
    for (const especial of ['primordial', 'ciclo', 'nulo']) {
      expect(sim.destravados.has(especial)).toBe(false);
      expect(ELEMENTOS[especial].cascata?.destravavel).toBe(false);
    }
    // nulo (17 bases a 100, divisor 20) rende floor(100/20)=5 passivos
    expect(sim.passivos.get('nulo')).toBe(5);
  });

  it('ficha nova: alocáveis = exatamente os 17 base', () => {
    const sim = calcularCascata({});
    expect(elementosAlocaveis(sim)).toEqual(elementosBase().map((d) => d.id));
  });

  it('determinismo: 50 chamadas, mapas idênticos com chaves em ordem estável', () => {
    const ficha = { fogo: 37, agua: 23, terra: 51, marcial: 12 };
    const primeiro = calcularCascata(ficha);
    const chaves = [...primeiro.paraCascata.keys()].join(',');
    for (let i = 0; i < 50; i++) {
      const outra = calcularCascata(ficha);
      expect([...outra.paraCascata.keys()].join(',')).toBe(chaves);
      expect([...outra.paraCascata.values()]).toEqual([...primeiro.paraCascata.values()]);
    }
  });

  it('escala: 17 bases a 100 pontos resolve rápido e sem inflar o mapa', () => {
    const bases: Partial<Record<ElementoId, number>> = {};
    for (const def of elementosBase()) bases[def.id] = 100;
    const inicio = performance.now();
    const sim = calcularCascata(bases);
    const duracao = performance.now() - inicio;
    expect(duracao).toBeLessThan(500);
    // o pior caso toca o espaço inteiro (17+136+680+2380+especiais)
    expect(sim.paraCascata.size).toBeGreaterThan(3000);
    // ...mas uma ficha típica toca DEZENAS
    const tipica = calcularCascata({ fogo: 30, agua: 20, vida: 10 });
    expect(tipica.paraCascata.size).toBeLessThan(20);
  });
});

describe('a UI não reimplementa a regra (camadas)', () => {
  const fonteUI = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');

  it('o painel de investir LÊ prog.alocaveis — não lista as bases por conta própria', () => {
    // Regressão real: a tabela lateral nasceu com `elementosBase()` fixo e o
    // comentário "só os 17 base aceitam pontos diretos". Com isso, um par
    // destravado não tinha onde receber o ponto direto que a regra concede —
    // a regra existia no motor e era inalcançável pela interface.
    const painel = fonteUI.slice(
      fonteUI.indexOf('function renderPainelInvestir'),
      fonteUI.indexOf('function renderDetalheElemento'),
    );
    expect(painel).toContain('prog.alocaveis');
    expect(painel).not.toMatch(/const\s+\w+\s*=\s*elementosBase\(\)\s*\.filter/);
  });

  it('todo contador de orçamento cobra custoDeAlocacao, nunca soma crua de p.elementos', () => {
    expect(fonteUI).not.toMatch(/Object\.values\(p\.elementos\)\.reduce/);
    expect(fonteUI).toContain('custoDeAlocacao(estado.personagem.elementos)');
    expect(fonteUI).toContain('custoDeAlocacao(p.elementos)');
  });
});

describe('integração com o personagem e a progressão', () => {
  it('investirElemento em derivado lança em ficha nova e PARA de lançar após destravar', () => {
    const p = criarPersonagem('teste');
    expect(() => investirElemento(p, 'lava', 1)).toThrow(/destravado/);
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    expect(podeInvestir(p, 'lava').ok).toBe(true);
    expect(() => investirElemento(p, 'lava', 1)).not.toThrow();
    expect(p.elementos.lava).toBe(1);
  });

  it('REGRA DO DONO: base primeiro, secundário SÓ com 10 passivos — a fronteira exata', () => {
    // 49+50 = 9 passivos: ainda recusa, com o contador no motivo.
    const quase = criarPersonagem('quase');
    investirElemento(quase, 'fogo', 49);
    investirElemento(quase, 'agua', 50);
    const veredito = podeInvestir(quase, 'vapor');
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) {
      expect(veredito.motivo).toMatch(/9\/10/);
      expect(veredito.faltamPassivos).toBe(1);
    }
    expect(() => investirElemento(quase, 'vapor', 1)).toThrow(/destravado/);

    // +1 ponto na base que faltava → 10 passivos → aceita ponto direto.
    investirElemento(quase, 'fogo', 1);
    expect(calcularCascata(quase.elementos).passivos.get('vapor')).toBe(LIMIAR_DESTRAVAMENTO[2]);
    expect(podeInvestir(quase, 'vapor').ok).toBe(true);
    expect(() => investirElemento(quase, 'vapor', 1)).not.toThrow();

    // E a regra vale para TODOS os 136 pares, não só para o vapor: numa ficha
    // nova, nenhum derivado aceita ponto direto (só as 17 bases).
    const novo = criarPersonagem('novo');
    const alocaveisIniciais = calcularProgressao(novo).alocaveis;
    expect(alocaveisIniciais).toEqual(elementosBase().map((d) => d.id));
    for (const def of Object.values(ELEMENTOS)) {
      if (def.tipo === 'base') continue;
      expect(podeInvestir(novo, def.id).ok).toBe(false);
    }
  });

  it('especial nunca aceita ponto direto, com motivo claro', () => {
    const p = criarPersonagem('teste');
    for (const def of elementosBase()) investirElemento(p, def.id, 100);
    const veredito = podeInvestir(p, 'nulo');
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) expect(veredito.motivo).toMatch(/nunca aceita/);
  });

  it('ponto direto em derivado destravado soma 1:1 ao nível efetivo dele, e só dele', () => {
    const p = criarPersonagem('teste');
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    const antes = calcularProgressao(p);
    investirElemento(p, 'lava', 3, antes);
    const depois = calcularProgressao(p);
    expect(depois.niveisEfetivos.lava).toBe(antes.niveisEfetivos.lava + 3);
    expect(depois.niveisEfetivos.vapor).toBe(antes.niveisEfetivos.vapor);
    expect(depois.niveisEfetivos.fogo).toBe(antes.niveisEfetivos.fogo);
  });

  it('REGRA NO MODELO: ficha montada à mão não expressa direto em derivado TRAVADO', () => {
    // A regra vivia só no mutador (`investirElemento`). Uma ficha escrita à
    // mão — CLI `--ficha`, import de build, localStorage, agente montando
    // `Personagem` — punha `lava: 180` com 2/10 passivos e ganhava nível 190,
    // com 1,76× de impacto em skill. Agora `calcularProgressao` e
    // `podeInvestir` concordam sobre a mesma ficha.
    const burlada = criarPersonagem('burlada');
    burlada.elementos = { fogo: 10, terra: 10, lava: 180 };
    const prog = calcularProgressao(burlada);
    expect(prog.cascata.destravados.has('lava')).toBe(false);
    expect(podeInvestir(burlada, 'lava').ok).toBe(false);
    // nível = min(componentes) só, sem os 180 ilegais
    expect(prog.niveisEfetivos.lava).toBe(10);

    // e a ficha LEGÍTIMA continua expressando o direto
    const legitima = criarPersonagem('legitima');
    legitima.elementos = { fogo: 50, terra: 50 };
    const antes = calcularProgressao(legitima).niveisEfetivos.lava;
    legitima.elementos.lava = 5;
    expect(calcularProgressao(legitima).niveisEfetivos.lava).toBe(antes + 5);
  });

  it('a API cobra ORÇAMENTO por geração, igual à UI — a camada dos agentes não fica de fora', () => {
    const p = criarPersonagem('agente');
    p.elementos = { fogo: 50, agua: 50, vapor: 10 };
    const ficha = analisarFicha(p);
    expect(ficha.pontos.elementos).toBe(custoDeAlocacao(p.elementos).total);
    expect(ficha.pontos.elementos).toBe(50 + 50 + 10 * CUSTO_PONTO_ALOCACAO[2]);
  });

  it('derivado NUNCA tem nível efetivo sem a receita atendida, mesmo com ponto direto', () => {
    // ficha montada à mão (sem passar por investirElemento) escreve direto
    const p = criarPersonagem('teste');
    p.elementos.lava = 5;
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.lava).toBe(0);
  });

  it('ponto direto em derivado não vaza para o transbordo de sinergias', () => {
    const p = criarPersonagem('teste');
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    const antes = calcularProgressao(p);
    investirElemento(p, 'lava', 5, antes);
    const depois = calcularProgressao(p);
    expect(depois.transbordo).toEqual(antes.transbordo);
  });

  it('com zero diretos em derivados, niveisEfetivos é idêntico ao mundo antigo', () => {
    const p = criarPersonagem('golden');
    investirElemento(p, 'fogo', 12);
    investirElemento(p, 'terra', 12);
    investirElemento(p, 'vida', 8);
    const prog = calcularProgressao(p);
    // valores do mundo pré-cascata: derivado = min(componentes) quando atende
    expect(prog.niveisEfetivos.lava).toBeGreaterThan(0);
    expect(prog.niveisEfetivos.lava).toBe(
      Math.min(prog.niveisEfetivos.fogo, prog.niveisEfetivos.terra) + prog.bonusNivelDerivado,
    );
    expect(prog.alocaveis).toEqual(elementosBase().map((d) => d.id));
    expect(prog.cascata.passivos.get('lava')).toBe(2);
  });
});
