const { sql } = require('@vercel/postgres');

// In-memory fallback databases for local development/testing
const memoryDb = new Map();
const memorySessions = new Map();
const processedUpdates = new Set();

const isPostgresEnabled = () => {
  return !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);
};

async function initDb() {
  if (!isPostgresEnabled()) {
    console.log('Database URL not found. Using in-memory database fallback.');
    return;
  }

  try {
    // Create the image list table if it doesn't exist
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
    
    // Create the sessions table to track last_message_id and conversational state
    await sql`
      CREATE TABLE IF NOT EXISTS pokemon_sessions (
        chat_id VARCHAR(50) PRIMARY KEY,
        last_message_id INTEGER,
        state VARCHAR(50) DEFAULT 'AWAITING_GAME_NAME',
        game_name VARCHAR(100),
        template_pref VARCHAR(50),
        custom_template TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Add columns dynamically if the table already exists
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'AWAITING_GAME_NAME';`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS game_name VARCHAR(100);`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS template_pref VARCHAR(50);`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS custom_template TEXT;`;

    // Create the processed updates table for webhook deduplication
    await sql`
      CREATE TABLE IF NOT EXISTS processed_updates (
        update_id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Prune old processed updates (older than 1 day) to keep db clean
    await sql`
      DELETE FROM processed_updates
      WHERE created_at < NOW() - INTERVAL '1 day';
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

const defaultSession = {
  state: 'AWAITING_GAME_NAME',
  game_name: null,
  template_pref: null,
  custom_template: null,
  last_message_id: null
};

async function getSession(chatId) {
  const chatIdStr = String(chatId);
  if (!isPostgresEnabled()) {
    if (!memorySessions.has(chatIdStr)) {
      memorySessions.set(chatIdStr, { ...defaultSession });
    }
    return memorySessions.get(chatIdStr);
  }

  try {
    const { rows } = await sql`
      SELECT state, game_name, template_pref, custom_template, last_message_id 
      FROM pokemon_sessions
      WHERE chat_id = ${chatIdStr};
    `;
    if (rows && rows.length > 0) {
      return {
        state: rows[0].state || 'AWAITING_GAME_NAME',
        game_name: rows[0].game_name,
        template_pref: rows[0].template_pref,
        custom_template: rows[0].custom_template,
        last_message_id: rows[0].last_message_id
      };
    }
    return { ...defaultSession };
  } catch (error) {
    console.error('Error getting session:', error);
    return { ...defaultSession };
  }
}

async function updateSession(chatId, updates) {
  const chatIdStr = String(chatId);
  const current = await getSession(chatId);
  const updated = { ...current, ...updates };

  if (!isPostgresEnabled()) {
    memorySessions.set(chatIdStr, updated);
    return;
  }

  try {
    await sql`
      INSERT INTO pokemon_sessions (chat_id, state, game_name, template_pref, custom_template, last_message_id, updated_at)
      VALUES (${chatIdStr}, ${updated.state}, ${updated.game_name}, ${updated.template_pref}, ${updated.custom_template}, ${updated.last_message_id}, CURRENT_TIMESTAMP)
      ON CONFLICT (chat_id)
      DO UPDATE SET 
        state = EXCLUDED.state,
        game_name = EXCLUDED.game_name,
        template_pref = EXCLUDED.template_pref,
        custom_template = EXCLUDED.custom_template,
        last_message_id = EXCLUDED.last_message_id,
        updated_at = CURRENT_TIMESTAMP;
    `;
  } catch (error) {
    console.error('Error updating session:', error);
    throw error;
  }
}

async function clearImages(chatId) {
  const chatIdStr = String(chatId);
  if (!isPostgresEnabled()) {
    memoryDb.delete(chatIdStr);
    memorySessions.set(chatIdStr, { ...defaultSession });
    console.log(`[Memory DB] Cleared images and session for chat ${chatIdStr}`);
    return;
  }

  try {
    await sql`
      DELETE FROM pokemon_images
      WHERE chat_id = ${chatIdStr};
    `;
    await sql`
      UPDATE pokemon_sessions 
      SET state = 'AWAITING_GAME_NAME', game_name = NULL, template_pref = NULL, custom_template = NULL, last_message_id = NULL
      WHERE chat_id = ${chatIdStr};
    `;
    console.log(`[Postgres DB] Cleared images and session for chat ${chatIdStr}`);
  } catch (error) {
    console.error('Error clearing images from Postgres:', error);
    throw error;
  }
}

async function setLastMessageId(chatId, messageId) {
  await updateSession(chatId, { last_message_id: messageId });
}

async function getLastMessageId(chatId) {
  const session = await getSession(chatId);
  return session.last_message_id;
}

async function checkAndMarkUpdateProcessed(updateId) {
  const updateIdStr = String(updateId);
  if (!isPostgresEnabled()) {
    if (processedUpdates.has(updateIdStr)) {
      return true; // Already processed
    }
    processedUpdates.add(updateIdStr);
    
    // Prune memory updates list if too large
    if (processedUpdates.size > 1000) {
      const first = processedUpdates.keys().next().value;
      processedUpdates.delete(first);
    }
    return false; // New update
  }

  try {
    await sql`
      INSERT INTO processed_updates (update_id)
      VALUES (${updateIdStr});
    `;
    return false; // New update, inserted successfully
  } catch (error) {
    // Postgres Unique Violation code is '23505'
    if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('already exists')) {
      console.log(`[Postgres DB] Duplicate update detected: ${updateIdStr}`);
      return true; // Already processed
    }
    console.error('Error checking processed update:', error);
    return false; // On failure, continue to process to avoid getting stuck
  }
}

module.exports = {
  initDb,
  addImage,
  getImages,
  clearImages,
  setLastMessageId,
  getLastMessageId,
  checkAndMarkUpdateProcessed,
  isPostgresEnabled,
  getSession,
  updateSession
};
