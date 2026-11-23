// Acrescenta à base os exercícios de tools/novos_exercicios.json (escritos para este projeto, sem foto)
// e corrige o músculo principal de alguns exercícios que estavam no grupo errado.
// Escreve em public/data/exercises.json, i18n/pt-BR.names.json e i18n/pt-BR.instructions.json.
// É seguro rodar de novo: ids que já existem são pulados e as correções só valem uma vez.
import { readFileSync, writeFileSync } from 'node:fs';

const lerJson = (c) => JSON.parse(readFileSync(c, 'utf8'));
const dados = 'public/data/exercises.json';
const nomes = 'public/data/i18n/pt-BR.names.json';
const passos = 'public/data/i18n/pt-BR.instructions.json';
const rotulos = lerJson('public/data/i18n/pt-BR.labels.json');

const lista = lerJson(dados);
const pt = lerJson(nomes);
const ins = lerJson(passos);
const novos = lerJson('tools/novos_exercicios.json');
const ids = new Set(lista.map((e) => e.id));

const erros = [];
const checa = (n, ok, msg) => ok || erros.push(`${n.id}: ${msg}`);
let adicionados = 0;
for (const n of novos) {
  if (ids.has(n.id)) continue;
  checa(n, !n.equipment || n.equipment in rotulos.equipment, `equipamento inválido (${n.equipment})`);
  checa(n, n.category in rotulos.category, 'categoria inválida');
  checa(n, n.level in rotulos.level, 'nível inválido');
  checa(n, !n.force || n.force in rotulos.force, 'força inválida');
  checa(n, !n.mechanic || n.mechanic in rotulos.mechanic, 'mecânica inválida');
  checa(n, [...n.p, ...n.s].every((m) => m in rotulos.muscles), 'músculo inválido');
  checa(n, n.p.length > 0 && n.passos?.length >= 2 && n.pt, 'faltam músculo, nome ou passos');
  ids.add(n.id);
  lista.push({
    name: n.name, force: n.force ?? null, level: n.level, mechanic: n.mechanic ?? null,
    equipment: n.equipment ?? null, primaryMuscles: n.p, secondaryMuscles: n.s, category: n.category, id: n.id,
  });
  pt[n.id] = n.pt;
  ins[n.id] = n.passos;
  adicionados++;
}
if (erros.length) {
  console.error(erros.join('\n'));
  process.exit(1);
}

// Exercícios que a base original marcava no músculo errado.
const correcoes = {
  Cable_Hip_Adduction: { primaryMuscles: ['adductors'], secondaryMuscles: [] },
  Reverse_Hyperextension: { primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'lower back'] },
};
let corrigidos = 0;
for (const e of lista) {
  const c = correcoes[e.id];
  if (c && JSON.stringify(e.primaryMuscles) !== JSON.stringify(c.primaryMuscles)) {
    Object.assign(e, c);
    corrigidos++;
  }
}

writeFileSync(dados, JSON.stringify(lista));
writeFileSync(nomes, JSON.stringify(pt, null, 1));
writeFileSync(passos, JSON.stringify(ins));
console.log(`${adicionados} exercícios novos, ${corrigidos} corrigidos; total ${lista.length}`);
