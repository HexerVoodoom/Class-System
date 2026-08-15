import { describe, expect, it } from 'vitest';
import {
  analisarFicha,
  arquetiposProximos,
  buscar,
  caminhoParaArquetipo,
  diagnosticarFusao,
  diagnosticarSkill,
  explicarElemento,
  listarCombinacoes,
  modificadoresPara,
  panorama,
  pontosDiretosPara,
  previaDeFusao,
  proximasCombinacoes,
  requisitosBase,
  totalDePontos,
  verificarIntegridade,
} from '../src/api/consultas';
import { executar } from '../src/api/cli';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { ARQUETIPOS } from '../src/registry/arquetipos';
import type { SkillConfig } from '../src/engine/skills';
import type { ElementoBaseId } from '../src/registry/elementos';

function ficha(elems: [ElementoBaseId, number][], escola = 12, recurso = 10) {
  const p = criarPersonagem('t');
  for (const [e, n] of elems) investirElemento(p, e, n);
  investirEscola(p, 'conjuracao', escola);
  investirRecurso(p, 'mana', recurso);
  return p;
}

const skill = (elemento: string, over: Partial<SkillConfig> = {}): SkillConfig => ({
  nome: 't',
  elemento,
  escola: 'conjuracao',
  fontes: [{ recurso: 'mana', proporcao: 100 }],
  energia: 20,
  tempoConjuracaoSegundos: 2,
  alcanceMetros: 0,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  ...over,
});

describe('integridade do conteúdo', () => {
  it('nenhum id referenciado está órfão e nenhum arquétipo é inalcançável', () => {
    const problemas = verificarIntegridade();
    const erros = problemas.filter((p) => p.severidade === 'erro');
    expect(erros).toEqual([]);
  });

  it('todo arquétipo do registro tem um caminho verificado a partir do zero', () => {
    const vazia = criarPersonagem('vazia');
    const semCaminho: string[] = [];
    for (const id of Object.keys(ARQUETIPOS)) {
      const plano = caminhoParaArquetipo(vazia, id);
      if (!plano?.verificado) semCaminho.push(id);
    }
    expect(semCaminho).toEqual([]);
  });
});

describe('panorama', () => {
  it('reporta o tamanho real do sistema', () => {
    const p = panorama();
    expect(p.elementosBase).toBe(17);
    expect(p.pares).toBe(136);
    expect(p.triplas).toBe(680);
    expect(p.quadruplas).toBe(2380);
    expect(p.elementosAlcancaveis).toBe(3215);
  });
});

describe('requisitos e planejamento', () => {
  it('traduz um derivado nos níveis efetivos que cada base precisa ter', () => {
    // lava exige fogo e terra em 10 (o mínimo da receita)
    expect(requisitosBase('lava', 10)).toEqual({ fogo: 10, terra: 10 });
    // pedir nível acima do mínimo eleva os dois componentes
    expect(requisitosBase('lava', 15)).toEqual({ fogo: 15, terra: 15 });
  });

  it('resolve receitas encadeadas recursivamente', () => {
    const req = requisitosBase('vulcao', 14);
    expect(Object.keys(req).sort()).toEqual(['ar', 'fogo', 'terra']);
    for (const n of Object.values(req)) expect(n).toBeGreaterThanOrEqual(14);
  });

  it('pontosDiretosPara aproveita o transbordo das sinergias', () => {
    // vida transborda para os primais na razão 0.2 — pedir fogo junto de vida
    // deve custar menos pontos diretos em fogo do que o alvo efetivo
    const alvo = { vida: 20 as number, fogo: 10 as number };
    const direto = pontosDiretosPara(alvo);
    expect(direto.vida).toBe(20);
    expect(direto.fogo!).toBeLessThan(10);
    // e o plano é verificado: a ficha resultante realmente atinge o alvo
    const p = criarPersonagem('v');
    p.elementos = direto;
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.fogo).toBeGreaterThanOrEqual(10);
    expect(prog.niveisEfetivos.vida).toBeGreaterThanOrEqual(20);
  });

  it('o caminho até um arquétipo é sempre verificado ponta a ponta', () => {
    const plano = caminhoParaArquetipo(criarPersonagem('v'), 'vulcanologo')!;
    expect(plano.verificado).toBe(true);
    expect(plano.alcancado).toBe(false);
    expect(plano.custoTotal).toBeGreaterThan(0);
    // montar a ficha do plano realmente destrava
    const p = criarPersonagem('p');
    p.elementos = plano.elementos;
    p.escolas = plano.escolas;
    p.recursos = plano.recursos;
    expect(calcularProgressao(p).arquetipos.map((a) => a.id)).toContain('vulcanologo');
  });

  it('quem já alcançou o arquétipo recebe custo zero', () => {
    const plano0 = caminhoParaArquetipo(criarPersonagem('v'), 'lavamante')!;
    const p = criarPersonagem('p');
    p.elementos = plano0.elementos;
    p.escolas = plano0.escolas;
    p.recursos = plano0.recursos;
    const plano = caminhoParaArquetipo(p, 'lavamante')!;
    expect(plano.alcancado).toBe(true);
    expect(plano.custoTotal).toBe(0);
  });

  it('arquetiposProximos ordena por custo crescente', () => {
    const p = ficha([
      ['fogo', 12],
      ['terra', 12],
    ]);
    const lista = arquetiposProximos(p, 8);
    expect(lista.length).toBeGreaterThan(0);
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i].custoTotal).toBeGreaterThanOrEqual(lista[i - 1].custoTotal);
    }
    for (const plano of lista) expect(plano.verificado).toBe(true);
  });
});

