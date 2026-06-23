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

// Function to handle Generate Action
async function handleGenerate(chatId) {
  const fileIds = await db.getImages(chatId);
  if (!fileIds || fileIds.length === 0) {
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '⚠️ *No images found!* Please send me some screenshots of your account first.',
      parse_mode: 'Markdown'
    });
    return;
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

    // Send a finishing message with clear instruction and inline button
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '✅ *Description generated successfully!*\n\n⚠️ **Important:** Please clear this session before starting the next account! If you do not clear it, the next screenshots will be mixed with this one.',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { "text": "🧹 Clear Session & Start Next ID", "callback_data": "action_clear" }
          ]
        ]
      }
    });

    // Reset last message ID since we finished this session
    await db.setLastMessageId(chatId, null);
  } catch (err) {
    console.error('Error during generation:', err);
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: `❌ *Error generating description:* ${err.message || err}\n\nPlease try again. If it keeps failing, try running /clear and uploading fewer/smaller images.`
    });
  }
}

// Function to handle Clear Action
async function handleClear(chatId, messageId = null) {
  await db.clearImages(chatId);

  const clearText = '🧹 *Session cleared!* All uploaded screenshots have been removed. You can now send new images to start a new description.';
  
  if (messageId) {
    try {
      await sendTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: clearText,
        parse_mode: 'Markdown'
        // No reply_markup = removes keyboard
      });
      return;
    } catch (e) {
      console.warn('Failed to edit clear message:', e);
    }
  }

  // Fallback to sending a new message
  await sendTelegram('sendMessage', {
    chat_id: chatId,
    text: clearText,
    parse_mode: 'Markdown'
  });
}

module.exports = async (req, res) => {
  // Always initialize db
  try {
    await db.initDb();
  } catch (dbErr) {
    console.error('Database initialization failed:', dbErr);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const update = req.body;
  if (!update) {
    return res.status(200).send('OK');
  }

  // 1. Handle Callback Queries (Button Clicks)
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Acknowledge the callback query so the button stops loading
    try {
      await sendTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id
      });
    } catch (cbErr) {
      console.error('Failed to answer callback query:', cbErr);
    }

    if (data === 'action_generate') {
      await handleGenerate(chatId);
    } else if (data === 'action_clear') {
      await handleClear(chatId, messageId);
    }

    return res.status(200).send('OK');
  }

  // 2. Handle standard messages
  const message = update.message;
  if (!message) {
    return res.status(200).send('OK');
  }

  const chatId = message.chat.id;
  const text = message.text ? message.text.trim() : '';

  try {
    // A. Handle commands
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await db.clearImages(chatId); // Auto clear session on start
      
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: `👋 *Welcome to the Pokemon Go Account Sales Description Generator!*

I can analyze screenshots of your Pokemon Go account and automatically generate a sales description matching your template.

**How to use:**
1️⃣ Send me screenshots or collages of your Pokemon Go account (e.g. profile, shiny list, item storage, CP order).
2️⃣ I will save them to your active session and show you a live counter.
3️⃣ Use the interactive buttons below the counter to **Generate** or **Clear** your session.

Send your first image/collage now!`,
        parse_mode: 'Markdown'
      });
      return res.status(200).send('OK');
    }

    if (text.startsWith('/clear')) {
      await handleClear(chatId);
      return res.status(200).send('OK');
    }

    if (text.startsWith('/generate')) {
      await handleGenerate(chatId);
      return res.status(200).send('OK');
    }

    // B. Handle photo/document uploads
    let fileId = null;
    if (message.photo && message.photo.length > 0) {
      // Get medium-high resolution photo (usually around 800px width, index 2)
      const targetIndex = Math.min(message.photo.length - 1, 2);
      fileId = message.photo[targetIndex].file_id;
    } else if (message.document && message.document.mime_type && message.document.mime_type.startsWith('image/')) {
      fileId = message.document.file_id;
    }

    if (fileId) {
      await db.addImage(chatId, fileId);
      const allFiles = await db.getImages(chatId);
      const lastMessageId = await db.getLastMessageId(chatId);

      const statusText = `📸 *Screenshots saved to session!*

• Total screenshots in session: *${allFiles.length}*

You can send more screenshots, or use the buttons below when you are ready.`;

      const keyboard = {
        inline_keyboard: [
          [
            { "text": "⚡ Generate Description", "callback_data": "action_generate" },
            { "text": "🧹 Clear Session", "callback_data": "action_clear" }
          ]
        ]
      };

      let messageEdited = false;
      if (lastMessageId) {
        try {
          const editRes = await sendTelegram('editMessageText', {
            chat_id: chatId,
            message_id: lastMessageId,
            text: statusText,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          
          if (editRes.ok) {
            messageEdited = true;
          }
        } catch (editErr) {
          console.warn('Failed to edit previous message:', editErr);
        }
      }

      if (!messageEdited) {
        const sendRes = await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: statusText,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });

        if (sendRes.ok && sendRes.result) {
          await db.setLastMessageId(chatId, sendRes.result.message_id);
        }
      }

      return res.status(200).send('OK');
    }

    // C. Handle unhandled messages
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '🤖 *I didn\'t recognize that command.*\n\n• Send screenshots/collages to add them to your session.\n• Use the buttons below the counter to manage your session.',
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Webhook error:', error);
  }

  // Always return 200 OK to prevent Telegram webhook retries
  return res.status(200).send('OK');
};
