// @ts-nocheck
import { DEFAULT_SETTINGS, entryKey } from "./core.js";
const DB_NAME = "spanish-vocab-trainer";
const DB_VERSION = 2;
const STORES = ["languagePairs", "datasets", "entries", "invalidLines", "duplicateConflicts", "quizSessions", "settings"];
let dbPromise;
export function openDb() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("datasets"))
                db.createObjectStore("datasets", { keyPath: "id" });
            if (!db.objectStoreNames.contains("languagePairs"))
                db.createObjectStore("languagePairs", { keyPath: "id" });
            if (!db.objectStoreNames.contains("entries")) {
                const store = db.createObjectStore("entries", { keyPath: "id" });
                store.createIndex("datasetId", "datasetId", { unique: false });
                store.createIndex("entryKey", "entryKey", { unique: false });
            }
            if (!db.objectStoreNames.contains("invalidLines")) {
                const store = db.createObjectStore("invalidLines", { keyPath: "id" });
                store.createIndex("datasetId", "datasetId", { unique: false });
            }
            if (!db.objectStoreNames.contains("duplicateConflicts")) {
                const store = db.createObjectStore("duplicateConflicts", { keyPath: "id" });
                store.createIndex("datasetId", "datasetId", { unique: false });
            }
            if (!db.objectStoreNames.contains("quizSessions"))
                db.createObjectStore("quizSessions", { keyPath: "id" });
            if (!db.objectStoreNames.contains("settings"))
                db.createObjectStore("settings", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}
