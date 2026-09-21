import type { PosCatalogItem, PosSaleInput, PosSession, PosTerminal } from "@/modules/pos/types";

const DATABASE_NAME = "bizos-pos";
const DATABASE_VERSION = 1;

type StoredCatalogItem = PosCatalogItem & { key: string; sessionId: string };
export type StoredPosOperation = PosSaleInput & { queuedAt: string };
export type StoredPosSession = PosSession & { terminal: PosTerminal };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("operations")) {
        const operations = database.createObjectStore("operations", { keyPath: "clientOperationId" });
        operations.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!database.objectStoreNames.contains("catalog")) {
        const catalog = database.createObjectStore("catalog", { keyPath: "key" });
        catalog.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!database.objectStoreNames.contains("sessions")) {
        database.createObjectStore("sessions", { keyPath: "id" });
      }
    };
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function savePosSession(session: PosSession, terminal: PosTerminal) {
  const database = await openDatabase();
  const transaction = database.transaction("sessions", "readwrite");
  transaction.objectStore("sessions").put({ ...session, terminal } satisfies StoredPosSession);
  await transactionDone(transaction);
  database.close();
}

export async function savePosCatalog(sessionId: string, items: PosCatalogItem[]) {
  if (items.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction("catalog", "readwrite");
  const store = transaction.objectStore("catalog");
  for (const item of items) {
    store.put({ ...item, key: `${sessionId}:${item.productId}`, sessionId } satisfies StoredCatalogItem);
  }
  await transactionDone(transaction);
  database.close();
}

export async function queuePosOperation(operation: PosSaleInput) {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  transaction.objectStore("operations").put({ ...operation, queuedAt: new Date().toISOString() } satisfies StoredPosOperation);
  await transactionDone(transaction);
  database.close();
}

export async function getQueuedPosOperations(sessionId: string): Promise<StoredPosOperation[]> {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readonly");
  const request = transaction.objectStore("operations").index("sessionId").getAll(sessionId);
  const rows = await new Promise<StoredPosOperation[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as StoredPosOperation[]).sort((a, b) => a.sequence - b.sequence));
    request.onerror = () => reject(request.error);
  });
  database.close();
  return rows;
}

export async function removeQueuedPosOperation(clientOperationId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  transaction.objectStore("operations").delete(clientOperationId);
  await transactionDone(transaction);
  database.close();
}
