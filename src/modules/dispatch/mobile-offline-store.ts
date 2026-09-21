import type { DispatchMobileTargetStatus } from "@/modules/dispatch/types";

const DATABASE_NAME = "bizos-dispatch";
const DATABASE_VERSION = 1;

export type QueuedDispatchEvidence = {
  blob: Blob;
  fileName: string;
  kind: "photo" | "signature";
  mimeType: string;
};

export type QueuedDispatchOperation = {
  accuracyMeters?: number;
  capturedAt: string;
  dispatchId: string;
  evidence: QueuedDispatchEvidence[];
  latitude?: number;
  longitude?: number;
  operationId: string;
  queuedAt: string;
  receiverName?: string;
  result?: string;
  targetStatus: DispatchMobileTargetStatus;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("operations")) {
        const store = database.createObjectStore("operations", { keyPath: "operationId" });
        store.createIndex("dispatchId", "dispatchId", { unique: false });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
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

export async function queueDispatchOperation(
  operation: Omit<QueuedDispatchOperation, "queuedAt">,
) {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  transaction.objectStore("operations").put({
    ...operation,
    queuedAt: new Date().toISOString(),
  } satisfies QueuedDispatchOperation);
  await transactionDone(transaction);
  database.close();
}

export async function getQueuedDispatchOperations() {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readonly");
  const request = transaction.objectStore("operations").index("queuedAt").getAll();
  const rows = await new Promise<QueuedDispatchOperation[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as QueuedDispatchOperation[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return rows;
}

export async function removeQueuedDispatchOperation(operationId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  transaction.objectStore("operations").delete(operationId);
  await transactionDone(transaction);
  database.close();
}
