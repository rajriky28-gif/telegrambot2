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

// Prompt Helper: Game Selection
async function sendGameSelectionPrompt(chatId, messageId = null) {
  const text = `🎮 *Which game is this description for?*
  
Please select one of the popular games below, or simply *type the name of any game* in the world to begin:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🎮 Pokémon GO", callback_data: "game_Pokemon Go" },
        { text: "🛡️ Clash of Clans", callback_data: "game_Clash of Clans" }
      ],
      [
        { text: "🔫 PUBG Mobile", callback_data: "game_PUBG Mobile" },
        { text: "🔥 Free Fire", callback_data: "game_Free Fire" }
      ],
      [
        { text: "⚡ Brawl Stars", callback_data: "game_Brawl Stars" },
        { text: "🏆 Mobile Legends", callback_data: "game_Mobile Legends" }
      ]
    ]
  };

  let sent = false;
  if (messageId) {
    try {
      const res = await sendTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      if (res.ok) sent = true;
    } catch (e) {
      console.warn('Failed to edit to game selection:', e);
    }
  }

  if (!sent) {
    const res = await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    if (res.ok && res.result) {
      await db.setLastMessageId(chatId, res.result.message_id);
    }
  }
}

// Prompt Helper: Template Preference
async function sendTemplatePreferencePrompt(chatId, gameName, messageId = null) {
  const text = `Perfect! You selected *${gameName}*.

Now, how would you like to structure the description?

Choose an option below:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📄 Custom Template (Chat/PDF)", callback_data: "pref_custom" },
        { text: "🤖 Auto-Design Layout", callback_data: "pref_auto" }
      ],
      [
        { text: "🔙 Back (Change Game)", callback_data: "back_to_game" }
      ]
    ]
  };

  let sent = false;
  if (messageId) {
    try {
      const res = await sendTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      if (res.ok) sent = true;
    } catch (e) {
      console.warn('Failed to edit template pref:', e);
    }
  }

  if (!sent) {
    const res = await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    if (res.ok && res.result) {
      await db.setLastMessageId(chatId, res.result.message_id);
    }
  }
}

// Prompt Helper: Custom Template Request
async function sendAwaitingCustomTemplatePrompt(chatId, gameName, messageId = null) {
  const text = `Please provide your custom template for *${gameName}* now.

• **Type or paste** the template text in chat.
• Or **upload a file** (.txt or .pdf) containing the template structure.

_Make sure it describes the layout fields (e.g. Level: {level}, Skins: {skins}). We will automatically customize it and omit lines with empty/missing data._`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🤖 Switch to Auto-Design", callback_data: "pref_auto" }
      ],
      [
        { text: "🔙 Back (Change Game)", callback_data: "back_to_game" }
      ]
    ]
  };

  let sent = false;
  if (messageId) {
    try {
      const res = await sendTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      if (res.ok) sent = true;
    } catch (e) {
      console.warn('Failed to edit to custom template prompt:', e);
    }
  }

  if (!sent) {
    const res = await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    if (res.ok && res.result) {
      await db.setLastMessageId(chatId, res.result.message_id);
    }
  }
}

// Dashboard Helper: Updates or sends screenshot count message
async function updateDashboard(chatId, session, fileCount) {
  const statusText = `📸 *Active Session Started!*

• Game: *${session.game_name}*
• Style: *${session.template_pref === 'AUTO' ? '🤖 Auto-Design Layout' : '📄 Custom Template'}*
• Total Screenshots: *${fileCount}*

${fileCount === 0 
  ? 'Please upload your account screenshots now. I will update the count automatically.'
  : 'You can send more screenshots, or use the buttons below to generate the description.'}`;

  const keyboard = {
    inline_keyboard: []
  };

  if (fileCount > 0) {
    keyboard.inline_keyboard.push([
      { "text": "⚡ Generate Description", "callback_data": "action_generate" }
    ]);
  }
  keyboard.inline_keyboard.push([
    { "text": "🧹 Start Over (Clear Session)", "callback_data": "action_clear" }
  ]);

  const lastMessageId = session.last_message_id;
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
      console.warn('Failed to edit status message:', editErr);
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
      await db.updateSession(chatId, { last_message_id: sendRes.result.message_id });
    }
  }
}

