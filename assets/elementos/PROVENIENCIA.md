# Ícones de elemento — de onde vieram

**137 PNGs** `el-<id>.png`, 128×128 com alfa. **Arte gerada fora deste
projeto** — diferente de `assets/sigilos/`, que é procedural
(`scripts/gerar-sigilos.mjs` desenha em SVG e rasteriza).

| | |
|---|---|
| origem | pixel art gerada via Gemini, campanha de arte do Soulmon (27/ago/2026) |
| prompts e histórico | `D:\Soulmon\scripts-arte\` — repo git local, sem remoto |
| cópia sem quantizar | `D:\Soulmon\_gemini_out\entrega7\icones\` |
| também instalada em | `Soulmon/repo/src/assets/soulmon/elementos/` |

## O que cada ícone é

O **objeto** que representa o elemento — caveira para `veneno`, ampulheta para
`areia`, foice para `ceifa`. Não é efeito de combate.

A cor de cada um veio do mesmo descritor que gerou os sprites de FX do Soulmon,
então o ícone e o FX de um elemento falam a mesma paleta.

## Quantização — não regenere sem ela

Os PNGs aqui estão em **paleta de 64 cores**, ~89% menores que os originais
(2,50 MB → 0,28 MB no conjunto). Sem isso, `src/ui/iconesElementos.ts` passaria
de 3 MB e o `simulador.html` iria de 0,6 MB para ~4 MB.

A perda é imperceptível: a arte tem milhares de cores quase-duplicadas (o
gerador produz anti-aliasing mesmo quando o prompt proíbe) que colapsam sem
diferença visível — conferido lado a lado antes de adotar.

Se recopiar do `_gemini_out`, quantize:

```js
sharp(src).png({ palette: true, colours: 64, effort: 10, compressionLevel: 9 })
```

## Cobertura: 153 dos 169 elementos

| conjunto | arte | fonte |
|---|---|---|
| 17 base | ✅ | `assets/sigilos/` (procedural) |
| 136 derivados de PAR | ✅ | esta pasta |
| 13 derivados de 3+ elementos | ❌ | — |
| 3 especiais (`primordial`, `ciclo`, `nulo`) | ❌ | — |

Os 16 sem arte ficaram de fora porque a campanha cobriu a lista que o Soulmon
vendoriza (`derivedElements.ts`), que só tem os 136 pares. São eles:

`chama_demoniaca`, `paradoxo`, `big_bang`, `sinfonia`, `furacao`, `selva`,
`abominacao`, `eclipse`, `reencarnacao`, `sobrecarga`, `ascensao`, `nucleo`,
`avatar_de_guerra`, `primordial`, `ciclo`, `nulo`.

⚠️ As combinações de 3 e 4 elementos **geradas sob demanda** em
`src/registry/combinacoes.ts` (~3000) não têm `ElementoDef` e portanto não têm
como ter arte por id. Para elas seria preciso uma REGRA de composição (ex.:
sobrepor os ícones dos componentes), não um arquivo.

## O `neutro` está aqui mas é inerte neste projeto

`el-neutro.png` cobre o caso "sem elemento" do Soulmon. **Não existe elemento
`neutro` no registro daqui**, então `iconeElemento('neutro')` nunca é chamado
pela UI deste projeto.

Não confundir com `nulo`: apesar do nome sugerir o mesmo, `nulo` é *"o elemento
de quem dominou todos"* (receita de 17) — o oposto de ausência de elemento.
Aliasar um no outro seria errado.
