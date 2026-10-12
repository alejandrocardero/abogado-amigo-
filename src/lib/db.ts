/**
 * Browser-as-database layer.
 *
 * Every collection the app uses is persisted in the browser's localStorage so
 * data survives reloads and belongs to whoever opens the app, without any
 * server. All access goes through this module: components never touch
 * localStorage directly.
 *
 * Storage is namespaced and versioned (`abogado-amigo.v1:`) so a future schema
 * change only requires bumping the version. Reads/writes are defensive: private
 * browsing modes, disabled storage or quota errors degrade to an in-memory
 * fallback instead of crashing the UI.
 *
 * Multi-account: each user's data lives under a `u:{email}:` prefix derived
 * from the active user pointer. The accounts registry and UI tab preference
 * stay global.
 */

import {
  AccountRecord,
  ChatMessage,
  DocumentVersion,
  GazetteFeedItem,
  GazetteSourceDoc,
  IndexedDocument,
  LawCatalogItem,
  LogEntry,
  ModelSettings,
  NavTab,
  NotificationItem,
  ReviewState,
  UserProfile,
} from '../types';

const NAMESPACE = 'abogado-amigo.v1:';

// In-memory mirror used when localStorage is unavailable (private mode,
// blocked cookies). Keeps the app usable for the current page lifetime.
const memory = new Map<string, string>();

function storageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = `${NAMESPACE}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const HAS_STORAGE = storageAvailable();

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = HAS_STORAGE ? window.localStorage.getItem(NAMESPACE + key) : memory.get(NAMESPACE + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  const fullKey = NAMESPACE + key;
  try {
    if (HAS_STORAGE) {
      window.localStorage.setItem(fullKey, JSON.stringify(value));
    } else {
      memory.set(fullKey, JSON.stringify(value));
    }
  } catch {
    // Quota exceeded or storage revoked mid-session: keep the app alive with
    // the in-memory copy so the current interaction still works.
    memory.set(fullKey, JSON.stringify(value));
  }
}

function remove(key: string): void {
  const fullKey = NAMESPACE + key;
  try {
    if (HAS_STORAGE) window.localStorage.removeItem(fullKey);
  } catch {
    // ignore
  }
  memory.delete(fullKey);
}

// ==================== Active user pointer ====================

let activeUserEmail: string | null = load<string | null>('activeUser', null);

export function setUser(email: string | null): void {
  activeUserEmail = email;
  if (email === null) {
    remove('activeUser');
  } else {
    save('activeUser', email);
  }
}

export function getActiveUser(): string | null {
  return activeUserEmail;
}

export function userKey(key: string): string {
  if (activeUserEmail !== null) {
    return `u:${encodeURIComponent(activeUserEmail)}:${key}`;
  }
  return key;
}

// ==================== Accounts registry (global) ====================

export const accounts = {
  get: (): Record<string, AccountRecord> => load<Record<string, AccountRecord>>('accounts', {}),
  set: (v: Record<string, AccountRecord>): void => save('accounts', v),
};

export function getAccount(email: string): AccountRecord | null {
  const key = email.trim().toLowerCase();
  const all = accounts.get();
  return all[key] ?? null;
}

export function saveAccount(account: AccountRecord): void {
  const all = accounts.get();
  all[account.email.trim().toLowerCase()] = account;
  accounts.set(all);
}

export function buildProfileFromAccount(account: AccountRecord): UserProfile {
  return {
    userName: account.userName,
    businessName: account.businessName,
    country: account.country,
    countryName: account.countryName,
    currency: account.currency,
    currencySymbol: account.currencySymbol,
    email: account.email,
    acceptedTermsAt: account.acceptedTermsAt,
  };
}

// ==================== Per-user stores ====================

/** Authenticated user session. Null when logged out. */
export const session = {
  get: (): UserProfile | null => load<UserProfile | null>(userKey('session'), null),
  set: (profile: UserProfile): void => save(userKey('session'), profile),
  clear: (): void => remove(userKey('session')),
};

/** Full chat conversation of the assistant. Capped to the last 200 entries. */
export const messages = {
  get: (): ChatMessage[] => load<ChatMessage[]>(userKey('messages'), []),
  set: (items: ChatMessage[]): void => save(userKey('messages'), items.slice(-200)),
  clear: (): void => remove(userKey('messages')),
};

/** Legal library catalog shown in the "Leyes" tab. */
export const laws = {
  get: (): LawCatalogItem[] => load<LawCatalogItem[]>(userKey('laws'), []),
  set: (items: LawCatalogItem[]): void => save(userKey('laws'), items),
  clear: (): void => remove(userKey('laws')),
};

/** Gazette monitor feed shown in the "Gacetas" tab. */
export const gazetteFeed = {
  get: (): GazetteFeedItem[] => load<GazetteFeedItem[]>(userKey('gazetteFeed'), []),
  set: (items: GazetteFeedItem[]): void => save(userKey('gazetteFeed'), items),
  clear: (): void => remove(userKey('gazetteFeed')),
};

/** Source gazette documents loaded into the PDF extractor agent. */
export const extractorGazettes = {
  get: (): GazetteSourceDoc[] => load<GazetteSourceDoc[]>(userKey('extractorGazettes'), []),
  set: (items: GazetteSourceDoc[]): void => save(userKey('extractorGazettes'), items),
  clear: (): void => remove(userKey('extractorGazettes')),
};

/** Documents indexed by the RAG LangGraph pipeline. */
export const indexedDocs = {
  get: (): IndexedDocument[] => load<IndexedDocument[]>(userKey('indexedDocs'), []),
  set: (items: IndexedDocument[]): void => save(userKey('indexedDocs'), items),
  clear: (): void => remove(userKey('indexedDocs')),
};

/** Version history of indexed documents. */
export const versions = {
  get: (): DocumentVersion[] => load<DocumentVersion[]>(userKey('versions'), []),
  set: (v: DocumentVersion[]): void => save(userKey('versions'), v),
  clear: (): void => remove(userKey('versions')),
};

/** In-app notifications for the active user. */
export const notifications = {
  get: (): NotificationItem[] => load<NotificationItem[]>(userKey('notifications'), []),
  set: (v: NotificationItem[]): void => save(userKey('notifications'), v),
  clear: (): void => remove(userKey('notifications')),
};

/** Operational log entries for the active user. */
export const logs = {
  get: (): LogEntry[] => load<LogEntry[]>(userKey('logs'), []),
  set: (v: LogEntry[]): void => save(userKey('logs'), v),
  clear: (): void => remove(userKey('logs')),
};

/** Review workflow state for extracted artifacts. */
export const reviewResolved = {
  get: (): ReviewState => load<ReviewState>(userKey('reviewResolved'), {}),
  set: (v: ReviewState): void => save(userKey('reviewResolved'), v),
  clear: (): void => remove(userKey('reviewResolved')),
};

/** Ollama model selection and connection settings. */
export const modelSettings = {
  get: (): ModelSettings | null => load<ModelSettings | null>(userKey('modelSettings'), null),
  set: (v: ModelSettings): void => save(userKey('modelSettings'), v),
  clear: (): void => remove(userKey('modelSettings')),
};

/** Cross-tab UI preferences (selected tab only; jurisdiction is per-account now). */
export const ui = {
  getTab: (): NavTab => load<NavTab>('tab', 'asistente'),
  setTab: (t: NavTab): void => save('tab', t),
};

const USER_STORE_KEYS = [
  'session',
  'messages',
  'laws',
  'gazetteFeed',
  'extractorGazettes',
  'indexedDocs',
  'versions',
  'notifications',
  'logs',
  'reviewResolved',
  'modelSettings',
] as const;

/** Wipe the current user's data, their account record, and global tab pref. */
export function resetAll(): void {
  if (activeUserEmail !== null) {
    const prefix = `u:${encodeURIComponent(activeUserEmail)}:`;
    USER_STORE_KEYS.forEach((k) => remove(prefix + k));
    const all = accounts.get();
    delete all[activeUserEmail.trim().toLowerCase()];
    accounts.set(all);
    setUser(null);
  }
  remove('activeUser');
  remove('tab');
}

function isDocumentVersionArray(value: unknown): value is DocumentVersion[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'docId' in item &&
        'version' in item &&
        'hash' in item &&
        'uploadedAt' in item &&
        'content' in item &&
        'chunks' in item,
    )
  );
}

/**
 * Persist a value, detecting quota failures (save() degrades silently to the
 * in-memory mirror, so we verify the write round-tripped). On failure, prune
 * oldest DocumentVersion entries once and retry; otherwise report the problem.
 */
export function saveWithQuotaGuard<T>(key: string, value: T): { ok: boolean; warning?: string } {
  const persisted = (): boolean => {
    const raw = HAS_STORAGE ? window.localStorage.getItem(NAMESPACE + key) : memory.get(NAMESPACE + key);
    return raw === JSON.stringify(value);
  };

  save(key, value);
  if (persisted()) return { ok: true };

  if (isDocumentVersionArray(value) && value.length > 0) {
    const sorted = [...value].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
    const pruned = sorted.slice(Math.ceil(sorted.length / 2));
    save(key, pruned);
    const raw = HAS_STORAGE ? window.localStorage.getItem(NAMESPACE + key) : memory.get(NAMESPACE + key);
    if (raw === JSON.stringify(pruned)) return { ok: true };
  }

  return {
    ok: false,
    warning: 'Almacenamiento local lleno: libera espacio (borra documentos antiguos) e intenta de nuevo.',
  };
}

export const storage = {
  session,
  messages,
  laws,
  gazetteFeed,
  extractorGazettes,
  indexedDocs,
  versions,
  notifications,
  logs,
  reviewResolved,
  modelSettings,
  accounts,
  ui,
  resetAll,
};

export default storage;