// Function to handle Generate Action
async function handleGenerate(chatId, messageId = null) {
  const session = await db.getSession(chatId);
  const gameName = session.game_name || 'General Game';

  // Hide buttons immediately to prevent duplicate clicks
  const msgId = messageId || session.last_message_id;
  if (msgId) {
    try {
      await sendTelegram('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: `🤖 *Generating Description...*\n\nAnalyzing screenshots for *${gameName}* and creating your description. Please wait up to 10-15 seconds.`,
        parse_mode: 'Markdown'
      });
    } catch (e) {
      console.warn('Failed to hide buttons:', e);
    }
  }

  const fileIds = await db.getImages(chatId);
  if (!fileIds || fileIds.length === 0) {
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '⚠️ *No images found!* Please send me some screenshots of your account first.',
      parse_mode: 'Markdown'
    });
    return;
  }

  try {
    // Download all images from Telegram in parallel
    const downloadPromises = fileIds.map(fileId => downloadTelegramFile(fileId));
    const imageBuffers = await Promise.all(downloadPromises);

    // Fetch few-shot reference examples (limit to 2 to avoid huge payloads or prompt clutter)
    let fewShotExamples = [];
    try {
      const examples = await db.getFewShotExamples(gameName, 2);
      for (const ex of examples) {
        if (ex.file_ids && ex.file_ids.length > 0) {
          // Download all images for this reference example
          const buffers = await Promise.all(
            ex.file_ids.map(fid => downloadTelegramFile(fid).catch(e => {
              console.warn(`[FewShot] Failed to download file ${fid}:`, e);
              return null;
            }))
          );
          const validBuffers = buffers.filter(buf => buf !== null);
          if (validBuffers.length > 0) {
            fewShotExamples.push({
              imageBuffers: validBuffers,
              description: ex.corrected_description
            });
          }
        }
      }
      console.log(`[Generate] Loaded ${fewShotExamples.length} visual few-shot examples for ${gameName}`);
    } catch (err) {
      console.warn('[Generate] Failed to fetch few-shot examples:', err);
    }

    // Generate description using Gemini API
    const description = await gemini.generateDescription(
      imageBuffers,
      gameName,
      session.template_pref || 'AUTO',
      session.custom_template,
      fewShotExamples
    );

    // Send description to user
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: description
    });

    // Send a finishing message with clear instruction and inline buttons
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '✅ *Description generated successfully!*\n\n⚠️ **Important:** Please clear this session before starting the next account! If you do not clear it, the next screenshots will be mixed with this one.\n\n💡 *If the description contains mistakes, click "✍️ Correct Description" to train and improve the AI!*',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { "text": "🧹 Clear Session & Start Next ID", "callback_data": "action_clear" }
          ],
          [
            { "text": "✍️ Correct Description", "callback_data": "action_correct" }
          ]
        ]
      }
    });

    // Reset last message ID since we finished this session
    await db.updateSession(chatId, { last_message_id: null });
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
  await sendGameSelectionPrompt(chatId, messageId);
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

  // Deduplicate incoming Telegram webhook retries
  if (update.update_id) {
    try {
      const isProcessed = await db.checkAndMarkUpdateProcessed(update.update_id);
      if (isProcessed) {
        console.log(`[Webhook] Duplicate request ignored: Update ID ${update.update_id}`);
        return res.status(200).send('OK');
      }
    } catch (dedupErr) {
      console.error('Error in deduplication logic:', dedupErr);
    }
  }

  // 1. Handle Callback Queries (Button Clicks)
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from ? callbackQuery.from.id : chatId;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Check authorization status
    const isAuthorized = await db.isUserAuthorized(userId);
    if (!isAuthorized) {
      try {
        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '⚠️ Access key expired, deactivated, or not found.',
          show_alert: true
        });
        await sendTelegram('deleteMessage', { chat_id: chatId, message_id: messageId });
      } catch (e) {
        console.warn('Failed to intercept callback for unauthorized user:', e);
      }
      return res.status(200).send('OK');
    }

    // Acknowledge the callback query so the button stops loading
    try {
      await sendTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id
      });
    } catch (cbErr) {
      console.error('Failed to answer callback query:', cbErr);
    }

    if (data === 'action_generate') {
      await handleGenerate(chatId, messageId);
    } else if (data === 'action_clear') {
      await handleClear(chatId, messageId);
    } else if (data === 'action_correct') {
      await db.updateSession(chatId, { state: 'AWAITING_CORRECTION_DESC' });
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: '✍️ *Submit Description Correction (Step 1/2)*\n\nPlease paste or type the exact corrected sales description now. I will save this description and ask for your training notes in the next step!',
        parse_mode: 'Markdown'
      });
    } else if (data.startsWith('game_')) {
      const gameName = data.substring(5);
      await db.updateSession(chatId, { game_name: gameName, state: 'AWAITING_TEMPLATE_PREFERENCE' });
      await sendTemplatePreferencePrompt(chatId, gameName, messageId);
    } else if (data === 'pref_auto') {
      await db.updateSession(chatId, { template_pref: 'AUTO', custom_template: null, state: 'AWAITING_SCREENSHOTS' });
      const updatedSession = await db.getSession(chatId);
      await updateDashboard(chatId, updatedSession, 0);
    } else if (data === 'pref_custom') {
      const session = await db.getSession(chatId);
      await db.updateSession(chatId, { template_pref: 'CUSTOM', state: 'AWAITING_CUSTOM_TEMPLATE' });
      await sendAwaitingCustomTemplatePrompt(chatId, session.game_name || 'your game', messageId);
    } else if (data === 'back_to_game') {
      await db.updateSession(chatId, { state: 'AWAITING_GAME_NAME', game_name: null, template_pref: null, custom_template: null });
      await sendGameSelectionPrompt(chatId, messageId);
    }

    return res.status(200).send('OK');
  }

  // 2. Handle standard messages
  const message = update.message;
  if (!message) {
    return res.status(200).send('OK');
  }

  const chatId = message.chat.id;
  const userId = message.from ? message.from.id : chatId;
  const username = message.from ? (message.from.username || `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim() || 'User') : 'User';
  const text = message.text ? message.text.trim() : '';

  try {
    // Get current session state
    const session = await db.getSession(chatId);

    // Check authorization status
    const isAuthorized = await db.isUserAuthorized(userId);

    if (!isAuthorized) {
      // If unauthorized, they must submit a key
      if (text && !text.startsWith('/')) {
        const keyCheck = await db.validateKey(text);
        if (keyCheck.valid) {
          await db.bindKeyToUser(text, userId, username);
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '✅ *Access Granted!*\n\nYour license key has been verified and bound to this account. You can now use the bot.',
            parse_mode: 'Markdown'
          });
          // Transition directly to game selection
          await sendGameSelectionPrompt(chatId);
          return res.status(200).send('OK');
        } else {
          let errorMsg = 'This key is invalid. Please verify and try again.';
          if (keyCheck.error === 'DEACTIVATED') {
            errorMsg = 'This key has been deactivated by the admin.';
            await db.logAlert(text, userId, username, 'DEACTIVATED_KEY_USED');
          } else if (keyCheck.error === 'EXPIRED') {
            errorMsg = 'This key has expired.';
            await db.logAlert(text, userId, username, 'EXPIRED_KEY_USED');
          } else if (keyCheck.error === 'LIMIT_EXCEEDED') {
            errorMsg = 'This key has reached its maximum user/device limit and cannot be bound to another account.';
            await db.logAlert(text, userId, username, 'LIMIT_EXCEEDED');
          }

          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `❌ *Activation Failed:* ${errorMsg}\n\n🔑 *Please enter a valid access key to unlock the bot:*`,
            parse_mode: 'Markdown'
          });
          return res.status(200).send('OK');
        }
      }

      // Default blocked screen for commands or media uploads
      let blockedText = `👋 *Welcome to the Game Account Sales Description Bot!*

⚠️ *Access Restricted*: You must have an active license key to access this bot.

To purchase a license key or get support, please contact the administrator: **@admin**

🔑 *Please paste your access key here to activate your account:*`;

      if (session.bound_key) {
        const keyCheck = await db.validateKey(session.bound_key);
        if (keyCheck.error === 'DEACTIVATED') {
          blockedText = `❌ *Access Denied:* Your license key (*${session.bound_key}*) has been deactivated.

Please contact the administrator (**@admin**) to reactivate it.

🔑 *If you have a new access key, please paste it here to activate:*`;
        } else if (keyCheck.error === 'EXPIRED') {
          blockedText = `❌ *Access Denied:* Your license key (*${session.bound_key}*) has expired.

Please contact the administrator (**@admin**) to renew your license or purchase a new key.

🔑 *If you have a new access key, please paste it here to activate:*`;
        }
      }

      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: blockedText,
        parse_mode: 'Markdown'
      });
      return res.status(200).send('OK');
    }

    // A. Handle command overrides first (for authorized users)
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await db.clearImages(chatId); // Clear database images and session state
      await sendGameSelectionPrompt(chatId);
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

    const state = session.state || 'AWAITING_GAME_NAME';

    // B. Handle photo or document uploads
    let fileId = null;
    let isPhoto = false;
    let isDocument = false;

    if (message.photo && message.photo.length > 0) {
      const targetIndex = Math.min(message.photo.length - 1, 2);
      fileId = message.photo[targetIndex].file_id;
      isPhoto = true;
    } else if (message.document) {
      fileId = message.document.file_id;
      isDocument = true;
    }

    // If an image (photo or image document) was uploaded:
    const isImageDoc = isDocument && message.document.mime_type && message.document.mime_type.startsWith('image/');
    
    if (isPhoto || isImageDoc) {
      if (state !== 'AWAITING_SCREENSHOTS') {
        // Guide user to complete the active step first
        if (state === 'AWAITING_GAME_NAME') {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⚠️ *Please select or type the game name first* before uploading screenshots.',
            parse_mode: 'Markdown'
          });
          await sendGameSelectionPrompt(chatId);
        } else if (state === 'AWAITING_TEMPLATE_PREFERENCE') {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⚠️ *Please select your template preference first* before uploading screenshots.',
            parse_mode: 'Markdown'
          });
          await sendTemplatePreferencePrompt(chatId, session.game_name);
        } else if (state === 'AWAITING_CUSTOM_TEMPLATE') {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⚠️ *Please provide your custom template first* before uploading screenshots.',
            parse_mode: 'Markdown'
          });
          await sendAwaitingCustomTemplatePrompt(chatId, session.game_name);
        }
        return res.status(200).send('OK');
      }

      // We are in AWAITING_SCREENSHOTS, so save the image
      await db.addImage(chatId, fileId);
      const allFiles = await db.getImages(chatId);
      const updatedSession = await db.getSession(chatId);
      await updateDashboard(chatId, updatedSession, allFiles.length);
      return res.status(200).send('OK');
    }

    // If a non-image document was uploaded during custom template phase:
    if (isDocument && state === 'AWAITING_CUSTOM_TEMPLATE') {
      const doc = message.document;
      const fileName = doc.file_name || '';
      const isTxt = fileName.toLowerCase().endsWith('.txt') || doc.mime_type === 'text/plain';
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || doc.mime_type === 'application/pdf';

      if (isTxt) {
        try {
          const docBuffer = await downloadTelegramFile(doc.file_id);
          const templateText = docBuffer.toString('utf-8').trim();
          if (!templateText) {
            await sendTelegram('sendMessage', {
              chat_id: chatId,
              text: '⚠️ *The uploaded text file is empty.* Please upload a file with some content.',
              parse_mode: 'Markdown'
            });
            return res.status(200).send('OK');
          }
          await db.updateSession(chatId, { custom_template: templateText, state: 'AWAITING_SCREENSHOTS' });
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '✅ *Template successfully extracted from text file!*',
            parse_mode: 'Markdown'
          });
          const updatedSession = await db.getSession(chatId);
          await updateDashboard(chatId, updatedSession, 0);
          return res.status(200).send('OK');
        } catch (err) {
          console.error('Failed to read text template:', err);
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `❌ *Error reading text file:* ${err.message || err}`,
            parse_mode: 'Markdown'
          });
          return res.status(200).send('OK');
        }
      } else if (isPdf) {
        let loadingMsgId = null;
        try {
          const loadingRes = await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⏳ *Analyzing and extracting template from PDF...* Please wait a moment.',
            parse_mode: 'Markdown'
          });
          if (loadingRes.ok && loadingRes.result) {
            loadingMsgId = loadingRes.result.message_id;
          }

          const docBuffer = await downloadTelegramFile(doc.file_id);
          const templateText = await gemini.extractTemplateFromPdf(docBuffer);

          if (!templateText) {
            throw new Error('No template content could be extracted.');
          }

          await db.updateSession(chatId, { custom_template: templateText, state: 'AWAITING_SCREENSHOTS' });
          
          if (loadingMsgId) {
            try {
              await sendTelegram('deleteMessage', { chat_id: chatId, message_id: loadingMsgId });
            } catch (e) {}
          }

          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `✅ *Template successfully extracted from PDF!*\n\n*Extracted Template:*\n\`\`\`\n${templateText}\n\`\`\``,
            parse_mode: 'Markdown'
          });
          
          const updatedSession = await db.getSession(chatId);
          await updateDashboard(chatId, updatedSession, 0);
          return res.status(200).send('OK');
        } catch (err) {
          console.error('Failed to extract PDF template:', err);
          if (loadingMsgId) {
            try {
              await sendTelegram('deleteMessage', { chat_id: chatId, message_id: loadingMsgId });
            } catch (e) {}
          }
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `❌ *Error extracting PDF template:* ${err.message || err}\n\nPlease try pasting it in chat or uploading a .txt file.`,
            parse_mode: 'Markdown'
          });
          return res.status(200).send('OK');
        }
      } else {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '⚠️ *Unsupported file type.* Please upload a plain text (.txt) file or a PDF (.pdf) file.',
          parse_mode: 'Markdown'
        });
        return res.status(200).send('OK');
      }
    }

    // C. Handle typed text based on current state
    if (text) {
      if (state === 'AWAITING_GAME_NAME') {
        await db.updateSession(chatId, { game_name: text, state: 'AWAITING_TEMPLATE_PREFERENCE' });
        await sendTemplatePreferencePrompt(chatId, text);
        return res.status(200).send('OK');
      } else if (state === 'AWAITING_TEMPLATE_PREFERENCE') {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '⚠️ *Please choose how to structure the description.* Select an option from the buttons below:',
          parse_mode: 'Markdown'
        });
        await sendTemplatePreferencePrompt(chatId, session.game_name);
        return res.status(200).send('OK');
      } else if (state === 'AWAITING_CUSTOM_TEMPLATE') {
        await db.updateSession(chatId, { custom_template: text, state: 'AWAITING_SCREENSHOTS' });
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '✅ *Template successfully saved from chat!*',
          parse_mode: 'Markdown'
        });
        const updatedSession = await db.getSession(chatId);
        await updateDashboard(chatId, updatedSession, 0);
        return res.status(200).send('OK');
      } else if (state === 'AWAITING_SCREENSHOTS') {
        // Just remind them to upload screenshots or click generate
        const allFiles = await db.getImages(chatId);
        const updatedSession = await db.getSession(chatId);
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: `🤖 *You are currently uploading screenshots.*
          
• Game: *${session.game_name}*
• Screenshots: *${allFiles.length}*

Please upload screenshots, or click the buttons below the status message to proceed.`,
          parse_mode: 'Markdown'
        });
        await updateDashboard(chatId, updatedSession, allFiles.length);
        return res.status(200).send('OK');
      } else if (state === 'AWAITING_CORRECTION_DESC') {
        await db.updateSession(chatId, { 
          temp_corrected_desc: text, 
          state: 'AWAITING_CORRECTION_NOTES' 
        });
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '📝 *Submit Description Correction (Step 2/2: Training Notes)*\n\nGot it! Now, please type a short note explaining what mistake the AI made (e.g. *"The trainer level is 40, not 50"* or *"You counted locked skins"*). I will feed these instructions to the AI to prevent similar mistakes in the future.\n\nType `/skip` if you do not want to add any notes.',
          parse_mode: 'Markdown'
        });
        return res.status(200).send('OK');
      } else if (state === 'AWAITING_CORRECTION_NOTES') {
        const fileIds = await db.getImages(chatId);
        const notes = (text === '/skip') ? null : text;
        if (fileIds && fileIds.length > 0) {
          await db.addFewShotExample(session.game_name || 'General Game', fileIds, session.temp_corrected_desc, notes);
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '✅ *Correction & Training Notes Saved!*\n\nI have registered this training example in my database. I will use it as a reference to keep improving and avoid making similar mistakes! 🚀',
            parse_mode: 'Markdown'
          });
        } else {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⚠️ *Could not save correction:* No active screenshots were found in this session.',
            parse_mode: 'Markdown'
          });
        }
        await handleClear(chatId);
        return res.status(200).send('OK');
      }
    }

    // D. If unhandled input:
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '🤖 *I didn\'t understand that request.*\n\nType `/start` or `/clear` to restart the process and choose a game.',
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Webhook error:', error);
  }

  // Always return 200 OK to prevent Telegram webhook retries
  return res.status(200).send('OK');
};
