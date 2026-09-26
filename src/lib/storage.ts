const DATABASE_NAME = 'smartglasses-dashboard';
const DATABASE_VERSION = 1;
const RECORDINGS_STORE = 'recordings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support local video storage.'));
      return;
    }

    let settled = false;
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORDINGS_STORE)) {
        database.createObjectStore(RECORDINGS_STORE);
      }
    };
    request.onerror = () => {
      settled = true;
      reject(request.error ?? new Error('Local video storage could not be opened.'));
    };
    request.onblocked = () => {
      settled = true;
      reject(new Error('Close other dashboard tabs to enable local video storage.'));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    let request: IDBRequest<T>;
    let result: T;

    try {
      transaction = database.transaction(RECORDINGS_STORE, mode);
      request = operation(transaction.objectStore(RECORDINGS_STORE));
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    request.onsuccess = () => {
      result = request.result;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? request.error ?? new Error('Local video storage was interrupted.'));
    };
    transaction.onerror = () => {
      // The failed request aborts its transaction; onabort reports the final error.
    };
  });
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(blob, id));
}

export async function getRecording(id: string): Promise<Blob | undefined> {
  const recording: unknown = await runTransaction('readonly', (store) => store.get(id));
  return recording instanceof Blob ? recording : undefined;
}

export async function deleteRecording(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id));
}
