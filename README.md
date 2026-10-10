# 🩺 MedVault — Decentralized Medical Records Vault

> **Hackathon Theme: Blockchain Technology**
> *"Keeping all important data in one place is risky. Keep it at decentralized locations."*

MedVault is a **decentralized medical records system** built around one core idea: **no single point of failure, no single point of trust.**

- Patient records are **never stored in one central database**. Each record lives as a *content-addressed blob* replicated across **5 independent storage nodes** (IPFS-style peers).
- Every record is **anchored on a blockchain** — blocks are mined (proof-of-work), hash-chained (`prevHash`), and immutable.
- **Patient consent is a transaction.** Granting a doctor view-access is an on-chain event recorded forever — a tamper-proof audit trail.
- **Tampering is mathematically impossible to hide.** Change one byte of any record anywhere, and the verification algorithm detects it instantly (live demo below).

---

## 🚀 Quick Start (Implementation)

### Prerequisites
| Tool | Version tested | Purpose |
|---|---|---|
| Node.js | v24+ (any ≥ 18 works) | runtime + package manager |
| npm | v11+ | dependency install |
| Any modern browser | Chrome/Edge/Firefox | app + demo |

No blockchain client, wallet, gas, database server, or internet connection is required for the demo — everything runs locally in the browser.

### Install & Run

```bash
# 1. Clone
git clone https://github.com/SivaVarshithaReddy/medvault.git
cd medvault

# 2. Install dependencies
npm install

# 3a. Development server (hot reload)
npm run dev
# → open http://localhost:5173

# 3b. OR production build
npm run build      # outputs to dist/
npm run preview    # serve the optimized build
```

### Run the test suites (proves the implementation)

```bash
npm install --no-audit --no-fund --save-dev puppeteer-core  # one-time, for the browser test
# (skip if already in devDependencies)

# Unit/integration test — the ledger engine (no browser needed)
node scripts/smoke-test.mjs
# Expected output:
#   mined block 1 hash 000xxxx pow ok: true
#   verify fresh: true []
#   verify tampered: false Block 1: record "Blood test" differs across decentralized nodes
#   stats: {"totalNodes":3,"onlineNodes":3,"uniqueBlobs":1,"fullyReplicated":false}

# Full end-to-end browser test — real Chrome, real UI clicks
# (requires Google Chrome installed at the default path)
node scripts/browser-check.mjs
# Expected: 7/7 PASS (renders, nodes online, no errors, record added,
#           clean verify OK, tamper detected, no page errors)
```

---

## 🎬 60-Second Judge Demo Script

1. **Open the app** → top bar shows live stats: `Chain length` and `Storage nodes: 5/5 online`.
2. **Pick a patient** (left panel) — e.g. *Aarav Sharma*.
3. **Add a record** (middle panel): type a title (e.g. *"Blood test — Oct 2026"*), choose a kind, add data → click **"Add Record → mine block"**.
   → Watch the toast: *mined into block #1 and replicated to 5 nodes*. The right panel explorer shows the new block with its hash + `prevHash` + nonce.
