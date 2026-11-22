const { MongoClient, ServerApiVersion } = require("mongodb");

let cachedClient = null;
let cachedDb = null;

async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in environment variables");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(process.env.MONGODB_DB_NAME || "equipmentRentalDB");
  return cachedDb;
}

module.exports = { connectDB };
