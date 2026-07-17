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
  it('vida alimenta os elementos primais (5 pontos → +1 em cada)', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'vida', 25);
    const prog = calcularProgressao(p);
    for (const primal of ['fogo', 'agua', 'terra', 'ar', 'eletricidade'] as const) {
      expect(prog.niveisEfetivos[primal]).toBe(5);
    }
    // vida também dá um pouco de luz (razão 0.1)
    expect(prog.niveisEfetivos.luz).toBe(2);
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

  it('derivados não aceitam pontos diretos', () => {
    const p = criarPersonagem('t');
    expect(() => investirElemento(p, 'lava', 1)).toThrow(/derivado/);
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
    investirElemento(p, 'vileza', 14); // +1 vem do transbordo de... nada: precisa direto
    investirElemento(p, 'fogo', 10); // fogo → vileza cobre o que falta
    investirEscola(p, 'evocacao', 15);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.vileza).toBe(15);
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
