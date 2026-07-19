/**
 * Gera sigilos PNG para elementos, recursos e escolas.
 *
 * Cada sigilo é composto em SVG (fundo escuro arredondado + glow radial na
 * cor do tema + anel + glifo central) e rasterizado para PNG via resvg.
 * A saída vai para assets/sigilos/*.png e é embutida como data URI no build.
 *
 * Sem dependência de rede nem de modelo de imagem — arte procedural coesa.
 */
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, 'assets', 'sigilos');
mkdirSync(saida, { recursive: true });

const S = 256;   // resolução de composição (nitidez)
const OUT = 192; // resolução final do PNG
const cx = S / 2;
const cy = S / 2;

/** Aclara/escurece um hex por um fator (-1..1). */
function ajustar(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Glifos: cada função devolve markup SVG desenhado numa viewbox 256, já na
 * cor clara `c`. Traços grossos e formas cheias para leitura em miniatura.
 */
const stroke = (d, c, w = 12) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d, c) => `<path d="${d}" fill="${c}"/>`;

const GLIFOS = {
  // fogo — chama
  fogo: (c) =>
    fill('M128 60 C150 92 172 108 172 146 a44 44 0 0 1-88 0 c0-20 12-32 20-44 c6 14 16 18 16 30 c0-24-8-40 4-72 Z', c),
  // agua — gota
  agua: (c) => fill('M128 60 C150 100 176 128 176 156 a48 48 0 0 1-96 0 C80 128 106 100 128 60 Z', c),
  // terra — montanha em losango
  terra: (c) =>
    fill('M128 72 L188 176 L68 176 Z', c) +
    `<path d="M128 118 L152 160 L104 160 Z" fill="${ajustar('#000000', 0)}" fill-opacity="0.28"/>`,
  // ar — redemoinho
  ar: (c) =>
    stroke('M76 104 C120 84 168 96 168 124 C168 148 116 148 116 128 C116 116 140 116 148 124', c, 12) +
    stroke('M92 168 C136 188 184 172 180 148', c, 12),
  // eletricidade — raio
  eletricidade: (c) => fill('M140 56 L92 140 L124 140 L108 200 L172 116 L138 116 Z', c),
  // arcano — estrela de oito pontas
  arcano: (c) => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 76 : 30;
      d += `${i ? 'L' : 'M'}${(cx + Math.cos(a - Math.PI / 2) * r).toFixed(1)} ${(cy + Math.sin(a - Math.PI / 2) * r).toFixed(1)} `;
    }
    return fill(d + 'Z', c);
  },
  // sombra — lua crescente
  sombra: (c) =>
    `<path d="M172 128 a56 56 0 1 1-40-54 a44 44 0 1 0 40 54 Z" fill="${c}"/>`,
  // luz — sol raiado
  luz: (c) => {
    let raios = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      raios += stroke(
        `M${(cx + Math.cos(a) * 60).toFixed(1)} ${(cy + Math.sin(a) * 60).toFixed(1)} L${(cx + Math.cos(a) * 84).toFixed(1)} ${(cy + Math.sin(a) * 84).toFixed(1)}`,
        c,
        9,
      );
    }
    return raios + `<circle cx="${cx}" cy="${cy}" r="34" fill="${c}"/>`;
  },
  // vileza — tridente/chifres
  vileza: (c) =>
    stroke('M128 72 L128 184', c, 12) +
    stroke('M88 96 C88 140 108 150 128 150 C148 150 168 140 168 96', c, 12) +
    stroke('M88 96 L82 74 M168 96 L174 74 M128 150 L128 132', c, 12),
  // morte — caveira simplificada
  morte: (c) =>
    fill('M128 64 C92 64 72 90 72 122 c0 20 10 30 20 38 l0 20 l72 0 l0-20 c10-8 20-18 20-38 C184 90 164 64 128 64 Z', c) +
    `<circle cx="108" cy="120" r="12" fill="#000" fill-opacity="0.55"/><circle cx="148" cy="120" r="12" fill="#000" fill-opacity="0.55"/><path d="M122 150 l6 -14 l6 14 Z" fill="#000" fill-opacity="0.5"/>`,
  // vida — folha
  vida: (c) =>
    fill('M128 60 C176 76 184 140 128 196 C72 140 80 76 128 60 Z', c) +
    `<path d="M128 76 L128 184" stroke="#000" stroke-opacity="0.28" stroke-width="8" stroke-linecap="round"/>`,
  // vigor — punho estilizado
  vigor: (c) =>
    fill('M92 108 h72 c10 0 16 8 16 18 v34 c0 16-14 28-32 28 h-40 c-16 0-24-10-24-24 v-40 c0-8 4-16 12-16 Z', c) +
    stroke('M100 108 v-18 M120 108 v-24 M140 108 v-24 M160 116 v-14', c, 10),
  // marcial — espadas cruzadas
  marcial: (c) =>
    stroke('M72 76 L176 180 M184 72 L80 176', c, 12) +
    stroke('M64 96 L92 68 M192 96 L164 68', c, 10),
};

