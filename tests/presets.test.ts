/**
 * O contrato das classes prontas.
 *
 * O teste central é um só: TODO preset cumpre o que promete. É ele que dá o
 * direito de a lista crescer — sem isso, o campo `promete` seria comentário, e
 * um preset que aponta para um arquétipo inalcançável entraria em silêncio.
 */
import { describe, expect, it } from 'vitest';
import { PRESETS, PRESETS_POR_ID, ROTULO_PAPEL } from '../src/registry/presets';
import {
  custoDe,
  materializarPreset,
  verificarPreset,
  verificarPresets,
} from '../src/engine/presets';
import { calcularSkill } from '../src/engine/skills';
import { calcularFusao } from '../src/engine/fusao';
import { ARQUETIPOS } from '../src/registry/arquetipos';
import { elementoDef } from '../src/registry/combinacoes';

describe('todo preset cumpre o que promete', () => {
  it('a lista inteira passa na verificação, sem um único erro', () => {
    const erros = verificarPresets().filter((p) => p.severidade === 'erro');
    expect(erros.map((e) => `${e.presetId}: ${e.mensagem}`)).toEqual([]);
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))('%s é íntegro', (_id, def) => {
    expect(verificarPreset(def).filter((p) => p.severidade === 'erro')).toEqual([]);
  });

  it('cada preset desbloqueia nominalmente os arquétipos que declara', () => {
    for (const def of PRESETS) {
      const m = materializarPreset(def);
      const abertos = new Set(m.progressao.arquetipos.map((a) => a.id));
      for (const id of def.promete.arquetipos) {
        expect(ARQUETIPOS[id], `${def.id} cita arquétipo inexistente ${id}`).toBeTruthy();
        expect(abertos.has(id), `${def.id} não abre ${id}`).toBe(true);
      }
    }
  });

  it('a skill de exemplo de todo preset é lançável pela própria ficha', () => {
    for (const def of PRESETS) {
      const m = materializarPreset(def);
      const r = calcularSkill(m.personagem, m.progressao, m.skill);
      expect(r.valida, `${def.id}: ${r.erros.join('; ')}`).toBe(true);
      expect(r.impactoTotal).toBeGreaterThan(0);
    }
  });

  it('toda fusão de exemplo é executável', () => {
    const comFusao = PRESETS.filter((p) => p.fusao);
    expect(comFusao.length).toBeGreaterThan(0);
    for (const def of comFusao) {
      const m = materializarPreset(def);
      const r = calcularFusao(m.personagem, m.progressao, m.fusao!);
      expect(r.valida, `${def.id}: ${r.erros.join('; ')}`).toBe(true);
    }
  });
});

describe('a montagem é determinística e isolada', () => {
  it('materializar duas vezes dá a mesma ficha', () => {
    for (const def of PRESETS) {
      const a = materializarPreset(def);
      const b = materializarPreset(def);
      expect(a.personagem).toEqual(b.personagem);
      expect(a.custo).toEqual(b.custo);
    }
  });

  it('cada materialização devolve um objeto novo — a UI muta a ficha que recebe', () => {
    const def = PRESETS_POR_ID.get('lavamante')!;
    const a = materializarPreset(def);
    const b = materializarPreset(def);
    expect(a.personagem).not.toBe(b.personagem);
    a.personagem.elementos.fogo = 999;
    expect(b.personagem.elementos.fogo).not.toBe(999);
    // e o próprio registro não foi tocado
    expect(def.elementos.fogo).toBe(14);
  });

  it('um preset defeituoso vira lista de problemas, nunca uma exceção', () => {
    const quebrado = {
      ...PRESETS[0],
      id: 'quebrado',
      elementos: { lava: 10 } as never, // derivado não aceita pontos diretos
      promete: { arquetipos: ['arquetipo_que_nao_existe'] },
    };
    expect(() => materializarPreset(quebrado)).not.toThrow();
    const problemas = verificarPreset(quebrado);
    expect(problemas.some((p) => p.tipo === 'investimento_recusado')).toBe(true);
    expect(problemas.some((p) => p.tipo === 'arquetipo_inexistente')).toBe(true);
  });
});

