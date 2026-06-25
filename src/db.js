const { sql } = require('@vercel/postgres');

// In-memory fallback databases for local development/testing
const memoryDb = new Map();
const memorySessions = new Map();
const processedUpdates = new Set();
const botKeysMemory = new Map();
const keyUsersMemory = new Map(); // key_code -> array of { userId, username, boundAt }
const keyAlertsMemory = [];
const fewShotExamplesMemory = [];

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
    
    // Create bot_keys table
    await sql`
      CREATE TABLE IF NOT EXISTS bot_keys (
        key_code VARCHAR(50) PRIMARY KEY,
        max_users INTEGER DEFAULT 1,
        expires_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        buyer_name VARCHAR(100)
      );
    `;
    await sql`ALTER TABLE bot_keys ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(100);`;

    // Create key_users binding table
    await sql`
      CREATE TABLE IF NOT EXISTS key_users (
        key_code VARCHAR(50) NOT NULL,
        telegram_user_id VARCHAR(50) NOT NULL,
        username VARCHAR(100),
        bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (key_code, telegram_user_id)
      );
    `;
    
    // Create key_alerts table
    await sql`
      CREATE TABLE IF NOT EXISTS key_alerts (
        id SERIAL PRIMARY KEY,
        key_code VARCHAR(50) NOT NULL,
        telegram_user_id VARCHAR(50) NOT NULL,
        username VARCHAR(100),
        reason VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create few_shot_examples table
    await sql`
      CREATE TABLE IF NOT EXISTS few_shot_examples (
        id SERIAL PRIMARY KEY,
        game_name VARCHAR(100) NOT NULL,
        file_ids TEXT NOT NULL,
        corrected_description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
        bound_key VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Add columns dynamically if the table already exists
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'AWAITING_GAME_NAME';`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS game_name VARCHAR(100);`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS template_pref VARCHAR(50);`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS custom_template TEXT;`;
    await sql`ALTER TABLE pokemon_sessions ADD COLUMN IF NOT EXISTS bound_key VARCHAR(50);`;

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
  bound_key: null,
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
      SELECT state, game_name, template_pref, custom_template, bound_key, last_message_id 
      FROM pokemon_sessions
      WHERE chat_id = ${chatIdStr};
    `;
    if (rows && rows.length > 0) {
      return {
        state: rows[0].state || 'AWAITING_GAME_NAME',
        game_name: rows[0].game_name,
        template_pref: rows[0].template_pref,
        custom_template: rows[0].custom_template,
        bound_key: rows[0].bound_key,
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
      INSERT INTO pokemon_sessions (chat_id, state, game_name, template_pref, custom_template, bound_key, last_message_id, updated_at)
      VALUES (${chatIdStr}, ${updated.state}, ${updated.game_name}, ${updated.template_pref}, ${updated.custom_template}, ${updated.bound_key}, ${updated.last_message_id}, CURRENT_TIMESTAMP)
      ON CONFLICT (chat_id)
      DO UPDATE SET 
        state = EXCLUDED.state,
        game_name = EXCLUDED.game_name,
        template_pref = EXCLUDED.template_pref,
        custom_template = EXCLUDED.custom_template,
        bound_key = EXCLUDED.bound_key,
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

async function validateKey(keyCode) {
  const code = String(keyCode).trim().toUpperCase();
  if (!isPostgresEnabled()) {
    const key = botKeysMemory.get(code);
    if (!key) return { valid: false, error: 'INVALID' };
    if (key.status === 'DEACTIVATED') return { valid: false, error: 'DEACTIVATED' };
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      key.status = 'EXPIRED';
      return { valid: false, error: 'EXPIRED' };
    }
    const boundUsers = keyUsersMemory.get(code) || [];
    if (boundUsers.length >= key.max_users) return { valid: false, error: 'LIMIT_EXCEEDED' };
    return { valid: true };
  }

  try {
    const { rows } = await sql`
      SELECT key_code, max_users, expires_at, status 
      FROM bot_keys 
      WHERE key_code = ${code};
    `;
    if (!rows || rows.length === 0) {
      return { valid: false, error: 'INVALID' };
    }

    const key = rows[0];
    if (key.status === 'DEACTIVATED') {
      return { valid: false, error: 'DEACTIVATED' };
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      await sql`UPDATE bot_keys SET status = 'EXPIRED' WHERE key_code = ${code};`;
      return { valid: false, error: 'EXPIRED' };
    }

    const userCountRes = await sql`
      SELECT COUNT(*) as count FROM key_users 
      WHERE key_code = ${code};
    `;
    const count = parseInt(userCountRes.rows[0].count, 10);
    if (count >= key.max_users) {
      return { valid: false, error: 'LIMIT_EXCEEDED' };
    }

    return { valid: true };
  } catch (err) {
    console.error('Error validating key:', err);
    return { valid: false, error: 'DB_ERROR' };
  }
}

async function bindKeyToUser(keyCode, telegramUserId, username = null) {
  const code = String(keyCode).trim().toUpperCase();
  const userIdStr = String(telegramUserId);
  const usernameStr = username ? String(username) : null;

  if (!isPostgresEnabled()) {
    if (!keyUsersMemory.has(code)) {
      keyUsersMemory.set(code, []);
    }
    const list = keyUsersMemory.get(code);
    if (!list.some(u => u.userId === userIdStr)) {
      list.push({ userId: userIdStr, username: usernameStr, boundAt: new Date() });
    }
    return;
  }

  try {
    await sql`
      INSERT INTO key_users (key_code, telegram_user_id, username)
      VALUES (${code}, ${userIdStr}, ${usernameStr})
      ON CONFLICT (key_code, telegram_user_id) DO NOTHING;
    `;
    await sql`
      UPDATE pokemon_sessions 
      SET bound_key = ${code}
      WHERE chat_id = ${userIdStr};
    `;
  } catch (err) {
    console.error('Error binding key to user:', err);
    throw err;
  }
}

async function isUserAuthorized(telegramUserId) {
  const userIdStr = String(telegramUserId);

  if (!isPostgresEnabled()) {
    // Check in-memory maps
    for (const [code, users] of keyUsersMemory.entries()) {
      if (users.some(u => u.userId === userIdStr)) {
        const key = botKeysMemory.get(code);
        if (key && key.status === 'ACTIVE') {
          if (!key.expires_at || new Date(key.expires_at) > new Date()) {
            return true;
          }
        }
      }
    }
    return false;
  }

  try {
    const { rows } = await sql`
      SELECT u.key_code 
      FROM key_users u
      JOIN bot_keys k ON u.key_code = k.key_code
      WHERE u.telegram_user_id = ${userIdStr}
        AND k.status = 'ACTIVE'
        AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP);
    `;
    return rows && rows.length > 0;
  } catch (err) {
    console.error('Error checking user authorization:', err);
    return false;
  }
}

async function getAdminKeys() {
  if (!isPostgresEnabled()) {
    const now = new Date();
    const list = [];
    for (const [code, key] of botKeysMemory.entries()) {
      if (key.status === 'ACTIVE' && key.expires_at && new Date(key.expires_at) < now) {
        key.status = 'EXPIRED';
      }
      const boundUsers = (keyUsersMemory.get(code) || []).map(u => ({
        user_id: u.userId,
        username: u.username,
        bound_at: u.boundAt
      }));
      list.push({
        key_code: code,
        max_users: key.max_users,
        expires_at: key.expires_at,
        status: key.status,
        created_at: key.created_at,
        buyer_name: key.buyer_name || null,
        users: boundUsers
      });
    }
    return list;
  }

  try {
    // Auto-expire active keys that have expired
    await sql`
      UPDATE bot_keys 
      SET status = 'EXPIRED' 
      WHERE status = 'ACTIVE' 
        AND expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP;
    `;

    const { rows } = await sql`
      SELECT k.key_code, k.max_users, k.expires_at, k.status, k.created_at, k.buyer_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'user_id', u.telegram_user_id, 
                   'username', u.username, 
                   'bound_at', u.bound_at
                 )
               ) FILTER (WHERE u.telegram_user_id IS NOT NULL), 
               '[]'
             ) as users
      FROM bot_keys k
      LEFT JOIN key_users u ON k.key_code = u.key_code
      GROUP BY k.key_code, k.max_users, k.expires_at, k.status, k.created_at, k.buyer_name
      ORDER BY k.created_at DESC;
    `;
    return rows.map(r => ({
      key_code: r.key_code,
      max_users: r.max_users,
      expires_at: r.expires_at,
      status: r.status,
      created_at: r.created_at,
      buyer_name: r.buyer_name,
      users: typeof r.users === 'string' ? JSON.parse(r.users) : r.users
    }));
  } catch (err) {
    console.error('Error getting admin keys:', err);
    return [];
  }
}

async function createKey(keyCode, maxUsers = 1, durationDays = null, buyerName = null) {
  const code = String(keyCode).trim().toUpperCase();
  const max = parseInt(maxUsers, 10) || 1;
  const buyer = buyerName ? String(buyerName).trim() : null;
  
  let expiresAt = null;
  if (durationDays && parseFloat(durationDays) > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseFloat(durationDays));
  }

  if (!isPostgresEnabled()) {
    botKeysMemory.set(code, {
      max_users: max,
      expires_at: expiresAt,
      status: 'ACTIVE',
      created_at: new Date(),
      buyer_name: buyer
    });
    keyUsersMemory.set(code, []);
    return;
  }

  try {
    await sql`
      INSERT INTO bot_keys (key_code, max_users, expires_at, status, buyer_name)
      VALUES (${code}, ${max}, ${expiresAt}, 'ACTIVE', ${buyer})
      ON CONFLICT (key_code) DO UPDATE SET
        max_users = EXCLUDED.max_users,
        expires_at = EXCLUDED.expires_at,
        status = 'ACTIVE',
        buyer_name = EXCLUDED.buyer_name;
    `;
  } catch (err) {
    console.error('Error creating key:', err);
    throw err;
  }
}

async function updateKeyStatus(keyCode, status) {
  const code = String(keyCode).trim().toUpperCase();
  const stat = String(status).trim().toUpperCase();

  if (!isPostgresEnabled()) {
    const key = botKeysMemory.get(code);
    if (key) {
      key.status = stat;
    }
    return;
  }

  try {
    await sql`
      UPDATE bot_keys 
      SET status = ${stat}
      WHERE key_code = ${code};
    `;
  } catch (err) {
    console.error('Error updating key status:', err);
    throw err;
  }
}

async function deleteKey(keyCode) {
  const code = String(keyCode).trim().toUpperCase();

  if (!isPostgresEnabled()) {
    botKeysMemory.delete(code);
    keyUsersMemory.delete(code);
    return;
  }

  try {
    await sql`
      DELETE FROM key_users 
      WHERE key_code = ${code};
    `;
    await sql`
      DELETE FROM bot_keys 
      WHERE key_code = ${code};
    `;
  } catch (err) {
    console.error('Error deleting key:', err);
    throw err;
  }
}

async function logAlert(keyCode, telegramUserId, username, reason) {
  const code = String(keyCode).trim().toUpperCase();
  const userIdStr = String(telegramUserId);
  const usernameStr = username ? String(username) : null;
  const reasonStr = String(reason);

  if (!isPostgresEnabled()) {
    keyAlertsMemory.push({
      key_code: code,
      telegram_user_id: userIdStr,
      username: usernameStr,
      reason: reasonStr,
      created_at: new Date()
    });
    // Limit memory alerts size
    if (keyAlertsMemory.length > 200) {
      keyAlertsMemory.shift();
    }
    return;
  }

  try {
    await sql`
      INSERT INTO key_alerts (key_code, telegram_user_id, username, reason)
      VALUES (${code}, ${userIdStr}, ${usernameStr}, ${reasonStr});
    `;
  } catch (err) {
    console.error('Error logging alert:', err);
  }
}

async function getAlerts() {
  if (!isPostgresEnabled()) {
    return [...keyAlertsMemory].sort((a, b) => b.created_at - a.created_at);
  }

  try {
    const { rows } = await sql`
      SELECT id, key_code, telegram_user_id, username, reason, created_at
      FROM key_alerts
      ORDER BY created_at DESC
      LIMIT 100;
    `;
    return rows;
  } catch (err) {
    console.error('Error getting alerts:', err);
    return [];
  }
}

async function clearAlerts() {
  if (!isPostgresEnabled()) {
    keyAlertsMemory.length = 0;
    return;
  }

  try {
    await sql`DELETE FROM key_alerts;`;
  } catch (err) {
    console.error('Error clearing alerts:', err);
    throw err;
  }
}

async function unbindUser(keyCode, telegramUserId) {
  const code = String(keyCode).trim().toUpperCase();
  const userIdStr = String(telegramUserId);

  if (!isPostgresEnabled()) {
    if (keyUsersMemory.has(code)) {
      const list = keyUsersMemory.get(code);
      keyUsersMemory.set(code, list.filter(u => u.userId !== userIdStr));
    }
    return;
  }

  try {
    await sql`
      DELETE FROM key_users 
      WHERE key_code = ${code} AND telegram_user_id = ${userIdStr};
    `;
    await sql`
      UPDATE pokemon_sessions 
      SET bound_key = NULL
      WHERE chat_id = ${userIdStr} AND bound_key = ${code};
    `;
  } catch (err) {
    console.error('Error unbinding user:', err);
    throw err;
  }
}

async function addFewShotExample(gameName, fileIds, correctedDescription) {
  const game = String(gameName).trim();
  const desc = String(correctedDescription).trim();

  if (!isPostgresEnabled()) {
    fewShotExamplesMemory.push({
      game_name: game,
      file_ids: fileIds,
      corrected_description: desc,
      created_at: new Date()
    });
    if (fewShotExamplesMemory.length > 50) {
      fewShotExamplesMemory.shift();
    }
    return;
  }

  try {
    const fileIdsStr = JSON.stringify(fileIds);
    await sql`
      INSERT INTO few_shot_examples (game_name, file_ids, corrected_description)
      VALUES (${game}, ${fileIdsStr}, ${desc});
    `;
  } catch (err) {
    console.error('Error adding few-shot example:', err);
    throw err;
  }
}

async function getFewShotExamples(gameName, limit = 3) {
  const game = String(gameName).trim();

  if (!isPostgresEnabled()) {
    return fewShotExamplesMemory
      .filter(ex => ex.game_name.toLowerCase() === game.toLowerCase())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map(ex => ({
        file_ids: ex.file_ids,
        corrected_description: ex.corrected_description
      }));
  }

  try {
    const { rows } = await sql`
      SELECT file_ids, corrected_description
      FROM few_shot_examples
      WHERE LOWER(game_name) = LOWER(${game})
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;
    return rows.map(row => ({
      file_ids: JSON.parse(row.file_ids),
      corrected_description: row.corrected_description
    }));
  } catch (err) {
    console.error('Error fetching few-shot examples:', err);
    return [];
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
  updateSession,
  validateKey,
  bindKeyToUser,
  isUserAuthorized,
  getAdminKeys,
  createKey,
  updateKeyStatus,
  deleteKey,
  logAlert,
  getAlerts,
  clearAlerts,
  unbindUser,
  addFewShotExample,
  getFewShotExamples
};
