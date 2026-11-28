import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

// Testa o firestore.rules do repositório no emulador: os fluxos do app têm de passar e os ataques a grupos e ligações
// (conexoes) têm de ser negados. Rode com `npm install && npm test` dentro de tools/regras.

const chave = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

async function rodar(rotulo, arquivo) {
  const env = await initializeTestEnvironment({
    projectId: 'demo-regras',
    firestore: { rules: readFileSync(arquivo, 'utf8'), host: '127.0.0.1', port: 8089 },
  });
  const db = (u) => env.authenticatedContext(u).firestore();
  const sem = (f) => env.withSecurityRulesDisabled((c) => f(c.firestore()));
  const semear = () => sem(async (d) => {
    await setDoc(doc(d, 'grupos/G1'), { dono: 'owner', membros: ['owner', 'a', 'b', 'c'], pedidos: [], acesso: 'aberto', nome: 'G' });
    await setDoc(doc(d, 'grupos/G2'), { dono: 'owner', membros: ['owner'], pedidos: ['p1', 'p2'], acesso: 'aprovado', nome: 'G2' });
    await setDoc(doc(d, 'grupos/G3'), { dono: 'owner', membros: ['owner', 'a', 'b'], pedidos: [], acesso: 'aprovado', nome: 'G3' });
    await setDoc(doc(d, `conexoes/${chave('a', 'b')}`), { membros: ['a', 'b'], grupos: ['G1'] });
    await setDoc(doc(d, 'usuarios/b/sessoes/s1'), { id: 's1' });
  });
  const casos = [];
  const t = (nome, deveria, fn) => casos.push({ nome, deveria, fn });

  // ---- Fluxos legítimos (têm de continuar funcionando) ----
  t('legítimo: membro sai do grupo', true, () => updateDoc(doc(db('a'), 'grupos/G1'), { membros: ['owner', 'b', 'c'] }));
  t('legítimo: dono sai e passa o posto', true, () => updateDoc(doc(db('owner'), 'grupos/G1'), { membros: ['a', 'b', 'c'], dono: 'a' }));
  t('legítimo: entrar por link aberto', true, () => updateDoc(doc(db('z'), 'grupos/G1'), { membros: ['owner', 'a', 'b', 'c', 'z'] }));
  t('legítimo: pedir para entrar', true, () => updateDoc(doc(db('p3'), 'grupos/G2'), { pedidos: ['p1', 'p2', 'p3'] }));
  t('legítimo: cancelar o próprio pedido', true, () => updateDoc(doc(db('p1'), 'grupos/G2'), { pedidos: ['p2'] }));
  t('legítimo: dono aceita um pedido', true, () => updateDoc(doc(db('owner'), 'grupos/G2'), { membros: ['owner', 'p1'], pedidos: ['p2'] }));
  t('legítimo: dono recusa um pedido', true, () => updateDoc(doc(db('owner'), 'grupos/G2'), { pedidos: ['p1'] }));
  t('legítimo: dono muda o acesso', true, () => updateDoc(doc(db('owner'), 'grupos/G1'), { acesso: 'aprovado' }));
  t('legítimo: colega do grupo lê o treino do outro', true, () => getDoc(doc(db('a'), 'usuarios/b/sessoes/s1')));

  // ---- Ataques (têm de ser negados) ----
  t('ATAQUE: membro sai, expulsa outros, coloca estranhos e nomeia o dono', false,
    () => updateDoc(doc(db('a'), 'grupos/G1'), { membros: ['b', 'x', 'y'], dono: 'x' }));
  t('ATAQUE: membro sai e troca o dono sem ser dono', false,
    () => updateDoc(doc(db('a'), 'grupos/G1'), { membros: ['owner', 'b', 'c'], dono: 'b' }));
  t('ATAQUE: sair com elemento repetido para derrubar outro membro', false,
    () => updateDoc(doc(db('a'), 'grupos/G1'), { membros: ['owner', 'b', 'b'] }));
  t('ATAQUE: entrar no link aberto derrubando membros', false,
    () => updateDoc(doc(db('z'), 'grupos/G1'), { membros: ['owner', 'a', 'z', 'w', 'q'] }));
  t('ATAQUE: apagar o pedido de outra pessoa', false,
    () => updateDoc(doc(db('q'), 'grupos/G2'), { pedidos: ['p1'] }));
  t('ATAQUE: cancelar o pedido derrubando outro com repetido', false,
    () => updateDoc(doc(db('p1'), 'grupos/G2'), { pedidos: ['p2', 'p2'] }));
  t('ATAQUE: dono coloca no grupo quem não pediu', false,
    () => updateDoc(doc(db('owner'), 'grupos/G2'), { membros: ['owner', 'vitima'] }));
  t('ATAQUE: dono inventa pedido', false,
    () => updateDoc(doc(db('owner'), 'grupos/G2'), { pedidos: ['p1', 'p2', 'vitima'] }));
  t('ATAQUE: dono troca o dono por mudança direta', false,
    () => updateDoc(doc(db('owner'), 'grupos/G2'), { dono: 'x' }));

  // ---- Ligação que não some (item 2) ----
  t('ATAQUE: quem saiu do grupo (sem apagar a ligação) ainda lê o treino', false, async () => {
    await sem((d) => updateDoc(doc(d, 'grupos/G1'), { membros: ['owner', 'b', 'c'] })); // a saiu; a ligação ficou
    return getDoc(doc(db('a'), 'usuarios/b/sessoes/s1'));
  });
  t('legítimo: segue lendo se ainda dividem outro grupo', true, async () => {
    await sem(async (d) => {
      await updateDoc(doc(d, `conexoes/${chave('a', 'b')}`), { grupos: ['G1', 'G3'] });
      await updateDoc(doc(d, 'grupos/G1'), { membros: ['owner', 'b', 'c'] });
    });
    return getDoc(doc(db('a'), 'usuarios/b/sessoes/s1'));
  });
  t('legítimo: ligação com 3 grupos em comum', true, async () => {
    await sem(async (d) => {
      await setDoc(doc(d, 'grupos/G4'), { dono: 'owner', membros: ['a', 'b'], pedidos: [], acesso: 'aberto', nome: 'G4' });
    });
    return updateDoc(doc(db('a'), `conexoes/${chave('a', 'b')}`), { grupos: ['G1', 'G3', 'G4'] });
  });
  t('limite: 4º grupo em comum na ligação é recusado', false, async () => {
    await sem(async (d) => {
      await setDoc(doc(d, 'grupos/G4'), { dono: 'owner', membros: ['a', 'b'], pedidos: [], acesso: 'aberto', nome: 'G4' });
      await setDoc(doc(d, 'grupos/G5'), { dono: 'owner', membros: ['a', 'b'], pedidos: [], acesso: 'aberto', nome: 'G5' });
      await updateDoc(doc(d, `conexoes/${chave('a', 'b')}`), { grupos: ['G1', 'G3', 'G4'] });
    });
    return updateDoc(doc(db('a'), `conexoes/${chave('a', 'b')}`), { grupos: ['G1', 'G3', 'G4', 'G5'] });
  });
  t('legítimo: criar a ligação ao entrar no grupo', true, async () => {
    await sem((d) => setDoc(doc(d, 'grupos/G6'), { dono: 'owner', membros: ['m', 'n'], pedidos: [], acesso: 'aberto', nome: 'G6' }));
    return setDoc(doc(db('m'), `conexoes/${chave('m', 'n')}`), { membros: ['m', 'n'], grupos: ['G6'] });
  });

  let ok = 0;
  const linhas = [];
  for (const c of casos) {
    await env.clearFirestore();
    await semear();
    let passou;
    try { await c.fn(); passou = true; } catch { passou = false; }
    const certo = passou === c.deveria;
    if (certo) ok++;
    linhas.push(`${certo ? 'OK     ' : 'FALHOU '} ${c.nome}  (${passou ? 'permitido' : 'negado'})`);
  }
  console.log(`\n=== ${rotulo}: ${ok}/${casos.length} comportamentos corretos ===`);
  console.log(linhas.join('\n'));
  await env.cleanup();
  if (ok !== casos.length) process.exitCode = 1;
}

await rodar('firestore.rules', 'firestore.rules');
