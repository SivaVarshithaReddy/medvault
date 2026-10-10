# 🩺 MedVault — Decentralized Medical Records Vault

**Hackathon theme: Blockchain Technology — "Keeping all important data in one place is risky. Keep it decentralized."**

MedVault is a web app where medical records are never stored in a central database.
Instead:

1. Each record is a **content-addressed blob** (like an IPFS object) replicated across a **network of independent storage nodes**.
2. A **lightweight blockchain ledger** anchors the blob hash, mined into blocks with `prevHash` links and a nonce (proof-style mining).
3. **Consent to view a record** is itself an on-chain transaction — an immutable audit trail.
4. Hash-chaining makes **tampering instantly detectable**: change one blob anywhere and verification fails.

## 🏃 Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 🎬 60-second demo script (for judges)

1. **Show the network** — right panel: 5 storage nodes, all online, chain length ≥ 1 (genesis).
2. **Add a record** for a patient (e.g. "Blood test — Oct 2026") → it gets *mined* into a block, and the blob replicates to all nodes. Watch the block counter and node blob counts change.
3. **Grant consent** to a doctor — that's a second on-chain transaction.
4. **Click "Verify Integrity"** → ✔ everything valid.
5. **The money shot:** Click **"⚡ Tamper Demo"** — a record blob is silently altered *outside the chain*, exactly like a rogue server modifying data. Then click **Verify Integrity** → ❌ the chain reports *"record blob hash mismatch (medical data altered)"*.
6. **Reset Demo** to run it again for the next judge.

## 🧱 Architecture

```
┌──────────────┐        ┌─────────────────────────┐
│  React UI    │──tx──▶ │  Blockchain ledger      │
│ (doctor /    │        │  blocks ← prevHash link │
│  patient)    │        │  nonce mining (PoW-ish) │
└──────┬───────┘        └────────▲────────────────┘
       │ blob (encrypted payload)│ blobId = SHA-256
       ▼                         │
┌──────────────────────────────────────────┐
│  Storage nodes (IPFS-style peers)        │
│  Node-1  Node-2  Node-3  Node-4  Node-5  │
│  blobs replicated by content hash        │
└──────────────────────────────────────────┘
```

### Why this matters (elevator pitch)
Centralized health databases are honeypots — one breach exposes millions of
records, one admin can silently edit history, and patients have no ownership.
MedVault splits the data across nodes, anchors hashes on a chain so history
cannot be rewritten, and gives patients per-record consent control.

## 🔗 Production path

The folder [`contracts/MedVaultRegistry.sol`](contracts/MedVaultRegistry.sol)
is a Solidity contract that is the real-chain equivalent of the local ledger:

- Patients register records with `addRecord(recordId, blobHash, cid)` — only hashes live on-chain.
- `grantConsent` / `revokeConsent` / `hasViewAccess` manage access auditable on-chain forever.
- Deploy with Hardhat/Foundry to Polygon or an EVM testnet and point the React app at it with ethers.js.

The in-browser chain (`src/lib/blockchain.js`) is a faithful simulation so the
demo runs with **zero setup, no wallet, no gas** — perfect for a hackathon floor.

## 📁 Structure

```
src/lib/crypto.js       SHA-256 + helpers
src/lib/blockchain.js   blocks, mining, verification, node replication
src/lib/storage.js      persistence (localStorage) facade
src/lib/identity.js     wallet-style identities, seeded demo data
src/App.jsx             the UI (explorer, vault, integrity checker)
contracts/              Solidity contract for a real EVM chain
```
