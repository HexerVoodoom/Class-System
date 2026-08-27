/**
 * Gera o módulo TS com os ÍCONES DE ELEMENTO embutidos como data URI.
 *
 * Diferente de `gerar-sigilos.mjs`, que DESENHA os sigilos proceduralmente:
 * aqui a arte já existe como PNG em `assets/elementos/` (pixel art gerada
 * fora deste projeto, ver o cabeçalho de `assets/elementos/PROVENIENCIA.md`).
 * Este script só empacota — não cria arte.
 *
 * Por que embutir em base64 em vez de referenciar por caminho: o simulador é
 * um HTML de arquivo único (`scripts/build-simulador.mjs`), então tudo que a
 * UI usa precisa estar dentro do bundle. É a mesma razão de `sigilos.ts`.
 *
 * Os PNGs são quantizados para paleta de 64 cores ANTES de entrar aqui, o que
 * corta ~89% do peso sem diferença visível (a arte tem milhares de cores
 * quase-duplicadas que colapsam sem perda perceptível). Sem isso o módulo
 * passaria de 3 MB e inflaria o simulador de 0,6 MB para ~4 MB.
 *
 *   node scripts/gerar-icones-elementos.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'assets', 'elementos');
mkdirSync(origem, { recursive: true });

const arquivos = readdirSync(origem)
  .filter((f) => f.startsWith('el-') && f.endsWith('.png'))
  .sort();

if (arquivos.length === 0) {
  console.error('nenhum el-*.png em assets/elementos — nada a gerar');
  process.exit(1);
}

let total = 0;
const entradas = arquivos
  .map((f) => {
    // `el-vapor.png` → chave `vapor`, para casar com o id do ElementoDef.
    const id = f.slice(3, -4);
    const bytes = readFileSync(join(origem, f));
    total += bytes.length;
    return `  ${JSON.stringify(id)}: 'data:image/png;base64,${bytes.toString('base64')}',`;
  })
  .join('\n');

const modulo = `/* GERADO por scripts/gerar-icones-elementos.mjs — não editar à mão. */

/**
 * Ícone de cada elemento, indexado pelo id do \`ElementoDef\`.
 *
 * Cobre os 136 derivados e o \`neutro\`. Os 17 elementos BASE NÃO estão aqui —
 * eles têm sigilo procedural em \`sigilos.ts\`, e os dois se complementam: a UI
 * tenta o sigilo primeiro e cai neste mapa depois.
 */
export const ICONES_ELEMENTO: Record<string, string> = {
${entradas}
};

export function iconeElemento(id: string): string | undefined {
  return ICONES_ELEMENTO[id];
}
`;

const destino = join(raiz, 'src', 'ui', 'iconesElementos.ts');
writeFileSync(destino, modulo);
console.log(
  `módulo src/ui/iconesElementos.ts gerado (${arquivos.length} ícones, ` +
    `${(total / 1024).toFixed(0)} KiB de PNG → ${(Buffer.byteLength(modulo) / 1024).toFixed(0)} KiB de módulo)`,
);
