import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ELEMENTOS } from '../src/registry/elementos';
import { FAMILIAS, type FamiliaCriatura } from '../src/registry/criaturas';
import { MATERIAIS_CRIATURA } from '../src/registry/profissoes';

const taxonomyPath = join(__dirname, '..', 'taxonomy.json');

describe('taxonomy.json export', () => {
  it('exists and is in sync with the registries it is generated from', () => {
    let raw: string;
    try {
      raw = readFileSync(taxonomyPath, 'utf-8');
    } catch {
      throw new Error('taxonomy.json is missing — run `npm run export:taxonomy` and commit it.');
    }
    const taxonomy = JSON.parse(raw);

    const elementIds = new Set(taxonomy.elements.map((e: { id: string }) => e.id));
    for (const id of Object.keys(ELEMENTOS)) {
      expect(elementIds.has(id), `element "${id}" missing from taxonomy.json`).toBe(true);
    }
    expect(taxonomy.elements.length).toBe(Object.keys(ELEMENTOS).length);

    const familyIds = new Set(taxonomy.families.map((f: { id: string }) => f.id));
    for (const id of Object.keys(FAMILIAS)) {
      expect(familyIds.has(id), `family "${id}" missing from taxonomy.json`).toBe(true);
    }
    expect(taxonomy.families.length).toBe(Object.keys(FAMILIAS).length);
  });
});

describe('the 3 new creature families are fully wired, not just typed', () => {
  const newFamilies: FamiliaCriatura[] = ['gigante', 'geleia', 'humanoide'];

  it('have an entry in FAMILIAS', () => {
    for (const f of newFamilies) {
      expect(FAMILIAS[f]).toBeDefined();
      expect(FAMILIAS[f].nome.length).toBeGreaterThan(0);
    }
  });

  it('have a crafting material in MATERIAIS_CRIATURA', () => {
    for (const f of newFamilies) {
      expect(MATERIAIS_CRIATURA[f]).toBeDefined();
      expect(MATERIAIS_CRIATURA[f].familia).toBe(f);
      expect(MATERIAIS_CRIATURA[f].qualidadePorPoder).toBeGreaterThan(0);
    }
  });
});
