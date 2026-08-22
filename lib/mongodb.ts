import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://legalwings:Legalwing123@cluster0.wxn2vix.mongodb.net/legalwings_crm?retryWrites=true&w=majority';
const DB_NAME = 'legalwings_crm';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
