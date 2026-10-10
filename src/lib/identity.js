// Wallet-style identity with demo helpers, mirroring a browser wallet flow.
import { randomId, mulberry32, nowIso } from './crypto.js';

// Simple deterministic "addresses" for demo — stands in for MetaMask accounts.
export function createWallet(label, rand = Math.random) {
  const pick = () => Math.floor(rand() * 16).toString(16);
  return {
    label,
    address: '0x' + Array.from({ length: 40 }, pick).join(''),
    createdAt: nowIso(),
  };
}

export function roleOf(address) {
  if (address === DEEM_KEY.patient) return 'patient';
  if (address === DEEM_KEY.doctor) return 'doctor';
  return 'observer';
}

export const SAMPLE_PATIENTS = [
  { id: 'p1', name: 'Aarav Sharma', age: 29, condition: 'Type 1 Diabetes' },
  { id: 'p2', name: 'Meera Iyer', age: 34, condition: 'Hypertension' },
  { id: 'p3', name: 'Rohit Nair', age: 41, condition: 'Asthma' },
];

export const SAMPLE_DOCTORS = [
  { id: 'd1', name: 'Dr. Ananya Rao', hospital: 'City General' },
  { id: 'd2', name: 'Dr. Vikram Menon', hospital: 'MetroHealth' },
];

export function seedDemoData(rand = mulberry32(2024)) {
  const addresses = {
    patients: SAMPLE_PATIENTS.map(p => ({ ...p, wallet: createWallet(p.name, rand) })),
    doctors: SAMPLE_DOCTORS.map(d => ({ ...d, wallet: createWallet(d.name, rand) })),
    lab: createWallet('Diagnostics Lab', rand),
  };
  return {
    createdAt: nowIso(),
    ...addresses,
  };
}

// The currently "active" wallet during a demo — sets who "is" the app user.
export const DEEM_KEY = {
  patient: null,
  doctor: null,
};