describe('descoberta: o que está a um passo', () => {
  it('proximasCombinacoes ordena pelo que custa menos e diz o que falta', () => {
    const p = ficha([
      ['fogo', 12],
      ['terra', 12],
      ['ar', 8],
    ]);
    const prox = proximasCombinacoes(p, { limite: 10 });
    expect(prox.length).toBeGreaterThan(0);
    for (let i = 1; i < prox.length; i++) {
      expect(prox[i].custoTotal).toBeGreaterThanOrEqual(prox[i - 1].custoTotal);
    }
    // o que falta é acionável: investir exatamente isso abre a combinação
    const alvo = prox[0];
    const p2 = ficha([
      ['fogo', 12],
      ['terra', 12],
      ['ar', 8],
    ]);
    for (const [id, n] of Object.entries(alvo.faltam) as [ElementoBaseId, number][]) {
      investirElemento(p2, id, n);
    }
    expect(calcularProgressao(p2).niveisEfetivos[alvo.id] ?? 0).toBeGreaterThan(0);
  });

  it('nunca sugere algo que já está aberto', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const prog = calcularProgressao(p);
    for (const c of proximasCombinacoes(p, { limite: 30 })) {
      expect(prog.niveisEfetivos[c.id] ?? 0).toBe(0);
    }
  });
});

describe('análise de ficha', () => {
  it('separa pontos diretos de transbordo', () => {
    const p = ficha([
      ['vida', 20],
      ['fogo', 5],
    ]);
    const a = analisarFicha(p);
    const fogo = a.elementosBase.find((e) => e.id === 'fogo')!;
    expect(fogo.direto).toBe(5);
    expect(fogo.transbordo).toBeGreaterThan(0);
    expect(fogo.efetivo).toBe(fogo.direto + fogo.transbordo);
  });

  it('avisa quando a ficha não consegue lançar nada', () => {
    const a = analisarFicha(criarPersonagem('vazia'));
    expect(a.avisos.length).toBeGreaterThanOrEqual(3);
    expect(a.pontos.total).toBe(0);
  });

  it('soma de pontos bate com a ficha', () => {
    const p = ficha([['fogo', 20]]);
    const a = analisarFicha(p);
    expect(a.pontos.elementos).toBe(20);
    expect(a.pontos.escolas).toBe(12);
    expect(a.pontos.recursos).toBe(10);
    expect(a.pontos.total).toBe(42);
    expect(totalDePontos(p.elementos)).toBe(20);
  });
});

describe('diagnóstico de skill e modificadores', () => {
  it('skill inválida traz o motivo e o que destrava', () => {
    const p = ficha([['fogo', 10]]);
    const d = diagnosticarSkill(p, skill('fogo', { energia: 999 }));
    expect(d.valida).toBe(false);
    expect(d.erros.join(' ')).toMatch(/Energia/);
    expect(d.erros.join(' ')).toMatch(/Canalização Profunda|escola/);
    expect(d.resultado).toBeUndefined();
  });

  it('skill válida traz o resultado completo', () => {
    const p = ficha([['fogo', 12]]);
    const d = diagnosticarSkill(p, skill('fogo'));
    expect(d.valida).toBe(true);
    expect(d.resultado!.impactoTotal).toBeGreaterThan(0);
    expect(d.resultado!.eficiencia).toBeGreaterThan(0);
    expect(d.tags).toContain('Mágica');
  });

  it('modificadoresPara explica por que os incompatíveis não cabem', () => {
    const p = ficha([['fogo', 12]]);
    const lista = modificadoresPara(p, skill('fogo'));
    expect(lista).toHaveLength(23);
    const incompativel = lista.find((m) => !m.compativel)!;
    expect(incompativel.motivo).toBeTruthy();
    // compatíveis vêm primeiro
    const primeiroIncompativel = lista.findIndex((m) => !m.compativel);
    const ultimoCompativel = lista.map((m) => m.compativel).lastIndexOf(true);
    expect(ultimoCompativel).toBeLessThan(primeiroIncompativel);
  });
});

