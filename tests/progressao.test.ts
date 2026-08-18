import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { ELEMENTOS, type ElementoId } from '../src/registry/elementos';

describe('sinergias de transbordo', () => {
  it('a sinergia é de mão dupla: 5 de vida → 1 em cada clássico, e 1 em cada → 1 de vida', () => {
    // A regra do dono do projeto, nas duas direções. A volta só fecha porque o
    // transbordo SOMA antes de arredondar: quatro contribuições de 0.25 viram
    // 1, enquanto arredondar cada uma isolada daria zero.
    const ida = criarPersonagem('t');
    investirElemento(ida, 'vida', 25);
    const progIda = calcularProgressao(ida);
    for (const classico of ['fogo', 'agua', 'terra', 'ar'] as const) {
      expect(progIda.niveisEfetivos[classico]).toBe(5);
    }
    const volta = criarPersonagem('t');
    for (const classico of ['fogo', 'agua', 'terra', 'ar'] as const) {
      investirElemento(volta, classico, 1);
    }
    expect(calcularProgressao(volta).niveisEfetivos.vida).toBe(1);

    const p = ida;
    const prog = progIda;
    // vida também dá um pouco de luz
    expect(prog.niveisEfetivos.luz).toBe(3);
  });

  it('fogo transborda para vileza', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 20);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.vileza).toBe(2);
  });
});

describe('elementos derivados', () => {
  it('lava exige fogo E terra no mínimo; nível = menor componente', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 15);
    expect(calcularProgressao(p).niveisEfetivos.lava).toBe(0);

    investirElemento(p, 'terra', 12);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.lava).toBe(12);
  });

  it('chama azul nasce de fogo + morte', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 14);
    investirElemento(p, 'morte', 13);
    expect(calcularProgressao(p).niveisEfetivos.chama_azul).toBe(13);
  });

  it('vida + morte libera equilíbrio', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'vida', 16);
    investirElemento(p, 'morte', 15);
    expect(calcularProgressao(p).niveisEfetivos.equilibrio).toBe(15);
  });

  it('nulo exige TODOS os elementos base nivelados', () => {
    const p = criarPersonagem('t');
    const bases = (Object.keys(ELEMENTOS) as ElementoId[]).filter(
      (id) => ELEMENTOS[id].tipo === 'base',
    );
    for (const id of bases.slice(0, -1)) investirElemento(p, id, 8);
    expect(calcularProgressao(p).niveisEfetivos.nulo).toBe(0);

    investirElemento(p, bases[bases.length - 1]!, 8);
    expect(calcularProgressao(p).niveisEfetivos.nulo).toBeGreaterThanOrEqual(8);
  });

  it('derivados não aceitam pontos diretos antes do DESTRAVE da cascata', () => {
    // A regra evoluiu com a alocação geracional (engine/cascata.ts): o
    // derivado continua recusando ponto direto numa ficha nova, mas passa a
    // aceitar depois de acumular passivos suficientes pela cascata.
    const p = criarPersonagem('t');
    expect(() => investirElemento(p, 'lava', 1)).toThrow(/destravado/);
  });
});

describe('arquétipos', () => {
  it('morte + evocação → necromante', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'morte', 10);
    investirEscola(p, 'evocacao', 10);
    const prog = calcularProgressao(p);
    expect(prog.arquetipos.map((a) => a.id)).toContain('necromante');
    expect(prog.capacidades.has('evocar_mortos_vivos')).toBe(true);
  });

  it('vida + evocação → verdejante (invoca plantas)', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'vida', 10);
    investirEscola(p, 'evocacao', 10);
    expect(calcularProgressao(p).capacidades.has('evocar_plantas')).toBe(true);
  });

  it('necromante + vileza → invoca demônios mortos', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'morte', 15);
    investirElemento(p, 'vileza', 12);
    investirElemento(p, 'fogo', 10); // fogo, sombra e morte transbordam para vileza
    investirEscola(p, 'evocacao', 15);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.vileza).toBeGreaterThanOrEqual(15);
    expect(prog.arquetipos.map((a) => a.id)).toContain('senhor_dos_mortos_vis');
  });

  it('evocação + combate físico + fúria → armas autônomas', () => {
    const p = criarPersonagem('t');
    investirEscola(p, 'evocacao', 12);
    investirEscola(p, 'combate_fisico', 12);
    investirRecurso(p, 'furia', 8);
    expect(calcularProgressao(p).capacidades.has('evocar_armas_autonomas')).toBe(true);
  });
});

describe('a teia de sinergias é de mão dupla por construção', () => {
  it('toda seta tem volta — não dá para declarar uma sinergia de mão única', async () => {
    // Sinergia é uma RELAÇÃO, não uma seta: se investir em Fogo fortalece a
    // Vida, investir em Vida fortalece o Fogo. Declarar as duas direções à mão
    // deixava metade se perder numa refatoração — foi o que aconteceu quando a
    // base caiu de 17 para 13 e sobraram setas apontando para elementos que
    // tinham virado derivados. `SINERGIAS` agora é GERADA de `LACOS_SINERGIA`.
    const { SINERGIAS } = await import('../src/registry/elementos');
    const semVolta = SINERGIAS.filter(
      (s) => !SINERGIAS.some((o) => o.para.includes(s.de) && s.para.includes(o.de)),
    );
    expect(semVolta.map((s) => `${s.de} → ${s.para.join(',')}`)).toEqual([]);
  });

  it('todo elemento base participa da teia, e nenhum é ilha', async () => {
    // 60 pontos em Morte tocavam só 2 das 13 bases; em Arcano, 8. Uma base sem
    // parceiros é uma base que nunca vale a primeira compra.
    const { LACOS_SINERGIA, elementosBase } = await import('../src/registry/elementos');
    const parceiros = new Map<string, Set<string>>();
    const ligar = (x: string, y: string): void => {
      if (!parceiros.has(x)) parceiros.set(x, new Set());
      parceiros.get(x)!.add(y);
    };
    for (const l of LACOS_SINERGIA) {
      for (const alvo of l.b) {
        ligar(l.a, alvo);
        ligar(alvo, l.a);
      }
    }
    for (const def of elementosBase()) {
      expect(parceiros.get(def.id)?.size ?? 0, `${def.id} tem poucos parceiros`).toBeGreaterThanOrEqual(3);
    }
  });

  it('nenhuma base irradia desproporcionalmente mais que as outras', async () => {
    // "Tudo bem não ficar idêntico" — mas 12× de diferença entre a base mais e
    // a menos conectada (Vida devolvia 100% do investimento de graça, Gravidade
    // 8%) significa que metade das bases nunca é a melhor primeira compra.
    const { LACOS_SINERGIA, elementosBase } = await import('../src/registry/elementos');
    const irradia = new Map<string, number>();
    const somar = (k: string, v: number): void => {
      irradia.set(k, (irradia.get(k) ?? 0) + v);
    };
    for (const l of LACOS_SINERGIA) {
      somar(l.a, l.ida * l.b.length);
      for (const alvo of l.b) somar(alvo, l.volta);
    }
    const valores = elementosBase().map((d) => irradia.get(d.id) ?? 0);
    expect(Math.min(...valores)).toBeGreaterThan(0.3);
    // Vida é hub por desenho (o laço com os quatro clássicos é a regra do dono
    // do projeto); o teto existe para que ela não vire a única compra.
    expect(Math.max(...valores) / Math.min(...valores)).toBeLessThanOrEqual(3);
  });
});
