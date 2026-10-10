import { addRecord, addConsent, verifyChain, storageStats, replicate, createStorageNodes } from './blockchain.js';

const CHAIN_KEY = 'medvault.chain';
const REC_KEY = 'medvault.records';
const NODES_KEY = 'medvault.nodes';
// Bump when persisted shape changes — old versions auto-reset instead of crashing
const STATE_VERSION = 2;
const VER_KEY = 'medvault.v';

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full / unavailable — demo can still run in-memory.
  }
}

function ensureVersion() {
  try { localStorage.setItem(VER_KEY, JSON.stringify(STATE_VERSION)); } catch {}
}

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadState() {
  // Discard state persisted by an older/different app version
  if (load(VER_KEY) !== STATE_VERSION) {
    try { localStorage.removeItem(CHAIN_KEY); localStorage.removeItem(REC_KEY); localStorage.removeItem(NODES_KEY); } catch {}
    localStorage.setItem(VER_KEY, JSON.stringify(STATE_VERSION));
    return { chain: null, records: {}, nodes: null };
  }
  let chain = load(CHAIN_KEY);
  let records = load(REC_KEY) || {};
  let nodes = load(NODES_KEY);
  if (!chain || !chain.length) {
    // fresh start (async genesis handled by caller via initChain)
    return { chain: null, records, nodes: null };
  }
  if (!nodes || !nodes.length) nodes = createStorageNodes(5);
  // Deserialize Maps on nodes
  nodes = nodes.map(n => ({ ...n, storage: new Map(Object.entries(n.storage || {})) }));
  return { chain, records, nodes };
}

export function persistState(chain, records, nodes) {
  ensureVersion();
  save(CHAIN_KEY, chain);
  save(REC_KEY, records);
  try {
    save(
      NODES_KEY,
      nodes.map(n => ({
        ...n,
        storage: Object.fromEntries(n.storage),
      }))
    );
  } catch {
    // If node blob storage overflows localStorage, degrade gracefully.
    save(NODES_KEY, nodes.map(n => ({ ...n, storage: {} })));
  }
}

export function initNewState() {
  return {
    chain: null,           // genesis built async in the app
    records: {},
    nodes: createStorageNodes(5),
  };
}

export { addRecord, addConsent, verifyChain, storageStats, replicate };
