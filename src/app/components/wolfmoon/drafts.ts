// Moved out of WolfMoon.tsx unchanged; see that file for how they are used.
import { BIBFRAMERecord } from "../../types/bibframe";

export const DRAFT_KEY = "moon_wolf_draft";

export interface WolfMoonDraft {
  record: BIBFRAMERecord;
  title: string;
  savedAt: string;
}

export function readDraft(): WolfMoonDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    return draft?.record?.work && draft?.record?.instance ? draft : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