describe('fusão pela API', () => {
  it('a prévia antecipa o elemento sem calcular', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const pv = previaDeFusao(p, [skill('fogo'), skill('terra')]);
    expect(pv.nomeElementoResultante).toBe('Lava');
    expect(pv.liberado).toBe(true);
    expect(pv.geracao).toBe(2);
  });

  it('o diagnóstico expõe a comparação honesta contra lançar separado', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const d = diagnosticarFusao(p, { nome: 'f', componentes: [skill('fogo'), skill('terra')] });
    expect(d.valida).toBe(true);
    expect(d.taxaDeCusto).toBeGreaterThan(1);
    expect(d.eficienciaRelativa).toBeLessThanOrEqual(1.101);
  });
});

describe('busca e explicação', () => {
  it('busca ignora acento e alcança o registro curado', () => {
    // "Vulcão" é uma tripla curada: mora em combinacoes.ts, não em ELEMENTOS
    const r = buscar('vulcao', 10);
    expect(r.some((x) => x.nome === 'Vulcão')).toBe(true);
    expect(r.map((x) => x.tipo)).toContain('combinacao');
  });

  it('busca atravessa tipos diferentes de entidade', () => {
    // "lava" é elemento (par curado à mão) e também aparece em arquétipo
    const r = buscar('lava', 20);
    expect(r.map((x) => x.tipo)).toContain('elemento');
    const tipos = new Set(buscar('fogo', 30).map((x) => x.tipo));
    expect(tipos.size).toBeGreaterThan(1);
  });

  it('explicar resolve combinação procedural, não só curada', () => {
    const exp = explicarElemento('comb_fogo_terra_sombra')!;
    expect(exp.nome).toBe('Lava Umbria');
    expect(exp.aridade).toBe(3);
    expect(exp.receita).toHaveLength(3);
    expect(exp.coerencia).toBeTruthy();
  });

  it('explicar aponta em que combinações maiores o elemento entra', () => {
    const exp = explicarElemento('lava')!;
    expect(exp.usadoEm.map((u) => u.nome)).toContain('Vulcão');
  });
});

describe('determinismo — o contrato mais importante para automação', () => {
  it('duas chamadas idênticas produzem JSON idêntico', () => {
    const p = ficha([
      ['fogo', 14],
      ['terra', 14],
      ['ar', 14],
    ]);
    const a = JSON.stringify(analisarFicha(p));
    const b = JSON.stringify(analisarFicha(p));
    expect(a).toBe(b);

    const c = JSON.stringify(proximasCombinacoes(p, { limite: 12 }));
    const d = JSON.stringify(proximasCombinacoes(p, { limite: 12 }));
    expect(c).toBe(d);

    expect(JSON.stringify(panorama())).toBe(JSON.stringify(panorama()));
    expect(JSON.stringify(buscar('lava', 10))).toBe(JSON.stringify(buscar('lava', 10)));
  });

  it('a paginação é estável: página 2 continua exatamente onde a 1 parou', () => {
    const p1 = listarCombinacoes({ aridade: 3, limite: 10, offset: 0 });
    const p2 = listarCombinacoes({ aridade: 3, limite: 10, offset: 10 });
    const tudo = listarCombinacoes({ aridade: 3, limite: 20, offset: 0 });
    expect([...p1.itens, ...p2.itens].map((x) => x.id)).toEqual(tudo.itens.map((x) => x.id));
    expect(p1.total).toBe(680);
    expect(p1.restantes).toBe(670);
  });
});

describe('CLI', () => {
  it('comando desconhecido sai com código 2', () => {
    expect(executar(['nao-existe'])).toBe(2);
  });

  it('ajuda sai com código 0', () => {
    expect(executar(['ajuda'])).toBe(0);
  });

  it('erro de uso sai com código 1, não estoura', () => {
    expect(executar(['explicar', 'elemento-que-nao-existe'])).toBe(1);
  });

  it('integridade sai com 0 quando o conteúdo está consistente', () => {
    expect(executar(['integridade'])).toBe(0);
  });
});