describe('a lista é navegável e sem duplicata', () => {
  it('ids e nomes são únicos', () => {
    const ids = PRESETS.map((p) => p.id);
    const nomes = PRESETS.map((p) => p.nome);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('todo papel do rótulo tem pelo menos um preset', () => {
    for (const papel of Object.keys(ROTULO_PAPEL)) {
      expect(
        PRESETS.some((p) => p.papel === papel),
        `nenhum preset com papel ${papel}`,
      ).toBe(true);
    }
  });

  it('as três complexidades estão povoadas', () => {
    for (const c of [1, 2, 3] as const) {
      expect(PRESETS.filter((p) => p.complexidade === c).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('nenhum grupo da galeria passa de 12 cards — acima disso a lista vira parede', () => {
    // O benchmark é consistente: nenhum jogo grande expõe mais de ~12 opções
    // de partida numa lista plana. A galeria agrupa por papel, então o teto
    // que importa é o do GRUPO, não o da lista inteira.
    const porPapel = new Map<string, number>();
    for (const p of PRESETS) porPapel.set(p.papel, (porPapel.get(p.papel) ?? 0) + 1);
    for (const [papel, n] of porPapel) {
      expect(n, `o papel ${papel} tem ${n} presets`).toBeLessThanOrEqual(12);
    }
  });

  it('a descrição começa com verbo e cabe num card', () => {
    for (const p of PRESETS) {
      expect(p.descricao.length, `${p.id} tem descrição longa demais`).toBeLessThanOrEqual(110);
      // "Fogo + Terra em erupções" era receita antes de promessa; a primeira
      // palavra tem de ser o que a classe FAZ
      const primeira = p.descricao.split(' ')[0];
      expect(primeira[0]).toBe(primeira[0].toUpperCase());
      expect(p.ensina.length).toBeGreaterThan(20);
    }
  });
});

describe('o custo de cada preset é honesto', () => {
  it('o custo declarado bate com a soma dos investimentos', () => {
    for (const def of PRESETS) {
      const c = custoDe(def);
      const m = materializarPreset(def);
      const soma = (o: Partial<Record<string, number>>) =>
        Object.values(o).reduce<number>((a, n) => a + (n ?? 0), 0);
      expect(
        soma(m.personagem.elementos) + soma(m.personagem.escolas) + soma(m.personagem.recursos),
        def.id,
      ).toBe(c.atributos);
      expect(soma(m.personagem.talentos), def.id).toBe(c.talentos);
    }
  });

  it('a complexidade declarada corresponde ao custo real', () => {
    // Um preset marcado "Simples" que custa 120 pontos mente para quem
    // escolhe. Os tetos subiram de 70/95 para 80/105 quando a base caiu de 17
    // para 13: elementos que eram par (mínimo 10 em duas bases) viraram tripla
    // (mínimo 15 em três), então a MESMA fantasia passou a custar mais. O que
    // a complexidade mede continua sendo quantas peças a pessoa administra,
    // não o preço — e o Paladino segue administrando uma ideia só.
    for (const def of PRESETS) {
      const c = custoDe(def).atributos;
      if (def.complexidade === 1) expect(c, def.id).toBeLessThanOrEqual(80);
      if (def.complexidade === 2) expect(c, def.id).toBeLessThanOrEqual(105);
    }
  });
});

describe('os presets cobrem o conteúdo que o sistema ganhou', () => {
  it('há preset usando combinação de 3 e de 4 componentes', () => {
    const aridades = PRESETS.map((def) => {
      const d = elementoDef(def.skill.elemento);
      return d?.receita?.length ?? 1;
    });
    expect(aridades.some((n) => n === 3)).toBe(true);
    expect(aridades.some((n) => n === 4)).toBe(true);
  });

  it('há preset com modificadores encadeados', () => {
    expect(PRESETS.some((p) => (p.skill.modificadores?.length ?? 0) >= 3)).toBe(true);
  });

  it('há preset com profissões e preset com bestiário', () => {
    expect(PRESETS.some((p) => Object.keys(p.profissoes ?? {}).length > 0)).toBe(true);
    expect(PRESETS.some((p) => (p.bestiario?.length ?? 0) > 0)).toBe(true);
  });

  it('há preset que exercita a capacidade de arquétipo', () => {
    const comCapacidade = PRESETS.filter((p) => p.skill.capacidadeExigida);
    expect(comCapacidade.length).toBeGreaterThanOrEqual(20);
  });
});
