const { sql } = require('@vercel/postgres');

// In-memory fallback database for local development/testing
const memoryDb = new Map();

const isPostgresEnabled = () => {
  return !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);
};

async function initDb() {
  if (!isPostgresEnabled()) {
    console.log('Database URL not found. Using in-memory database fallback.');
    return;
  }

  try {
    // Create the table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS pokemon_images (
        chat_id VARCHAR(50) NOT NULL,
        file_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    // Create index for fast lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_pokemon_images_chat_id ON pokemon_images(chat_id);
    `;
    console.log('PostgreSQL database initialized successfully.');
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  }
}

async function addImage(chatId, fileId) {
  const chatIdStr = String(chatId);
  if (!isPostgresEnabled()) {
    if (!memoryDb.has(chatIdStr)) {
      memoryDb.set(chatIdStr, []);
    }
    memoryDb.get(chatIdStr).push({ fileId, createdAt: new Date() });
    console.log(`[Memory DB] Added image for chat ${chatIdStr}. Total: ${memoryDb.get(chatIdStr).length}`);
    return;
  }

  try {
    await sql`
      INSERT INTO pokemon_images (chat_id, file_id)
      VALUES (${chatIdStr}, ${fileId});
    `;
    console.log(`[Postgres DB] Added image for chat ${chatIdStr}`);
  } catch (error) {
    console.error('Error adding image to Postgres:', error);
    throw error;
  }
}

async function getImages(chatId) {
  const chatIdStr = String(chatId);
  if (!isPostgresEnabled()) {
    const images = memoryDb.get(chatIdStr) || [];
    return images.map(img => img.fileId);
  }

  try {
    const { rows } = await sql`
      SELECT file_id FROM pokemon_images
      WHERE chat_id = ${chatIdStr}
      ORDER BY created_at ASC;
    `;
    return rows.map(row => row.file_id);
  } catch (error) {
    console.error('Error fetching images from Postgres:', error);
    throw error;
  }
}

async function clearImages(chatId) {
  const chatIdStr = String(chatId);
  if (!isPostgresEnabled()) {
    memoryDb.delete(chatIdStr);
    console.log(`[Memory DB] Cleared images for chat ${chatIdStr}`);
    return;
  }

  try {
    await sql`
      DELETE FROM pokemon_images
      WHERE chat_id = ${chatIdStr};
    `;
    console.log(`[Postgres DB] Cleared images for chat ${chatIdStr}`);
  } catch (error) {
    console.error('Error clearing images from Postgres:', error);
    throw error;
  }
}

module.exports = {
  initDb,
  addImage,
  getImages,
  clearImages,
  isPostgresEnabled
};
