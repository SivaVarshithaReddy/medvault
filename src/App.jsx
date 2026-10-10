import React, { useEffect, useMemo, useState } from 'react';
import {
  makeGenesisBlock, addRecord as bcAddRecord, addConsent as bcAddConsent,
  verifyChain, storageStats, replicate,
} from './lib/blockchain.js';
import {
  loadState, persistState, initNewState,
} from './lib/storage.js';
import { seedDemoData, SAMPLE_PATIENTS, SAMPLE_DOCTORS } from './lib/identity.js';
import { randomId } from './lib/crypto.js';

const KINDS = [
  { value: 'prescription', label: 'Prescription' },
  { value: 'lab-report', label: 'Lab Report' },
  { value: 'scan', label: 'Scan / Imaging' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'vaccination', label: 'Vaccination' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [chain, setChain] = useState([]);
  const [records, setRecords] = useState({});
  const [nodes, setNodes] = useState([]);
  const [demo] = useState(() => seedDemoData());
  const [activePatientId, setActivePatientId] = useState('p1');
  // Seeded doctors come with wallets; raw SAMPLE_DOCTORS[0] would crash on .wallet
  const [activeDoctorId, setActiveDoctorId] = useState('d1');
  const [form, setForm] = useState({ title: '', kind: 'prescription', payload: '' });
  const [busy, setBusy] = useState(false);
  const [integrity, setIntegrity] = useState(null);
  const [toast, setToast] = useState(null);

  // ---------- boot: genesis ----------
  useEffect(() => {
    (async () => {
      const state = loadState();
      if (state.chain) {
        setChain(state.chain);
        setRecords(state.records);
        setNodes(state.nodes);
      } else {
        const fresh = initNewState();
        const genesis = await makeGenesisBlock();
        fresh.chain = [genesis];
        setChain(fresh.chain);
        setRecords(fresh.records);
        setNodes(fresh.nodes);
        persistState(fresh.chain, fresh.records, fresh.nodes);
      }
      setReady(true);
    })();
  }, []);

  const stats = useMemo(() => (ready ? storageStats(nodes) : null), [nodes, ready]);

  // Doctors from the seeded demo data always have wallets
  const seededDoctors = demo.doctors;
  const activeDoctor = seededDoctors.find(d => d.id === activeDoctorId) || seededDoctors[0];

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ---------- actions ----------
  async function handleAddRecord(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.payload.trim()) {
      showToast('Please fill the record title and data.');
      return;
    }
    setBusy(true);
    const id = randomId();
    const { block } = await bcAddRecord(chain, records, {
      id,
      patientId: activePatientId,
      title: form.title,
      kind: form.kind,
      payload: form.payload,
    });
    const newRecords = { ...records };
    // replicate blob to every online node (mimic IPFS pinning)
    for (const n of nodes) {
      if (n.online) n.storage.set(block.transactions[0].blobId, block.transactions[0].blob);
    }
    setChain([...chain]);
    setRecords(newRecords);
    setNodes([...nodes]);
    persistState(chain, newRecords, nodes);
    setForm({ title: '', kind: 'prescription', payload: '' });
    setBusy(false);
    showToast(`Record mined into block #${block.index} and replicated to ${nodes.filter(n => n.online).length} nodes ✅`);
  }

  async function handleConsent(recordId) {
    setBusy(true);
    await bcAddConsent(chain, records, {
      recordId,
      grantee: activeDoctor.wallet.address,
    });
    setRecords({ ...records });
    setChain([...chain]);
    setNodes([...nodes]);
    persistState(chain, { ...records }, nodes);
    setBusy(false);
    showToast(`Consent granted to ${activeDoctor.name} (on-chain tx) ✅`);
  }

  async function handleVerify() {
    setBusy(true);
    const res = await verifyChain(chain, records, { get: id => nodes.find(n => n.online)?.storage.get(id) });
    setIntegrity(res);
    setBusy(false);
  }

  // ---------- demo: tamper with a record blob on the nodes ----------
  function tamperDemo() {
    const recordIds = Object.keys(records);
    if (!recordIds.length) {
      showToast('Add a record first, then run the tamper demo.');
      return;
    }
    const victim = records[recordIds[0]];
    for (const n of nodes) {
      if (n.online && n.storage.has(victim.blobId)) {
        const blob = n.storage.get(victim.blobId);
        n.storage.set(victim.blobId, { ...blob, payload: blob.payload.replace(/.$/, 'X') });
      }
    }
    setNodes([...nodes]);
    showToast('⚠️ Record data altered on storage nodes (outside the chain) — now click "Verify Integrity"!');
  }

  function resetDemo() {
    localStorage.clear();
    (async () => {
      const fresh = initNewState();
      const genesis = await makeGenesisBlock();
      fresh.chain = [genesis];
      setChain(fresh.chain);
      setRecords({});
      setNodes(fresh.nodes);
      persistState(fresh.chain, {}, fresh.nodes);
      setIntegrity(null);
      showToast('Demo reset — fresh genesis block created.');
    })();
  }

  const patient = SAMPLE_PATIENTS.find(p => p.id === activePatientId);
  const patientRecords = Object.values(records).filter(r => r.patientId === activePatientId);

  if (!ready) return <div className="loading">Creating genesis block…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>🩺 MedVault</h1>
          <p className="tagline">Decentralized, tamper-proof medical records</p>
        </div>
        <div className="topbar-right">
          <span className="chip">Chain length: {chain.length}</span>
          <span className="chip">Storage nodes: {stats?.onlineNodes}/{stats?.totalNodes} online</span>
          <button className="btn small" onClick={resetDemo}>Reset Demo</button>
        </div>
      </header>

      <div className="layout">
        {/* left: patients & doctors */}
        <aside className="panel">
          <h2>Patients</h2>
          <ul className="list">
            {SAMPLE_PATIENTS.map(p => (
              <li
                key={p.id}
                className={`list-item clickable ${p.id === activePatientId ? 'active' : ''}`}
                onClick={() => setActivePatientId(p.id)}
              >
                <strong>{p.name}</strong>
                <span className="muted">{p.age} · {p.condition}</span>
              </li>
            ))}
          </ul>
          <h2>Doctors (viewing as)</h2>
          <ul className="list">
            {SAMPLE_DOCTORS.map(d => (
              <li
                key={d.id}
                className={`list-item clickable ${d.id === activeDoctorId ? 'active' : ''}`}
                onClick={() => setActiveDoctorId(d.id)}
              >
                <strong>{d.name}</strong>
                <span className="muted">{d.hospital}</span>
              </li>
            ))}
          </ul>
          <div className="wallet">
            <strong>Active wallet</strong>
            <code>{activeDoctor.wallet.address}</code>
          </div>
        </aside>

        {/* middle: records */}
        <main className="panel">
          <h2>{patient?.name}'s Vault</h2>
          <form className="card" onSubmit={handleAddRecord}>
            <input
              placeholder="Record title e.g. Blood test — October 2026"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <textarea
              placeholder="Record data (medical notes, values…)"
              rows={3}
              value={form.payload}
              onChange={e => setForm({ ...form, payload: e.target.value })}
            />
            <button className="btn primary" disabled={busy} type="submit">
              {busy ? 'Mining…' : 'Add Record → mine block'}
            </button>
          </form>

          {patientRecords.length === 0 && <p className="muted">No records yet for this patient.</p>}

          <ul className="records">
            {patientRecords.map(r => (
              <li key={r.id} className="card record">
                <div className="record-head">
                  <strong>{r.title}</strong>
                  <span className="chip">{r.kind}</span>
                </div>
                <p>{r.payload}</p>
                <div className="meta">
                  <span>Blob CID: <code>{r.blobId?.slice(0, 18)}…</code></span>
                  <span>Block #{r.blockIdx}</span>
                  <span>{r.grantedTo ? `Consented: ${activeDoctor?.name}` : 'Private — no consent'}</span>
                </div>
                {!r.grantedTo && (
                  <button className="btn small" disabled={busy} onClick={() => handleConsent(r.id)}>
                    Grant View Consent to {activeDoctor.name}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </main>

        {/* right: chain & nodes */}
        <aside className="panel">
          <h2>Blockchain Explorer</h2>
          <ul className="chainlist">
            {chain.slice().reverse().slice(0, 8).map(b => (
              <li key={b.index} className="block card">
                <div><strong>Block #{b.index}</strong> <span className="muted">{b.transactions.length} tx</span></div>
                <code className="hash">hash {b.hash?.slice(0, 16)}…</code>
                <code className="hash">prev {b.prevHash?.slice(0, 16)}…</code>
                <div className="muted small">nonce {b.nonce}</div>
              </li>
            ))}
          </ul>

          <h2>Storage Nodes</h2>
          <ul className="nodes">
            {nodes.map(n => (
              <li key={n.id} className={`node ${n.online ? 'online' : 'offline'}`}>
                <span className="dot" /> {n.name} — {n.storage.size} blobs
              </li>
            ))}
          </ul>

          <div className="actions">
            <button className="btn" disabled={busy} onClick={handleVerify}>✅ Verify Integrity</button>
            <button className="btn danger" onClick={tamperDemo}>⚡ Tamper Demo</button>
          </div>

          {integrity && (
            <div className={`integrity ${integrity.ok ? 'ok' : 'bad'}`}>
              {integrity.ok
                ? '✔ Chain + blobs are valid on all online nodes.'
                : (
                  <ul>{integrity.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
                )}
            </div>
          )}
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
