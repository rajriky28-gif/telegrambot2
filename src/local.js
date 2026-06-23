require('dotenv').config();
const express = require('express');
const webhookHandler = require('../api/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Route for Telegram webhook
app.post('/api/webhook', async (req, res) => {
  try {
    await webhookHandler(req, res);
  } catch (error) {
    console.error('Error in local webhook handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
});

// Root path description
app.get('/', (req, res) => {
  res.send('Pokemon Go Telegram Bot Local Server is running! Point your webhook to /api/webhook.');
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Local Telegram webhook server listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`==================================================`);
  console.log(`Make sure your .env file is configured with:`);
  console.log(`- TELEGRAM_BOT_TOKEN`);
  console.log(`- GEMINI_API_KEY`);
  console.log(`==================================================`);
});
