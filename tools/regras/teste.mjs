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


  // ---- Amigos mais chegados (amizades) ----
  const pedido = (de, para) => ({ id: chave(de, para), membros: [de, para].sort(), de, status: 'pendente' });
  const pedidoDoc = (u, de, para) => doc(db(u), `amizades/${chave(de, para)}`);
  const criarPedido = (de, para) => sem((x) => setDoc(doc(x, `amizades/${chave(de, para)}`), pedido(de, para)));
  t('legítimo: pedir amizade', true, () => setDoc(pedidoDoc('ana', 'ana', 'bia'), pedido('ana', 'bia')));
  t('legítimo: quem recebeu aceita o pedido', true, async () => {
    await criarPedido('ana', 'bia');
    return updateDoc(pedidoDoc('bia', 'ana', 'bia'), { status: 'aceita' });
  });
  t('legítimo: qualquer um dos dois desfaz a amizade', true, async () => {
    await criarPedido('ana', 'bia');
    return deleteDoc(pedidoDoc('ana', 'ana', 'bia'));
  });
  t('ATAQUE: quem pediu aceita o próprio pedido', false, async () => {
    await criarPedido('ana', 'bia');
    return updateDoc(pedidoDoc('ana', 'ana', 'bia'), { status: 'aceita' });
  });
  t('ATAQUE: criar a amizade já como aceita', false,
    () => setDoc(pedidoDoc('ana', 'ana', 'bia'), { ...pedido('ana', 'bia'), status: 'aceita' }));
  t('ATAQUE: pedir em nome de outra pessoa', false,
    () => setDoc(pedidoDoc('ana', 'ana', 'bia'), { ...pedido('ana', 'bia'), de: 'bia' }));
  t('ATAQUE: pedido com identificador que não é a chave do par', false,
    () => setDoc(doc(db('ana'), 'amizades/qualquer'), pedido('ana', 'bia')));
  t('ATAQUE: terceiro lê o pedido dos outros', false, async () => {
    await criarPedido('ana', 'bia');
    return getDoc(pedidoDoc('eva', 'ana', 'bia'));
  });
  t('ATAQUE: terceiro apaga a amizade dos outros', false, async () => {
    await criarPedido('ana', 'bia');
    return deleteDoc(pedidoDoc('eva', 'ana', 'bia'));
  });
  t('legítimo: amigo aceito lê o treino e o que foi compartilhado', true, async () => {
    await sem(async (x) => {
      await setDoc(doc(x, `amizades/${chave('eva', 'bia')}`), { ...pedido('eva', 'bia'), status: 'aceita' });
      await setDoc(doc(x, 'usuarios/bia/compartilhado/peso'), { registros: [] });
    });
    return getDoc(doc(db('eva'), 'usuarios/bia/compartilhado/peso'));
  });
  t('ATAQUE: pedido ainda pendente não libera o que é só de amigo', false, async () => {
    await sem(async (x) => {
      await setDoc(doc(x, `amizades/${chave('eva', 'bia')}`), pedido('eva', 'bia'));
      await setDoc(doc(x, 'usuarios/bia/compartilhado/peso'), { registros: [] });
    });
    return getDoc(doc(db('eva'), 'usuarios/bia/compartilhado/peso'));
  });
  t('ATAQUE: colega de grupo (sem ser amigo) lê o que é só de amigo', false, async () => {
    await sem((x) => setDoc(doc(x, 'usuarios/b/compartilhado/peso'), { registros: [] }));
    return getDoc(doc(db('a'), 'usuarios/b/compartilhado/peso'));
  });

  // ---- Código pessoal (codigos) ----
  t('legítimo: reservar o próprio código', true, () => setDoc(doc(db('ana'), 'codigos/ABCD2345'), { uid: 'ana' }));
  t('legítimo: consultar um código (para pedir amizade)', true, async () => {
    await sem((x) => setDoc(doc(x, 'codigos/ABCD2345'), { uid: 'bia' }));
    return getDoc(doc(db('ana'), 'codigos/ABCD2345'));
  });
  t('ATAQUE: sobrescrever o código de outra pessoa', false, async () => {
    await sem((x) => setDoc(doc(x, 'codigos/ABCD2345'), { uid: 'bia' }));
    return setDoc(doc(db('ana'), 'codigos/ABCD2345'), { uid: 'ana' });
  });
  t('ATAQUE: apontar o código para outra pessoa', false, () => setDoc(doc(db('ana'), 'codigos/ABCD2345'), { uid: 'bia' }));
  t('ATAQUE: guardar campos extras no código', false,
    () => setDoc(doc(db('ana'), 'codigos/ABCD2345'), { uid: 'ana', lixo: 'x'.repeat(1000) }));
  t('ATAQUE: apagar o código de outra pessoa', false, async () => {
    await sem((x) => setDoc(doc(x, 'codigos/ABCD2345'), { uid: 'bia' }));
    return deleteDoc(doc(db('ana'), 'codigos/ABCD2345'));
  });
  t('ATAQUE: sem login não consulta códigos', false, async () => {
    await sem((x) => setDoc(doc(x, 'codigos/ABCD2345'), { uid: 'bia' }));
    return getDoc(doc(env.unauthenticatedContext().firestore(), 'codigos/ABCD2345'));
  });

  // ---- Limites de tamanho e de campos ----
  const grande = (n) => 'x'.repeat(n);
  const aviso = { autor: 'a', autorNome: 'Ana', autorFoto: null, tipo: 'comentario', eventoId: 'e1', texto: 'oi', criadoEm: 1 };
  t('legítimo: aviso de comentário com os campos do app', true, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av1'), aviso));
  t('legítimo: aviso de curtida sem texto', true, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av2'), { autor: 'a', autorNome: 'Ana', autorFoto: null, tipo: 'curtida', eventoId: 'e1', criadoEm: 1 }));
  t('ATAQUE: aviso com campo extra grande', false, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av1'), { ...aviso, lixo: grande(5000) }));
  t('ATAQUE: aviso com nome enorme', false, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av1'), { ...aviso, autorNome: grande(5000) }));
  t('ATAQUE: aviso com tipo inventado', false, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av1'), { ...aviso, tipo: 'spam' }));
  t('ATAQUE: aviso com foto enorme', false, () => setDoc(doc(db('a'), 'usuarios/b/atividades/av1'), { ...aviso, autorFoto: grande(100000) }));
  const comentario = { autor: 'a', autorNome: 'Ana', autorFoto: 'https://lh3.googleusercontent.com/x', texto: 'ótimo', criadoEm: 1 };
  t('legítimo: comentário com os campos do app', true, () => setDoc(doc(db('a'), 'usuarios/b/eventos/e1/comentarios/c1'), comentario));
  t('ATAQUE: comentário com campo extra grande', false, () => setDoc(doc(db('a'), 'usuarios/b/eventos/e1/comentarios/c1'), { ...comentario, lixo: grande(5000) }));
  t('ATAQUE: comentário com nome enorme', false, () => setDoc(doc(db('a'), 'usuarios/b/eventos/e1/comentarios/c1'), { ...comentario, autorNome: grande(5000) }));
  t('legítimo: curtida', true, () => setDoc(doc(db('a'), 'usuarios/b/eventos/e1/curtidas/a'), { criadoEm: 1 }));
  t('ATAQUE: curtida com campo extra', false, () => setDoc(doc(db('a'), 'usuarios/b/eventos/e1/curtidas/a'), { criadoEm: 1, lixo: grande(5000) }));
  t('legítimo: perfil como o app grava', true, () => setDoc(doc(db('a'), 'perfis/a'), { nome: 'Ana', foto: grande(12000), codigo: 'ABCD2345', metaSemanal: 3, atualizadoEm: 1 }, { merge: true }));
  t('legítimo: perfil sem foto', true, () => setDoc(doc(db('a'), 'perfis/a'), { nome: 'Ana', foto: null, atualizadoEm: 1 }, { merge: true }));
  t('ATAQUE: perfil com nome enorme', false, () => setDoc(doc(db('a'), 'perfis/a'), { nome: grande(5000), foto: null }));
  t('ATAQUE: perfil com foto enorme', false, () => setDoc(doc(db('a'), 'perfis/a'), { nome: 'Ana', foto: grande(100000) }));
  t('legítimo: gráfico de peso compartilhado', true, () => setDoc(doc(db('a'), 'usuarios/a/compartilhado/peso'), { registros: [{ data: '2026-01-01', kg: 70 }], atualizadoEm: 1 }));
  t('ATAQUE: compartilhado com campo extra', false, () => setDoc(doc(db('a'), 'usuarios/a/compartilhado/peso'), { registros: [], lixo: grande(5000) }));
  t('ATAQUE: compartilhado com lista gigante', false, () => setDoc(doc(db('a'), 'usuarios/a/compartilhado/peso'), { registros: Array.from({ length: 10001 }, () => 1), atualizadoEm: 1 }));
  t('legítimo: sessão do treino', true, () => setDoc(doc(db('a'), 'usuarios/a/sessoes/s1'), { id: 's1', data: '2026-01-01', fichaId: 'f', nota: 'ombro', registros: [{ exerciseId: 'x', series: [] }] }));
  t('legítimo: apagar a própria sessão', true, () => deleteDoc(doc(db('a'), 'usuarios/a/sessoes/s1')));
  t('ATAQUE: sessão com nota enorme', false, () => setDoc(doc(db('a'), 'usuarios/a/sessoes/s1'), { id: 's1', data: '2026-01-01', fichaId: 'f', nota: grande(5000) }));
  t('ATAQUE: sessão com milhares de exercícios', false, () => setDoc(doc(db('a'), 'usuarios/a/sessoes/s1'), { id: 's1', data: '2026-01-01', fichaId: 'f', registros: Array.from({ length: 101 }, () => ({ exerciseId: 'x', series: [] })) }));

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
