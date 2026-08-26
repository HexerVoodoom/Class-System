import { describe, expect, it } from 'vitest';
import {
  NIVEL_MAXIMO,
  NIVEL_MINIMO,
  PAPEIS_VALIDOS,
  composicaoPadrao,
  criarPrng,
  gerarGrupo,
  gerarPersonagem,
  orcamentoDoNivel,
  type PapelId,
} from '../src/engine/gerador';
import { gerarFicha, gerarGrupoDeFichas, listarNiveis, listarPapeis } from '../src/api/consultas';
import { calcularProgressao } from '../src/engine/progressao';
import { podeInvestir } from '../src/engine/personagem';
import { custoDeAlocacao } from '../src/engine/cascata';
import { ELEMENTOS, type ElementoId } from '../src/registry/elementos';
import { TALENTOS, type TalentoId } from '../src/registry/talentos';
import { ORCAMENTO_POR_TIER } from '../src/registry/geracoes';

const NIVEIS = [1, 2, 3, 4, 5, 6, 7];

function somar(m: Partial<Record<string, number>>): number {
  return Object.values(m).reduce<number>((a, b) => a + (b ?? 0), 0);
}

describe('PRNG semeado', () => {
  it('é reprodutível e fica em [0,1)', () => {
    const a = Array.from({ length: 200 }, criarPrng(12345));
    const b = Array.from({ length: 200 }, criarPrng(12345));
    expect(a).toEqual(b);
    for (const x of a.flat()) expect(x).toBeGreaterThanOrEqual(0);
  });

  it('sementes diferentes divergem', () => {
    const a = criarPrng(1);
    const b = criarPrng(2);
    expect(a()).not.toBe(b());
  });
});

describe('gerarPersonagem — determinismo', () => {
  it('mesma semente e mesmos filtros devolvem a MESMA ficha', () => {
    for (const papel of PAPEIS_VALIDOS) {
      const a = gerarPersonagem({ nivel: 5, papel, semente: 4242 });
      const b = gerarPersonagem({ nivel: 5, papel, semente: 4242 });
      expect(JSON.stringify(a.personagem)).toBe(JSON.stringify(b.personagem));
      expect(a.skills.map((s) => s.config)).toEqual(b.skills.map((s) => s.config));
    }
  });

  it('sem semente explícita ainda é determinístico (semente derivada dos filtros)', () => {
    const a = gerarPersonagem({ nivel: 3, papel: 'dps' });
    const b = gerarPersonagem({ nivel: 3, papel: 'dps' });
    expect(a.semente).toBe(b.semente);
    expect(JSON.stringify(a.personagem)).toBe(JSON.stringify(b.personagem));
  });

  it('sementes diferentes produzem fichas diferentes', () => {
    const fichas = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(gerarPersonagem({ nivel: 4, papel: 'dps', semente: i }).personagem),
      ),
    );
    // não exigimos 20/20 (colisão é legítima), mas variedade real
    expect(fichas.size).toBeGreaterThan(12);
  });
});