// recursos (glifos reaproveitam a linguagem visual)
GLIFOS.mana = (c) => `<circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="${c}" stroke-width="12"/><circle cx="${cx}" cy="${cy}" r="20" fill="${c}"/>`;
GLIFOS.fe = GLIFOS.luz;
GLIFOS.furia = GLIFOS.vigor;
GLIFOS.soullink = (c) =>
  stroke('M104 128 a24 24 0 1 1 48 0 a24 24 0 1 1-48 0', c, 12) +
  fill('M128 150 C150 172 168 150 168 132 a20 20 0 0 0-40 0 a20 20 0 0 0-40 0 C88 150 106 172 128 194 Z', c);
GLIFOS.ressonancia = (c) => {
  let d = '';
  for (const r of [30, 50, 70]) d += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="8" stroke-opacity="${(r === 30 ? 1 : r === 50 ? 0.7 : 0.4)}"/>`;
  return d;
};

// escolas
GLIFOS.combate_fisico = GLIFOS.marcial;
GLIFOS.longo_alcance = (c) =>
  stroke('M72 184 C72 116 120 72 184 72', c, 12) +
  stroke('M72 184 L184 72', c, 8) +
  fill('M184 72 l-30 6 l24 24 Z', c);
GLIFOS.evocacao = GLIFOS.arcano;
GLIFOS.conjuracao = (c) => fill('M128 56 L160 112 L128 96 L96 112 Z', c) + GLIFOS.mana(c);
GLIFOS.benca = GLIFOS.luz;
GLIFOS.maldicao = GLIFOS.sombra;

function sigilo(cor, glifoId) {
  const claro = ajustar(cor, 0.55);
  const glifo = (GLIFOS[glifoId] ?? GLIFOS.arcano)(ajustar(cor, 0.72));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${ajustar(cor, -0.45)}"/>
      <stop offset="60%" stop-color="#1a1626"/>
      <stop offset="100%" stop-color="#0e0b16"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="50%">
      <stop offset="0%" stop-color="${cor}" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="${cor}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="8" y="8" width="${S - 16}" height="${S - 16}" rx="40" fill="url(#bg)" stroke="${ajustar(cor, -0.2)}" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="96" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="92" fill="none" stroke="${claro}" stroke-width="2" stroke-opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="82" fill="none" stroke="${claro}" stroke-width="1" stroke-opacity="0.2" stroke-dasharray="2 6"/>
  ${glifo}
</svg>`;
}

async function render(nome, cor, glifoId) {
  const svg = sigilo(cor, glifoId);
  const bruto = new Resvg(svg, { fitTo: { mode: 'width', value: S } }).render().asPng();
  const png = await sharp(bruto)
    .resize(OUT, OUT)
    .png({ palette: true, colors: 128, compressionLevel: 9, effort: 10 })
    .toBuffer();
  writeFileSync(join(saida, `${nome}.png`), png);
  return png.length;
}

// paleta (mesma da UI)
const CORES = {
  fogo: '#e2603f', agua: '#4f8fd0', terra: '#a07840', ar: '#8fc4c9',
  eletricidade: '#d9bd3e', arcano: '#8b7ad6', sombra: '#6b5a8a', luz: '#d9c878',
  vileza: '#b04a6e', morte: '#8a9184', vida: '#5fae82', vigor: '#c07a50', marcial: '#9aa3b5',
  mana: '#4f8fd0', fe: '#d9c878', furia: '#c0503f', soullink: '#b04a6e', ressonancia: '#8b7ad6',
  combate_fisico: '#c07a50', longo_alcance: '#8fc4c9', evocacao: '#8b7ad6',
  conjuracao: '#5b9ad0', benca: '#d9c878', maldicao: '#6b5a8a',
};

const alvo = process.argv[2];
let total = 0;
let n = 0;
for (const [id, cor] of Object.entries(CORES)) {
  if (alvo && id !== alvo) continue;
  total += await render(id, cor, id);
  n++;
}
console.log(`${n} sigilos gerados em assets/sigilos (${(total / 1024).toFixed(0)} KiB no total)`);

// gera o módulo TS com os data URIs embutidos (consumido pela UI/bundle)
import { readdirSync, readFileSync } from 'node:fs';
const arquivos = readdirSync(saida).filter((f) => f.endsWith('.png')).sort();
const entradas = arquivos
  .map((f) => {
    const id = f.replace('.png', '');
    const b64 = readFileSync(join(saida, f)).toString('base64');
    return `  ${JSON.stringify(id)}: 'data:image/png;base64,${b64}',`;
  })
  .join('\n');
const modulo = `/* GERADO por scripts/gerar-sigilos.mjs — não editar à mão. */
export const SIGILOS: Record<string, string> = {
${entradas}
};

export function sigilo(id: string): string | undefined {
  return SIGILOS[id];
}
`;
writeFileSync(join(raiz, 'src', 'ui', 'sigilos.ts'), modulo);
console.log(`módulo src/ui/sigilos.ts gerado (${arquivos.length} sigilos)`);