4. **Show V’s that link:** every block's `prev` hash = previous block's `hash`.
5. **Grant consent** → click *"Grant View Consent to Dr. Ananya Rao"* → a `GRANT_CONSENT` transaction is mined into a new block (block #2).
6. **Prove integrity:** click **"✅ Verify Integrity"** → green box: *✔ Chain + blobs are valid on all online nodes.*
7. **The money shot — tamper demo:** click **"⚡ Tamper Demo"**. A record blob is silently altered *outside the chain* (exactly like a rogue server editing a centralized database). Then click **Verify Integrity** again → red box:
   > `Block 1: record "Blood test" differs across decentralized nodes`
   **The system caught the edit.** This is the "decentralized beats centralized" argument in 10 seconds.
8. **Reset Demo** to run again fresh for the next judge.

---

## 🏗️ Architecture & Implementation

```
                        ┌────────────────────────┐
                        │      React UI (Vite)   │
                        │  doctor / patient view │
                        └───────┬────────────────┘
                     addRecord / grantConsent
                                │
                                ▼
        ┌───────────────────────────────────────────────┐
        │        Blockchain ledger (in-app engine)      │
        │  block = { index, timestamp, transactions,    │
        │            prevHash, nonce, hash }            │
        │  • hash = SHA-256(block payload)              │
        │  • mining: nonce searched until the hash      │
        │    starts with difficulty "000" zeros (PoW)   │
        │  • each block references prevHash → chain of  │
        │    blocks is tamper-evident by construction   │
        └──────────────────┬────────────────────────────┘
                           │ on-chain artifact =
                blobId     │ SHA-256(json(blob))   ← content address
                           │        (this is the ONLY thing that
                           │         would go on a real public chain)
                           ▼
        ┌───────────────────────────────────────────────┐
        │   Storage nodes (IPFS-style peers, simulated) │
        │  Node-1  Node-2  Node-3  Node-4  Node-5       │
        │  each holds a full replica: blobId → blob     │
        │  replication = copy blob to every online node │
        │  verification compares node copy vs chain hash│
        └───────────────────────────────────────────────┘

        Persistence: localStorage snapshot of chain + records +
        nodes (with a version key that auto-resets stale schemas).
```

### Record lifecycle (implementation detail)

1. **Create blob** — the medical payload is wrapped into `{ id, kind, payload, createdAt }`.
2. **Content address** — `blobId = SHA-256(JSON.stringify(blob))`. This is the record's content hash (its "CID" in IPFS terms).
3. **Transaction** — an `ADD_RECORD` tx (type, patientId, title, kind, blobId, blob, createdAt) is built.
4. **Mine the block** — a nonce is searched until the block's SHA-256 hash begins with `000` (difficulty 3 — near-instant for demo, visually watchable in the UI).
5. **Append to ledger** — the block (with `prevHash` = last block's hash) is pushed onto the chain. The ledger mutates itself so there's *one source of truth*.
6. **Replicate** — the blob is copied to every **online storage node** under its content address.
7. **Consent** — a separate `GRANT_CONSENT` tx can be mined that records `grantee` (a practitioner's wallet address) for that record, making the access grant permanent, on-chain history.

### Tamper evidence — why it works

The verification algorithm (`verifyChain`) checks **three independent things** for every block:

1. **Recompute each block's hash** with its stored nonce/index/timestamp/transactions — a mismatch means the block contents were altered after mining.
2. **Re-link the chain** — every block's `prevHash` must equal the previous block's recomputed hash; missing link = history was rewritten.
3. **Verify each record blob on every node** — an `ADD_RECORD` tx's stored `blobId` is re-hashed from the actual data, and the copy on each **node** must byte-match the chain copy.

Because every block references every previous block, changing data in block *N* changes its hash, which invalidates *every block after it* — requiring re-mining the entire tail, which is computationally visible (that's PoW's whole point). This is why it's a **hash-chained ledger and not just a "list with hashes."**

### Consent model

| Actor | Role |
|---|---|
| **Patient** | Owns their records; grants / revokes view-consent, each as a mined on-chain tx |
| **Doctor / Practitioner** | Requests access; sees only records they have explicit consent for |
| **Auditor (everyone)** | Can verify chain + blob integrity without ever seeing private data |

`grants` are *append-only* — revocation doesn't erase history, it adds a new on-chain fact. That's what makes the audit trail tamper-proof.

---

## 📁 Project Structure (with what each file does)

```
medvault/
├── index.html                        # Vite HTML shell (single-page entry)
├── vite.config.js                    # Vite + React plugin config
├── package.json                      # scripts: dev / build / preview
├── contracts/
│   └── MedVaultRegistry.sol          # PRODUCTION PATH (see below)
├── scripts/
│   ├── smoke-test.mjs                # Node test: genesis → addRecord → verify → tamper-detect
│   └── browser-check.mjs             # Puppeteer E2E: real Chrome, 7 PASS/FAIL assertions
└── src/
    ├── main.jsx                      # React root
    ├── App.jsx                       # UI: patient list, vault, form, chain explorer,
    │                                 #   node map, verify button, tamper demo, toasts
    ├── styles.css                    # dark medical theme (responsive <1000px)
    └── lib/
        ├── crypto.js                 # pure-JS SHA-256 (no WebCrypto dependency → works
        │                             #   over plain http:// and any WebView),
        │                             #   mulberry32 PRNG, id/timestamp helpers
        ├── blockchain.js             # THE ENGINE:
        │                             #   makeGenesisBlock(), hashBlock(), mineBlock(difficulty),
        │                             #   addRecord(), addConsent(), verifyChain(),
        │                             #   createStorageNodes(), replicate(), storageStats()
        ├── storage.js                # persistence layer: localStorage snapshot/restore of
        │                             #   {chain, records, nodes} with STATE_VERSION guard
        └── identity.js               # wallet-style identities (0x… addresses), seeded
                                      #   demo patients/doctors
```

---

## 🛠️ Data Model — exact shapes

**Block**
```js
{
  index: 2,                        // 0 = genesis
  timestamp: ISO string,
  transactions: [ ... ],           // ADD_RECORD | GRANT_CONSENT | GENESIS
  prevHash: '<64 hex chars>',      // links to block[i-1].hash ('' genesis: '0'.repeat(64))
  nonce: <int>,                    // mined (difficulty: hash starts with '000')
  hash:  '<64 hex chars>'          // SHA-256 of { index, timestamp, transactions, prevHash, nonce }
}
```

**ADD_RECORD transaction**
```js
{
  type: 'ADD_RECORD',
  id: '<random 24-char id>',
  patientId: 'p1',
  title: 'Blood test — October 2026',
  kind: 'lab-report',              // prescription | lab-report | scan | diagnosis | vaccination
  blobId: '<64 hex content hash>', // = sha256(JSON.stringify(blob))
  blob:  { id, kind, payload, createdAt },
  grantedTo: null | '0x…doctor wallet address',
  createdAt: ISO string
}
```

**GRANT_CONSENT transaction** — `{ type: 'GRANT_CONSENT', recordId, grantee, createdAt }`

**Storage node**
```js
{ id, name: 'Node-3', storage: Map<blobId, blob>, online: true }
```

---

## 🔗 Production Path — the real-chain version

The in-app chain is a faithful simulation so the demo runs with **zero setup, no wallet, no gas** — perfect for a hackathon floor. For a real system, `contracts/MedVaultRegistry.sol` is the EVM upgrade:

| Demo (this repo) | Production |
|---|---|
| in-app blockchain in JS | Solidity contract deployed to Polygon / any EVM chain |
| blobId computed in JS | `addRecord(recordId, blobHash, cid, metadata)` called by patient wallet |
| consent in ledger | `grantConsent` / `revokeConsent` / `hasViewAccess` on-chain, auditable forever |
| simulated 5 nodes | **real IPFS** — blob bytes go to the IPFS network; only the CID hash is anchored on-chain |
| SHA-256 in JS | same hash — IPFS-aware verification works both in-app and on-chain |

Key contract features: role management (`Patient` / `Practitioner`), per-record ownership (`onlyPatient` modifier), consent grants/revocations, `hasViewAccess(recordId, viewer)` access check, `getOwnedRecords`, `totalRecords`. Deploy with Hardhat/Foundry; wire the React app with `ethers.js` using the same UI.

**Bridge from demo to real, step by step:**
1. `npm i -D hardhat` → `npx hardhat test` the Solidity contract (outside this repo's test scope today).
2. Enable IPFS: swap `replicate()` in `blockchain.js` for a `web3.storage` / Pinata upload that returns the CID; keep `blobId` as the CID digest.
3. Swap the in-app ledger for an `ethers.Contract` instance of `MedVaultRegistry` (MetaMask for signing).

---

## 🧪 Testing matrix — what the tests actually prove

| Test | Proves |
|---|---|
| `scripts/smoke-test.mjs` | genesis mines; `ADD_RECORD` block satisfies PoW (`hash startsWith 000`); `verifyChain` returns `ok: true` on clean data; **tampering a node's blob is caught** with the exact expected problem string |
| `scripts/browser-check.mjs` (7 assertions) | app boots with **no JS errors**; nodes show "online"; **full user flow works**: type title/data → submit → record visible; "Verify Integrity" → OK message; tamper demo → verify → **detection message appears**; no console/page errors through the whole flow |
| SHA-256 correctness | pure-JS implementation validated against official NIST vectors: `"" → e3b0c44…7852b855`, `"abc" → ba7816bf…00361a39`, `"hello world" → b94d27b9…e2efcde9` |

SHA-256 is the *same* algorithm real blockchains and IPFS use — so the demo's hash semantics match production exactly.

---

## 💡 Why this wins (elevator pitch for judges)

Centralized health databases have three fatal flaws:
1. **One breach exposes millions** — honeypot economics.
2. **One admin can silently rewrite history** — no tamper evidence.
3. **Patients own nothing** — providers hold the data.

MedVault fixes each one: data is **split across independent nodes**, history is **hash-chained and mined** (past edits are cryptographically detectable), and **patients grant consent per record** as permanent on-chain transactions. The killer moment is on stage: flip the **⚡ Tamper Demo** button, and the chain *proves* the data was altered — an argument no centralized system can make.

---

## 👥 Team & Tech Stack

**Stack:** React 18 + Vite · pure-JS SHA-256 (std SHA-256) · custom PoW ledger (difficulty 3) · Puppeteer E2E · Solidity 0.8.19 contract for the production path.

No meta-mask/gas/IPFS setup needed for the demo — clone, `npm install`, `npm run dev`, open `localhost:5173`, and rock the demo.

---

*Built for a Blockchain Technology hackathon — [github.com/SivaVarshithaReddy/medvault](https://github.com/SivaVarshithaReddy/medvault).*
