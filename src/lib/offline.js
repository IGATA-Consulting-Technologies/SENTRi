import { openDB } from 'idb'

const DB_NAME = 'sentri-offline'
const DB_VERSION = 2

let db

async function getDB() {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('queue')) {
        const queue = database.createObjectStore('queue', { keyPath: 'localId', autoIncrement: true })
        queue.createIndex('synced', 'synced')
      }
      if (!database.objectStoreNames.contains('active_sessions')) {
        database.createObjectStore('active_sessions', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('checkout_cache')) {
        database.createObjectStore('checkout_cache', { keyPath: 'cacheKey' })
      }
      }
    }
  })
  return db
}

export async function queueMovement(movement) {
  const database = await getDB()
  return database.add('queue', { ...movement, synced: false, queuedAt: new Date().toISOString() })
}

export async function getUnsyncedMovements() {
  const database = await getDB()
  const all = await database.getAll('queue')
  return all.filter(m => !m.synced)
}

export async function markSynced(localId) {
  const database = await getDB()
  const record = await database.get('queue', localId)
  if (record) await database.put('queue', { ...record, synced: true })
}

export async function cacheActiveSessions(sessions) {
  const database = await getDB()
  const tx = database.transaction('active_sessions', 'readwrite')
  await tx.store.clear()
  for (const s of sessions) await tx.store.put(s)
  await tx.done
}

export async function getCachedActiveSessions() {
  const database = await getDB()
  return database.getAll('active_sessions')
}

export async function cacheAdmittedMovement(movement) {
  const database = await getDB()
  const cacheKey = movement.id || ('local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7))
  await database.put('checkout_cache', { ...movement, cacheKey })
}

export async function getCachedCheckouts() {
  const database = await getDB()
  return database.getAll('checkout_cache')
}

export async function removeCachedCheckout(cacheKey) {
  const database = await getDB()
  await database.delete('checkout_cache', cacheKey)
}
