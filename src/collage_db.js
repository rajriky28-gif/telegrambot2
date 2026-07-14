const { sql } = require('@vercel/postgres');

const isPostgresEnabled = () => {
  return !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);
};

// In-memory fallback for local development/testing without environment variables
const memoryDb = new Map();
const memorySessions = new Map();

/**
 * Adds a photo file_id/url to the user's current list of images.
 * @param {string|number} userId - The Telegram user ID.
 * @param {string} fileId - The Telegram photo file_id or download URL.
 */
async function addImage(userId, fileId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    if (!memoryDb.has(userIdStr)) {
      memoryDb.set(userIdStr, []);
    }
    memoryDb.get(userIdStr).push(fileId);
    console.log(`[Collage Memory DB] Added image for user ${userIdStr}. Total: ${memoryDb.get(userIdStr).length}`);
    return;
  }

  try {
    await sql`
      INSERT INTO collage_images (chat_id, file_id)
      VALUES (${userIdStr}, ${fileId});
    `;
    console.log(`[Collage Postgres DB] Added image for user ${userIdStr}`);
  } catch (error) {
    console.error('Error adding collage image to Postgres:', error);
    throw error;
  }
}

/**
 * Retrieves the current list of photo file_ids/urls for a user.
 * @param {string|number} userId - The Telegram user ID.
 * @returns {Promise<string[]>} List of file_ids/urls.
 */
async function getImages(userId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    return memoryDb.get(userIdStr) || [];
  }

  try {
    const { rows } = await sql`
      SELECT file_id FROM collage_images
      WHERE chat_id = ${userIdStr}
      ORDER BY created_at ASC;
    `;
    return rows.map(row => row.file_id);
  } catch (error) {
    console.error('Error fetching collage images from Postgres:', error);
    throw error;
  }
}

/**
 * Clears the stored photo list for a user.
 * @param {string|number} userId - The Telegram user ID.
 */
async function clearImages(userId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    memoryDb.delete(userIdStr);
    console.log(`[Collage Memory DB] Cleared images for user ${userIdStr}`);
    return;
  }

  try {
    await sql`
      DELETE FROM collage_images
      WHERE chat_id = ${userIdStr};
    `;
    console.log(`[Collage Postgres DB] Cleared images for user ${userIdStr}`);
  } catch (error) {
    console.error('Error clearing collage images from Postgres:', error);
    throw error;
  }
}

/**
 * Saves the message ID of the last sent keyboard control panel.
 * @param {string|number} userId - The Telegram user ID.
 * @param {number} messageId - The Telegram message ID.
 */
async function setLastMessageId(userId, messageId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    memorySessions.set(userIdStr, messageId);
    return;
  }

  try {
    await sql`
      INSERT INTO collage_sessions (chat_id, last_message_id, updated_at)
      VALUES (${userIdStr}, ${messageId}, CURRENT_TIMESTAMP)
      ON CONFLICT (chat_id)
      DO UPDATE SET 
        last_message_id = EXCLUDED.last_message_id,
        updated_at = CURRENT_TIMESTAMP;
    `;
  } catch (error) {
    console.error('Error updating collage session last_message_id in Postgres:', error);
    throw error;
  }
}

/**
 * Retrieves the message ID of the last sent keyboard control panel.
 * @param {string|number} userId - The Telegram user ID.
 * @returns {Promise<number|null>}
 */
async function getLastMessageId(userId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    return memorySessions.get(userIdStr) || null;
  }

  try {
    const { rows } = await sql`
      SELECT last_message_id FROM collage_sessions
      WHERE chat_id = ${userIdStr};
    `;
    if (rows && rows.length > 0) {
      return rows[0].last_message_id;
    }
    return null;
  } catch (error) {
    console.error('Error fetching last_message_id from Postgres:', error);
    return null;
  }
}

/**
 * Deletes the saved message ID.
 * @param {string|number} userId - The Telegram user ID.
 */
async function clearLastMessageId(userId) {
  const userIdStr = String(userId);
  if (!isPostgresEnabled()) {
    memorySessions.delete(userIdStr);
    return;
  }

  try {
    await sql`
      UPDATE collage_sessions
      SET last_message_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ${userIdStr};
    `;
  } catch (error) {
    console.error('Error clearing last_message_id in Postgres:', error);
    throw error;
  }
}

module.exports = {
  addImage,
  getImages,
  clearImages,
  setLastMessageId,
  getLastMessageId,
  clearLastMessageId,
};
