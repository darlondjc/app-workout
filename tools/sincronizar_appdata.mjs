// Copia a versão e as novidades mais recentes do changelog para o `appData` do ngsw-config.json.
// O service worker entrega esse bloco ao app antigo quando a versão nova fica pronta, e é assim
// que o aviso de atualização consegue mostrar "o que há de novo" antes de atualizar.
// Roda sozinho antes de `npm run build` (script `prebuild`).
import { readFileSync, writeFileSync } from 'node:fs';

const lista = JSON.parse(readFileSync('public/data/changelog.json', 'utf8'));
const [atual] = lista;
if (!atual?.versao || !Array.isArray(atual.itens)) throw new Error('changelog.json inválido');

const cfg = JSON.parse(readFileSync('ngsw-config.json', 'utf8'));
cfg.appData = { versao: atual.versao, titulo: atual.titulo ?? '', novidades: atual.itens };
writeFileSync('ngsw-config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log(`appData sincronizado: versão ${atual.versao}`);
