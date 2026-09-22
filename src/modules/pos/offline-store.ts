import type { PosCatalogItem, PosSaleInput, PosSession, PosTerminal } from "@/modules/pos/types";

const DATABASE_NAME = "bizos-pos";
const DATABASE_VERSION = 1;

type StoredCatalogItem = PosCatalogItem & { key: string; sessionId: string };
export type StoredPosOperation = PosSaleInput & { queuedAt: string };
export type StoredPosSession = PosSession & { terminal: PosTerminal };

type CatalogAllocation = {
  offlineAvailable: number;
  productId: string;
};

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

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function assertOfflineSession(
  session: StoredPosSession | undefined,
  capturedAt: string,
): asserts session is StoredPosSession {
  if (!session || !["open", "pending_sync"].includes(session.status)) {
    throw new Error("La caja local ya no está disponible.");
  }
  if (!session.terminal.offlineEnabled) {
    throw new Error("Esta terminal no permite ventas sin conexión.");
  }
  const capturedTime = Date.parse(capturedAt);
  if (
    !Number.isFinite(capturedTime)
    || capturedTime < Date.parse(session.openedAt)
    || capturedTime > Date.parse(session.authorizedUntil)
    || capturedTime > Date.now() + 5 * 60 * 1000
  ) {
    throw new Error("La autorización sin conexión venció. Recupera la conexión antes de vender.");
  }
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

export async function queuePosOperation(operation: PosSaleInput): Promise<StoredPosOperation> {
  const database = await openDatabase();
  const transaction = database.transaction(["operations", "catalog", "sessions"], "readwrite");
  try {
    const operations = transaction.objectStore("operations");
    const catalog = transaction.objectStore("catalog");
    const session = await requestResult(
      transaction.objectStore("sessions").get(operation.sessionId) as IDBRequest<StoredPosSession | undefined>,
    );
    assertOfflineSession(session, operation.capturedAt);

    const queued = await requestResult(
      operations.index("sessionId").getAll(operation.sessionId) as IDBRequest<StoredPosOperation[]>,
    );
    const pendingByProduct = new Map<string, number>();
    for (const row of queued) {
      for (const item of row.items) {
        pendingByProduct.set(
          item.productId,
          (pendingByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    for (const item of operation.items) {
      const snapshot = await requestResult(
        catalog.get(`${operation.sessionId}:${item.productId}`) as IDBRequest<StoredCatalogItem | undefined>,
      );
      if (!snapshot) throw new Error("El producto no pertenece al catálogo local autorizado.");
      const requested = (pendingByProduct.get(item.productId) ?? 0) + item.quantity;
      if (
        snapshot.productType === "producto"
        && requested > snapshot.offlineAvailable
      ) {
        throw new Error(`Cupo sin conexión insuficiente para ${snapshot.name}.`);
      }
      pendingByProduct.set(item.productId, requested);
    }

    const sequence = Math.max(
      session.lastSequence + 1,
      ...queued.map((row) => row.sequence + 1),
    );
    const stored = {
      ...operation,
      queuedAt: new Date().toISOString(),
      sequence,
    } satisfies StoredPosOperation;
    operations.add(stored);
    await transactionDone(transaction);
    return stored;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The browser already completed or aborted the transaction.
    }
    throw error;
  } finally {
    database.close();
  }
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

export async function completeQueuedPosOperation(
  operation: StoredPosOperation,
): Promise<CatalogAllocation[]> {
  const database = await openDatabase();
  const transaction = database.transaction(["operations", "catalog"], "readwrite");
  try {
    const operations = transaction.objectStore("operations");
    const stored = await requestResult(
      operations.get(operation.clientOperationId) as IDBRequest<StoredPosOperation | undefined>,
    );
    if (!stored) {
      await transactionDone(transaction);
      return [];
    }

    const catalog = transaction.objectStore("catalog");
    const allocations: CatalogAllocation[] = [];
    for (const item of stored.items) {
      const key = `${stored.sessionId}:${item.productId}`;
      const snapshot = await requestResult(
        catalog.get(key) as IDBRequest<StoredCatalogItem | undefined>,
      );
      if (!snapshot || snapshot.productType !== "producto") continue;
      const offlineAvailable = Math.max(0, snapshot.offlineAvailable - item.quantity);
      catalog.put({ ...snapshot, offlineAvailable });
      allocations.push({ offlineAvailable, productId: item.productId });
    }
    operations.delete(stored.clientOperationId);
    await transactionDone(transaction);
    return allocations;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The browser already completed or aborted the transaction.
    }
    throw error;
  } finally {
    database.close();
  }
}
