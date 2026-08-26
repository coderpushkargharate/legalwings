import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://legalwings:Legalwing123@cluster0.wxn2vix.mongodb.net/legalwings_crm?retryWrites=true&w=majority';
const DB_NAME = 'legalwings_crm';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesEnsured = false;

// Create the indexes the leads list queries rely on (filter by team/assignment/
// appointment + sort by createdAt). Without these, every request is a full
// collection scan, which is the main cause of slow reloads. Runs once per
// process, fire-and-forget, and never blocks a request (createIndex is a no-op
// when the index already exists).
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    const leads = db.collection('leads');
    await Promise.all([
      leads.createIndex({ createdAt: -1 }),
      leads.createIndex({ transitLevel: 1 }),
      leads.createIndex({ visibleToTeams: 1 }),
      leads.createIndex({ assignedToUserId: 1 }),
      leads.createIndex({ createdByUserId: 1 }),
      leads.createIndex({ isAppointment: 1 }),
      leads.createIndex({ 'agreement.tokenNo': 1 }),
      leads.createIndex({ 'client.phoneNo': 1 }),
    ]);
  } catch (err) {
    // Never fatal — indexing is a best-effort optimization.
    console.error('ensureIndexes failed (non-fatal):', err);
    indexesEnsured = false;
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  // Kick off index creation once, without blocking this (or any) request.
  void ensureIndexes(db);

  return { client, db };
}
