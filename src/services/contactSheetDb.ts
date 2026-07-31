const DB_NAME = 'contact_sheets_db';
const DB_VERSION = 1;

export interface ContactSheetSettings {
  imageFit: 'contain' | 'cover';
  showLabels: boolean;
  labelFontSize: number;
  labelColor: string;
  labelFontFamily: string;
  labelFontWeight: string;
  backgroundCanvas: 'white' | 'black' | 'charcoal' | 'transparent';
  headerStyle: 'minimal' | 'classic' | 'academic' | 'industrial';
  showFooter: boolean;
  footerShowPageNumber: boolean;
  footerCustomText: string;
  customTitle: string;
  customSubtitle: string;
  customDate: string;
  minimalRightTitle: string;
  cellBackgroundColor: 'white' | 'transparent' | 'slate-50' | 'slate-100' | 'slate-800' | 'black';
  headerFontSize?: number;
  headerColor?: string;
  headerFontFamily?: string;
  headerFontWeight?: string;
  pageSize?: 'A4' | 'Letter' | '12x12';
  pageOrientation?: 'portrait' | 'landscape';
  pageMargin?: 'narrow' | 'normal' | 'wide';
  gridRows?: number;
  gridCols?: number;
}

export interface SheetImage {
  id: string;
  name: string;
  dataUrl: string; // base64
}

export interface ContactSheetPage {
  id: string;
  folderName: string;
  images: SheetImage[];
  specName?: string;
  partNumber?: number;
}

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sheets')) {
        db.createObjectStore('sheets', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveSettings(settings: ContactSheetSettings): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ id: 'current', ...settings });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadSettings(): Promise<ContactSheetSettings | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('current');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSheets(sheets: ContactSheetPage[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sheets', 'readwrite');
    const store = tx.objectStore('sheets');
    
    // Clear old sheets first
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      let completed = 0;
      if (sheets.length === 0) {
        resolve();
        return;
      }
      for (const sheet of sheets) {
        const putRequest = store.put(sheet);
        putRequest.onsuccess = () => {
          completed++;
          if (completed === sheets.length) {
            resolve();
          }
        };
        putRequest.onerror = () => reject(putRequest.error);
      }
    };
    clearRequest.onerror = () => reject(clearRequest.error);
  });
}

export async function loadSheets(): Promise<ContactSheetPage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sheets', 'readonly');
    const store = tx.objectStore('sheets');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function wipeDatabase(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings', 'sheets'], 'readwrite');
    const settingsStore = tx.objectStore('settings');
    const sheetsStore = tx.objectStore('sheets');

    const clearSettings = settingsStore.clear();
    const clearSheets = sheetsStore.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