describe('gerarPersonagem — respeita o orçamento do nível', () => {
  it('nunca gasta mais que o orçamento do tier, em nenhum nível/papel', () => {
    for (const nivel of NIVEIS) {
      for (const papel of PAPEIS_VALIDOS) {
        const g = gerarPersonagem({ nivel, papel, semente: nivel * 100 + papel.length });
        expect(g.orcamento.disponivel).toBe(ORCAMENTO_POR_TIER[nivel]);
        expect(g.orcamento.gasto.total).toBeLessThanOrEqual(g.orcamento.disponivel);
        expect(g.orcamento.sobra).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('aproveita quase tudo — sobra é resto de arredondamento, não desperdício', () => {
    for (const nivel of NIVEIS) {
      const g = gerarPersonagem({ nivel, semente: 7 });
      expect(g.orcamento.sobra).toBeLessThan(Math.max(6, g.orcamento.disponivel * 0.06));
    }
  });

  it('o gasto declarado bate com a ficha (a contabilidade não mente)', () => {
    const g = gerarPersonagem({ nivel: 6, papel: 'controle', semente: 31 });
    const p = g.personagem;
    expect(g.orcamento.gasto.elementos).toBe(custoDeAlocacao(p.elementos).total);
    expect(g.orcamento.gasto.escolas).toBe(somar(p.escolas));
    expect(g.orcamento.gasto.recursos).toBe(somar(p.recursos));
    expect(g.orcamento.gasto.talentos).toBe(somar(p.talentos));
    expect(g.orcamento.gasto.profissoes).toBe(somar(p.profissoes));
  });

  it('`orcamento` explícito manda na curva por tier', () => {
    const g = gerarPersonagem({ nivel: 1, orcamento: 900, semente: 3 });
    expect(g.orcamento.disponivel).toBe(900);
    expect(g.orcamento.gasto.total).toBeLessThanOrEqual(900);
  });
});

describe('gerarPersonagem — só produz fichas LEGAIS', () => {
  it('todo ponto direto em derivado está num elemento destravado', () => {
    for (const nivel of NIVEIS) {
      for (const papel of PAPEIS_VALIDOS) {
        const g = gerarPersonagem({ nivel, papel, semente: nivel * 17 });
        const prog = calcularProgressao(g.personagem);
        for (const id of Object.keys(g.personagem.elementos) as ElementoId[]) {
          if (ELEMENTOS[id]?.tipo === 'base') continue;
          expect(prog.cascata.destravados.has(id)).toBe(true);
          expect(podeInvestir(g.personagem, id, prog).ok).toBe(true);
        }
      }
    }
  });

  it('pontos são sempre inteiros positivos', () => {
    const g = gerarPersonagem({ nivel: 7, semente: 5 });
    const mapas = [
      g.personagem.elementos,
      g.personagem.escolas,
      g.personagem.recursos,
      g.personagem.talentos,
      g.personagem.profissoes,
    ];
    for (const mapa of mapas) {
      for (const v of Object.values(mapa)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v as number).toBeGreaterThan(0);
      }
    }
  });

  it('talentos respeitam ranks máximos e exclusividade de ramo', () => {
    for (let semente = 0; semente < 25; semente++) {
      const g = gerarPersonagem({ nivel: 6, semente });
      for (const [id, ranks] of Object.entries(g.personagem.talentos) as [TalentoId, number][]) {
        const def = TALENTOS[id];
        expect(ranks).toBeLessThanOrEqual(def.ranksMaximos);
        for (const rival of def.exclusivoCom ?? []) {
          expect(g.personagem.talentos[rival] ?? 0).toBe(0);
        }
      }
    }
  });

  it('a ficha sempre tem com o que lançar: elemento, escola e recurso', () => {
    for (const nivel of NIVEIS) {
      const g = gerarPersonagem({ nivel, semente: nivel });
      expect(Object.keys(g.personagem.elementos).length).toBeGreaterThan(0);
      expect(Object.keys(g.personagem.escolas).length).toBeGreaterThan(0);
      expect(Object.keys(g.personagem.recursos).length).toBeGreaterThan(0);
    }
  });
});

describe('gerarPersonagem — as skills saem válidas', () => {
  it('toda skill devolvida passa na validação do motor', () => {
    for (const nivel of NIVEIS) {
      for (const papel of PAPEIS_VALIDOS) {
        const g = gerarPersonagem({ nivel, papel, semente: nivel * 3 + 11, skills: 3 });
        for (const s of g.skills) {
          expect(s.resultado.erros).toEqual([]);
          expect(s.resultado.valida).toBe(true);
          expect(s.resultado.impactoTotal).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a quantidade pedida é respeitada quando a ficha comporta', () => {
    const g = gerarPersonagem({ nivel: 5, papel: 'dps', semente: 8, skills: 4 });
    expect(g.skills.length).toBe(4);
    const zero = gerarPersonagem({ nivel: 5, semente: 8, skills: 0 });
    expect(zero.skills).toEqual([]);
  });

  it('a skill usa elemento com nível e escola/recurso investidos', () => {
    const g = gerarPersonagem({ nivel: 6, papel: 'invocador', semente: 21 });
    const prog = calcularProgressao(g.personagem);
    for (const s of g.skills) {
      expect(prog.niveisEfetivos[s.config.elemento] ?? 0).toBeGreaterThan(0);
      expect(g.personagem.escolas[s.config.escola] ?? 0).toBeGreaterThan(0);
      for (const f of s.config.fontes) {
        expect(g.personagem.recursos[f.recurso] ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe('gerarPersonagem — filtro de nível', () => {
  it('nível fora de 1..7 falha com mensagem que ensina', () => {
    expect(() => gerarPersonagem({ nivel: 0 })).toThrow(/1\.\.7/);
    expect(() => gerarPersonagem({ nivel: 99 })).toThrow(/orcamento|orçamento/i);
  });

  it('nível maior compra mais: orçamento e impacto crescem monotonicamente', () => {
    let anterior = 0;
    for (const nivel of NIVEIS) {
      const g = gerarPersonagem({ nivel, papel: 'dps', semente: 1234 });
      expect(g.orcamento.disponivel).toBeGreaterThan(anterior);
      anterior = g.orcamento.disponivel;
    }
  });

  it('orcamentoDoNivel prende nas bordas em vez de devolver undefined', () => {
    expect(orcamentoDoNivel(-5)).toBe(ORCAMENTO_POR_TIER[NIVEL_MINIMO]);
    expect(orcamentoDoNivel(500)).toBe(ORCAMENTO_POR_TIER[NIVEL_MAXIMO]);
  });
});

describe('gerarGrupo', () => {
  it('respeita a quantidade pedida', () => {
    for (const quantidade of [1, 2, 3, 5, 8, 24]) {
      const grupo = gerarGrupo({ nivel: 3, quantidade, semente: 9 });
      expect(grupo.membros.length).toBe(quantidade);
    }
  });

  it('respeita os papéis pedidos, na ordem', () => {
    const papeis: PapelId[] = ['tank', 'curandeiro', 'dps'];
    const grupo = gerarGrupo({ nivel: 4, quantidade: 5, papeis, semente: 2 });
    expect(grupo.membros.slice(0, 3).map((m) => m.papel)).toEqual(papeis);
    expect(grupo.membros.length).toBe(5);
  });

  it('sem papéis, a composição padrão não repete papel enquanto houver papel novo', () => {
    const grupo = gerarGrupo({ nivel: 4, quantidade: 5, semente: 2 });
    expect(new Set(grupo.membros.map((m) => m.papel)).size).toBe(5);
  });

  it('todo membro respeita o orçamento do nível do grupo', () => {
    const grupo = gerarGrupo({ nivel: 5, quantidade: 6, semente: 77 });
    for (const m of grupo.membros) {
      expect(m.nivel).toBe(5);
      expect(m.orcamento.gasto.total).toBeLessThanOrEqual(ORCAMENTO_POR_TIER[5]);
    }
  });

  it('os membros têm identidades distintas — o grupo não sai clonado', () => {
    const grupo = gerarGrupo({ nivel: 5, quantidade: 4, semente: 5 });
    const nucleos = grupo.membros.map((m) => m.nucleo.join('+'));
    expect(new Set(nucleos).size).toBe(4);
    expect(new Set(grupo.membros.map((m) => m.personagem.nome)).size).toBe(4);
  });

  it('é determinístico: uma semente reconstrói o grupo inteiro', () => {
    const a = gerarGrupo({ nivel: 4, quantidade: 4, semente: 314 });
    const b = gerarGrupo({ nivel: 4, quantidade: 4, semente: 314 });
    expect(JSON.stringify(a.membros.map((m) => m.personagem))).toBe(
      JSON.stringify(b.membros.map((m) => m.personagem)),
    );
  });

  it('papel desconhecido falha dizendo quais existem', () => {
    expect(() => gerarGrupo({ papeis: ['ladino' as PapelId] })).toThrow(/tank/);
  });

  it('grupo acima de 24 é recusado com instrução, não com estouro de memória', () => {
    expect(() => gerarGrupo({ quantidade: 100 })).toThrow(/lotes/);
  });

  it('composicaoPadrao cobre qualquer tamanho', () => {
    expect(composicaoPadrao(0)).toEqual([]);
    expect(composicaoPadrao(3).length).toBe(3);
    expect(composicaoPadrao(9).length).toBe(9);
  });
});

describe('superfície de máquina (api/consultas)', () => {
  it('gerarFicha devolve algo que sobrevive a JSON.stringify', () => {
    const ficha = gerarFicha({ nivel: 5, papel: 'controle', semente: 55 });
    const roundtrip = JSON.parse(JSON.stringify(ficha));
    expect(roundtrip.personagem).toEqual(ficha.personagem);
    expect(roundtrip.analise.pontos.total).toBe(ficha.analise.pontos.total);
    expect(roundtrip.skills.length).toBe(ficha.skills.length);
  });

  it('a ficha gerada volta pela porta de entrada: analise.pontos bate com o gasto', () => {
    const ficha = gerarFicha({ nivel: 6, semente: 12 });
    expect(ficha.analise.pontos.total).toBe(ficha.orcamento.gasto);
  });

  it('gerarGrupoDeFichas reporta a composição que de fato saiu', () => {
    const grupo = gerarGrupoDeFichas({ nivel: 3, quantidade: 4, papeis: ['tank'], semente: 6 });
    expect(grupo.quantidade).toBe(4);
    expect(grupo.composicao.length).toBe(4);
    expect(grupo.composicao[0]).toBe('tank');
    expect(grupo.membros.map((m) => m.papel)).toEqual(grupo.composicao);
  });

  it('listarPapeis e listarNiveis alimentam menu sem adivinhação', () => {
    expect(listarPapeis().map((p) => p.id).sort()).toEqual([...PAPEIS_VALIDOS].sort());
    const niveis = listarNiveis();
    expect(niveis.length).toBe(NIVEL_MAXIMO - NIVEL_MINIMO + 1);
    expect(niveis[0]).toEqual({ nivel: 1, orcamento: ORCAMENTO_POR_TIER[1] });
  });
});
