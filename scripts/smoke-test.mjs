import { makeGenesisBlock, addRecord, verifyChain, createStorageNodes, storageStats } from '../src/lib/blockchain.js';

const chain = [await makeGenesisBlock()];
const records = {};
const nodes = createStorageNodes(3);

const { block, blobId } = await addRecord(chain, records, {
  id: 'r1', patientId: 'p1', title: 'Blood test', kind: 'lab-report', payload: 'Hemoglobin 13.5',
});
console.log('mined block', block.index, 'hash', block.hash.slice(0, 12), 'pow ok:', block.hash.startsWith('000'));
console.log('blobId', blobId.slice(0, 12));
for (const n of nodes) n.storage.set(blobId, block.transactions[0].blob);

let v = await verifyChain(chain, records, { get: id => nodes[0].storage.get(id) });
console.log('verify fresh:', v.ok, v.problems);

// tamper
const blob = nodes[0].storage.get(blobId);
nodes[0].storage.set(blobId, { ...blob, payload: 'Hemoglobin 99.9' });
v = await verifyChain(chain, records, { get: id => nodes[0].storage.get(id) });
console.log('verify tampered:', v.ok, v.problems[0] || '');

console.log('stats:', JSON.stringify(storageStats(nodes)));
