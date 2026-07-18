/**
 * Gera o simulador auto-contido:
 *  - simulador.html               → arquivo completo, abre direto no navegador
 *  - public/index.html            → cópia para deploy estático (Cloudflare Workers)
 *  - dist/simulador-artifact.html → fragmento (sem <html>/<head>/<body>)
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const resultado = await build({
  entryPoints: [join(raiz, 'src/ui/app.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
});
const js = resultado.outputFiles[0].text;

const template = readFileSync(join(raiz, 'src/ui/template.html'), 'utf8');
const [cabeca, corpo] = template.split('<!--BODY-->');
if (!corpo) throw new Error('Marcador <!--BODY--> não encontrado no template.');

const corpoComApp = corpo.replace('/*__APP__*/', () => js);

const completo = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cabeca.trim()}
</head>
<body>
${corpoComApp.trim()}
</body>
</html>
`;
writeFileSync(join(raiz, 'simulador.html'), completo);

mkdirSync(join(raiz, 'public'), { recursive: true });
writeFileSync(join(raiz, 'public/index.html'), completo);

mkdirSync(join(raiz, 'dist'), { recursive: true });
writeFileSync(join(raiz, 'dist/simulador-artifact.html'), `${cabeca.trim()}\n${corpoComApp.trim()}\n`);

console.log(`simulador.html gerado (${(completo.length / 1024).toFixed(0)} KiB)`);
