const db = require('../src/db');
const gemini = require('../src/gemini');

// Helper to send messages to Telegram
async function sendTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// Helper to download a file from Telegram
async function downloadTelegramFile(fileId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');

  const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  
  if (!fileInfo.ok) {
    throw new Error(`Failed to get file info for ${fileId}: ${fileInfo.description}`);
  }

  const filePath = fileInfo.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download file from ${downloadUrl}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = async (req, res) => {
  // Always initialize db (checks if table exists if Postgres is enabled)
  try {
    await db.initDb();
  } catch (dbErr) {
    console.error('Database initialization failed:', dbErr);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const update = req.body;
  if (!update || !update.message) {
    // Return 200 to acknowledge Telegram even for empty updates or edits
    return res.status(200).send('OK');
  }

  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text ? message.text.trim() : '';

  try {
    // 1. Handle commands
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: `👋 *Welcome to the Pokemon Go Account Sales Description Generator!*

I can analyze screenshots of your Pokemon Go account and automatically generate a sales description matching your template.

**How to use:**
1️⃣ Send me one or more screenshots or collages of your Pokemon Go account (e.g., profile page, items page, Pokemon storage, high CP/shiny lists).
2️⃣ Send **multiple screenshots** one by one. I will save them to your active session.
3️⃣ Type /generate when you are done. I'll read all images at once and generate your description.
4️⃣ Type /clear to delete the images in your current session and start over.

Send your first image/collage now!`,
        parse_mode: 'Markdown'
      });
      return res.status(200).send('OK');
    }

    if (text.startsWith('/clear')) {
      await db.clearImages(chatId);
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: '🧹 *Session cleared!* All uploaded screenshots have been removed. You can now send new images to start a new description.',
        parse_mode: 'Markdown'
      });
      return res.status(200).send('OK');
    }

    if (text.startsWith('/generate')) {
      const fileIds = await db.getImages(chatId);
      if (!fileIds || fileIds.length === 0) {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '⚠️ *No images found!* Please send me some screenshots of your account first.',
          parse_mode: 'Markdown'
        });
        return res.status(200).send('OK');
      }

      // Notify user that analysis is starting
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: `🤖 Analyzing *${fileIds.length}* image(s) and generating description... This may take up to 10-15 seconds. Please wait.`,
        parse_mode: 'Markdown'
      });

      try {
        // Download all images from Telegram in parallel
        const downloadPromises = fileIds.map(fileId => downloadTelegramFile(fileId));
        const imageBuffers = await Promise.all(downloadPromises);

        // Generate description using Gemini API
        const description = await gemini.generateDescription(imageBuffers);

        // Send description to user
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: description
        });

        // Send a finishing message
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '✅ *Description generated successfully!*\n\nIf you want to create a new description, send `/clear` first to remove the current screenshots.',
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Error during generation:', err);
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: `❌ *Error generating description:* ${err.message || err}\n\nPlease try again. If it keeps failing, try running /clear and uploading fewer/smaller images.`
        });
      }

      return res.status(200).send('OK');
    }

    // 2. Handle incoming photos or documents (images)
    let fileId = null;
    if (message.photo && message.photo.length > 0) {
      // Get a medium-high resolution photo (usually around 800px, index 2)
      // This is perfectly readable for the AI, but 20 times smaller in file size.
      const targetIndex = Math.min(message.photo.length - 1, 2);
      fileId = message.photo[targetIndex].file_id;
    } else if (message.document && message.document.mime_type && message.document.mime_type.startsWith('image/')) {
      fileId = message.document.file_id;
    }

    if (fileId) {
      await db.addImage(chatId, fileId);
      const allFiles = await db.getImages(chatId);
      
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: `📸 *Image saved to session!*\n\n• Images in session: *${allFiles.length}*\n• Send more images, or type /generate when you are done.\n• Type /clear to start over.`,
        parse_mode: 'Markdown'
      });
      return res.status(200).send('OK');
    }

    // 3. Handle unhandled messages
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '🤖 *I didn\'t recognize that command.*\n\n• Send screenshots/collages to add them to your session.\n• Type /generate to write the sales description.\n• Type /clear to clear the session.\n• Type /help for instructions.',
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Webhook error:', error);
  }

  // Always return 200 OK to prevent Telegram webhook retries
  return res.status(200).send('OK');
};