async function tx(storeNames, mode, callback) {
    const db = await openDb();
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    const result = callback(stores, transaction);
    await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    return result;
}
function promisify(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function getAll(store) {
    return promisify(store.getAll());
}
function indexGetAll(store, indexName, value) {
    return promisify(store.index(indexName).getAll(value));
}
export class LanguagePairRepository {
    async create(pair) {
        await tx(["languagePairs"], "readwrite", ({ languagePairs }) => languagePairs.add(pair));
    }
    async update(pair) {
        await tx(["languagePairs"], "readwrite", ({ languagePairs }) => languagePairs.put(pair));
    }
    async list() {
        return tx(["languagePairs"], "readonly", async ({ languagePairs }) => (await getAll(languagePairs)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }
    async get(id) {
        return tx(["languagePairs"], "readonly", ({ languagePairs }) => promisify(languagePairs.get(id)));
    }
}
export class DatasetRepository {
    async create(dataset) {
        await tx(["datasets"], "readwrite", ({ datasets }) => datasets.add(dataset));
    }
    async update(dataset) {
        await tx(["datasets"], "readwrite", ({ datasets }) => datasets.put(dataset));
    }
    async delete(datasetId) {
        await tx(["datasets", "entries", "invalidLines", "duplicateConflicts"], "readwrite", ({ datasets, entries, invalidLines, duplicateConflicts }) => {
            datasets.delete(datasetId);
            deleteByIndex(entries, "datasetId", datasetId);
            deleteByIndex(invalidLines, "datasetId", datasetId);
            deleteByIndex(duplicateConflicts, "datasetId", datasetId);
        });
    }
    async list() {
        return tx(["datasets"], "readonly", async ({ datasets }) => (await getAll(datasets)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    }
    async get(datasetId) {
        return tx(["datasets"], "readonly", ({ datasets }) => promisify(datasets.get(datasetId)));
    }
}
function deleteByIndex(store, indexName, value) {
    const index = store.index(indexName);
    const request = index.openCursor(IDBKeyRange.only(value));
    request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };
}
export class VocabularyRepository {
    async addMany(entries) {
        await tx(["entries"], "readwrite", ({ entries: store }) => {
            entries.forEach((entry) => store.put({ ...sanitizeEntry(entry), entryKey: entryKey(entry) }));
        });
    }
    async getByDatasetIds(datasetIds) {
        if (datasetIds === "all")
            return this.getAll();
        const ids = new Set(datasetIds);
        return (await this.getAll()).filter((entry) => ids.has(entry.datasetId));
    }
    async getAll() {
        return tx(["entries"], "readonly", async ({ entries }) => (await getAll(entries)).map(sanitizeEntry));
    }
    async updateEntry(entry) {
        await tx(["entries"], "readwrite", ({ entries }) => entries.put({ ...sanitizeEntry(entry), entryKey: entryKey(entry) }));
    }
    async delete(id) {
        await tx(["entries"], "readwrite", ({ entries }) => entries.delete(id));
    }
    async updateMasteryCount(key, value) {
        await tx(["entries"], "readwrite", ({ entries }) => {
            const request = entries.index("entryKey").openCursor(IDBKeyRange.only(key));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.update({ ...cursor.value, masteryCount: value, updatedAt: new Date().toISOString() });
                    cursor.continue();
                }
            };
        });
    }
    async deleteByDatasetId(datasetId) {
        await tx(["entries"], "readwrite", ({ entries }) => deleteByIndex(entries, "datasetId", datasetId));
    }
}
function sanitizeEntry(entry) {
    const clean = { ...entry };
    if (clean.typeCode === 2) {
        const existingConjugation = clean.conjugation?.raw?.trim() || "";
        const legacyDetails = clean.details?.trim() || "";
        const raw = existingConjugation || legacyDetails;
        if (raw)
            clean.conjugation = { raw };
        else
            delete clean.conjugation;
        if (!existingConjugation && legacyDetails)
            delete clean.details;
    }
    else {
        delete clean.conjugation;
    }
    if (!clean.details?.trim())
        delete clean.details;
    return clean;
}
export class InvalidLineRepository {
    async addMany(lines) {
        await tx(["invalidLines"], "readwrite", ({ invalidLines }) => lines.forEach((line) => invalidLines.put(line)));
    }
    async listByDataset(datasetId) {
        return tx(["invalidLines"], "readonly", ({ invalidLines }) => indexGetAll(invalidLines, "datasetId", datasetId));
    }
    async delete(id) {
        await tx(["invalidLines"], "readwrite", ({ invalidLines }) => invalidLines.delete(id));
    }
}
export class DuplicateConflictRepository {
    async addMany(conflicts, datasetId) {
        await tx(["duplicateConflicts"], "readwrite", ({ duplicateConflicts }) => {
            conflicts.forEach((conflict) => duplicateConflicts.put({ ...conflict, datasetId }));
        });
    }
    async replaceByDataset(conflicts, datasetId) {
        await tx(["duplicateConflicts"], "readwrite", ({ duplicateConflicts }) => deleteByIndex(duplicateConflicts, "datasetId", datasetId));
        await this.addMany(conflicts, datasetId);
    }
    async listByDataset(datasetId) {
        return tx(["duplicateConflicts"], "readonly", ({ duplicateConflicts }) => indexGetAll(duplicateConflicts, "datasetId", datasetId));
    }
    async update(conflict) {
        await tx(["duplicateConflicts"], "readwrite", ({ duplicateConflicts }) => duplicateConflicts.put(conflict));
    }
}
export class QuizSessionRepository {
    async save(session) {
        await tx(["quizSessions"], "readwrite", ({ quizSessions }) => {
            quizSessions.clear();
            quizSessions.put({ ...session, id: "active", updatedAt: new Date().toISOString() });
        });
    }
    async getActive() {
        return tx(["quizSessions"], "readonly", ({ quizSessions }) => promisify(quizSessions.get("active")));
    }
    async clearActive() {
        await tx(["quizSessions"], "readwrite", ({ quizSessions }) => quizSessions.clear());
    }
}
export class SettingsRepository {
    async get() {
        const row = await tx(["settings"], "readonly", ({ settings }) => promisify(settings.get("user")));
        return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
    }
    async save(settings) {
        await tx(["settings"], "readwrite", ({ settings: store }) => store.put({ id: "user", value: settings }));
    }
}
export async function clearDatabase() {
    await tx(STORES, "readwrite", (stores) => {
        Object.values(stores).forEach((store) => store.clear());
    });
}
