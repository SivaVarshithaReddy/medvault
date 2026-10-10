// MedVault Blockchain — a lightweight, tamper-evident, decentralized ledger.
// Blocks link via prevHash, and each record's blob also lives in a content-
// addressed storage layer (hash → blob), like IPFS-style content addressing.

import { sha256Hex, nowIso, randomId, mulberry32 } from './crypto.js';

export const GENESIS_TEXT = 'MedVault Genesis Block — decentralized medical records on IPFS';

// ---------------------------------------------------------------
// Ledger primitives
// ---------------------------------------------------------------

export async function makeGenesisBlock() {
  const block = {
    index: 0,
    timestamp: nowIso(),
    transactions: [{ type: 'GENESIS', note: GENESIS_TEXT }],
    prevHash: '0'.repeat(64),
    nonce: 0,
    hash: '',
  };
  await mineBlock(block, 3);
  return block;
}

export async function hashBlock(block) {
  const payload = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    transactions: block.transactions,
    prevHash: block.prevHash,
    nonce: block.nonce,
  });
  return sha256Hex(payload);
}

/**
 * Proof-of-styled "mining": find a nonce whose resulting block hash
 * starts with a given number of zeros. Difficulty is low so a demo
 * mines in a blink, but judges can see the nonce counter move in the UI.
 */
export async function mineBlock(block, difficulty = 3) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    block.nonce = nonce;
    const hash = await hashBlock(block);
    if (hash.startsWith(target)) {
      block.hash = hash;
      return block;
    }
    nonce += 1;
    // Allow UI to breathe every 2000 hashes
    if (nonce % 2000 === 0) await new Promise(r => setTimeout(r, 0));
  }
}

// ---------------------------------------------------------------
// Ledger operations
// ---------------------------------------------------------------

/**
 * Add a record transaction. Returns { block, blobId, updatedChain }.
 * In a real deployment the blob would be pinned to IPFS and only the
 * blobId (content hash) lands on-chain.
 */
export async function addRecord(chain, records, { id, patientId, title, kind, payload, grantedTo = null }) {
  const blob = { id, kind, payload, createdAt: nowIso() };
  const blobId = await sha256Hex(JSON.stringify(blob));

  const tx = {
    type: 'ADD_RECORD',
    id,
    patientId,
    title,
    kind,
    blobId,        // what would go on a real on-chain
    blob,          // what would go on IPFS
    grantedTo,     // consent: practitioner granted to view this record
    createdAt: nowIso(),
  };

  const prev = chain[chain.length - 1];
  const block = {
    index: prev.index + 1,
    timestamp: nowIso(),
    transactions: [tx],
    prevHash: prev.hash,
    nonce: 0,
    hash: '',
  };
  await mineBlock(block, 3);
  chain.push(block); // the ledger itself appends — one source of truth

  records[id] = { ...tx, confirmedAt: block.timestamp, blockIdx: block.index };
  return { block, blobId };
}

export async function addConsent(chain, records, { recordId, grantee }) {
  const rec = records[recordId];
  if (!rec) throw new Error('Record not found: ' + recordId);
  const tx = {
    type: 'GRANT_CONSENT',
    recordId,
    grantee,
    createdAt: nowIso(),
  };
  const prev = chain[chain.length - 1];
  const block = {
    index: prev.index + 1,
    timestamp: nowIso(),
    transactions: [tx],
    prevHash: prev.hash,
    nonce: 0,
    hash: '',
  };
  await mineBlock(block, 3);
  chain.push(block); // consent tx is part of the on-chain history
  rec.grantedTo = grantee;
  rec.consentTx = tx.id || `consent_${block.index}`;
  return block;
}

// ---------------------------------------------------------------
// Tamper-evidence verification
// ---------------------------------------------------------------

export async function verifyChain(chain, records, storage) {
  const problems = [];
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    const actualHash = await hashBlock({ ...block });
    if (actualHash !== block.hash) {
      problems.push(`Block ${i}: hash mismatch (data was tampered)`);
    }
    if (i > 0 && block.prevHash !== chain[i - 1].hash) {
      problems.push(`Block ${i}: prevHash does not link to block ${i - 1}`);
    }
    for (const tx of block.transactions) {
      if (tx.type === 'ADD_RECORD') {
        const blobStr = JSON.stringify(tx.blob);
        const recomputed = await sha256Hex(blobStr);
        if (recomputed !== tx.blobId) {
          problems.push(`Block ${i}: record "${tx.title}" blob hash mismatch (medical data altered)`);
        }
        if (storage && storage.get(tx.blobId)) {
          if (JSON.stringify(storage.get(tx.blobId)) !== blobStr) {
            problems.push(`Block ${i}: record "${tx.title}" differs across decentralized nodes`);
          }
        }
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------
// Decentralized storage layer
// "Nodes" hold copies of every record blob. In production these are
// IPFS peers across the internet. Here they are simulated peers.
// ---------------------------------------------------------------

export function createStorageNodes(nodeCount = 5, seed = 42) {
  const rand = mulberry32(seed);
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: randomId(rand),
      name: `Node-${i + 1}`,
      storage: new Map(),   // blobId -> blob
      online: true,
    });
  }
  return nodes;
}

export function replicate(nodes, blobId, blob) {
  for (const n of nodes) {
    if (n.online) n.storage.set(blobId, blob);
  }
}

export function storageStats(nodes) {
  const online = nodes.filter(n => n.online).map(n => n.storage);
  const blobIds = new Set();
  online.forEach(m => m.forEach((_, k) => blobIds.add(k)));
  const fullyReplicated = [...blobIds].every(id =>
    online.every(m => m.has(id) && JSON.stringify(m.get(id)) === JSON.stringify(online[0].get(id)))
  );
  return {
    totalNodes: nodes.length,
    onlineNodes: online.length,
    uniqueBlobs: blobIds.size,
    fullyReplicated,
  };
}
