// Tira de public/data/exercises.json o que as listas não usam e guarda à parte o que só uma tela precisa:
//  - `instructions` (passos em inglês, 580 KB) sai; só os dos exercícios SEM tradução em português vão para
//    data/i18n/en.instructions.json, lido só quando a tela de um deles é aberta
//    (data/i18n/pt-BR.instructions.json também é lido só na tela do exercício);
//  - `images` (nomes de arquivo) sai: o app monta o caminho da foto pelo id do exercício.
// Assim o app baixa ~370 KB em vez de 1 MB ao abrir. É seguro rodar de novo: se o arquivo já foi dividido, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';

const caminho = 'public/data/exercises.json';
const lista = JSON.parse(readFileSync(caminho, 'utf8'));
if (!lista.some((e) => 'instructions' in e || 'images' in e)) {
  console.log('exercises.json já está dividido; nada a fazer');
  process.exit(0);
}
const pt = JSON.parse(readFileSync('public/data/i18n/pt-BR.instructions.json', 'utf8'));
const ingles = {};
for (const e of lista) if (e.instructions?.length && !pt[e.id]?.length) ingles[e.id] = e.instructions;
const enxuta = lista.map(({ instructions, images, ...resto }) => resto);
writeFileSync('public/data/i18n/en.instructions.json', JSON.stringify(ingles));
writeFileSync(caminho, JSON.stringify(enxuta));
console.log(`${enxuta.length} exercícios; ${Object.keys(ingles).length} com passos em inglês sem tradução guardados à parte`);
