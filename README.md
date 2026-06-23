# Pokemon Go Telegram Account Description Generator Bot

A Node.js Telegram Bot designed to run on Vercel Serverless Functions. Users can upload screenshots or collages of their Pokemon Go accounts, and the bot will use Google's Gemini 2.5 Flash API to analyze all the screenshots and automatically generate a polished, structured sales description using a custom template.

---

## Features

- **Multi-Image Analysis**: Send 1 to 50 screenshots or collages of your Pokemon Go account profile, Pokemon list, item storage, and rare items. The bot remembers them in a session.
- **AI-Powered Parsing**: Uses Gemini 2.5 Flash to automatically detect level, start date, counts of Shiny/Legendary/Mythical/Dynamax/Perfect Pokemon, item storage capacity, coins, stardust, raid passes, and rare items.
- **Template Formatting**: Output matches your exact listing sales template with emojis, ready to copy and paste.
- **Serverless & Database Persistence**: Built for Vercel Serverless Functions with Vercel Postgres for stateless session management.
- **Local Fallback**: Automatically falls back to an in-memory database, allowing you to test offline without setting up PostgreSQL.

---

## Prerequisites

Before deploying, make sure you have:
1. **Telegram Bot Token**:
   - Open Telegram and search for [@BotFather](https://t.me/BotFather).
   - Send `/newbot` and follow the instructions to name your bot and get the **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
2. **Google Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/).
   - Click **Get API Key** and create a new key.
3. **Vercel & GitHub Accounts**:
   - A free GitHub account.
   - A free Vercel account.

---

## Step 1: Local Setup & Testing

### 1. Install Dependencies
Run:
```bash
npm install
```

### 2. Configure Local Environment Variables
Create a file named `.env` in the root folder of your project and paste your keys:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Test Gemini API Offline
You can test the description generator locally with sample screenshots before running the bot. Put a couple of screenshots in your folder and run:
```bash
node src/test_gemini.js path/to/screenshot1.png path/to/screenshot2.png
```
This will log the generated sales description directly in your terminal.

### 4. Run the Bot Locally
You can run the webhook server locally:
```bash
npm start
```
To route Telegram updates to your local server, you can use [Ngrok](https://ngrok.com/):
```bash
ngrok http 3000
```
Then copy the `https://...ngrok-free.app` URL and set the Telegram webhook:
```bash
curl -F "url=https://YOUR_NGROK_DOMAIN/api/webhook" https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook
```

---

## Step 2: Deployment to Vercel (Production)

### 1. Push to GitHub
Create a new repository on GitHub (it can be Private) and push this folder's code to it.

### 2. Import Repository to Vercel
1. Go to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Select your GitHub repository and click **Import**.
4. In the **Environment Variables** section, add your credentials:
   - `TELEGRAM_BOT_TOKEN` = `[Your Telegram Bot Token]`
   - `GEMINI_API_KEY` = `[Your Google Gemini API Key]`
5. Click **Deploy**.

### 3. Connect Vercel Postgres Database
The bot needs to save image file IDs while you upload them.
1. Once deployed, click on your project in Vercel.
2. Go to the **Storage** tab.
3. Select **Postgres** and click **Connect**.
4. Create a database in your preferred region. This will automatically inject database connection variables (like `POSTGRES_URL`) into your project's Environment Variables.
5. Go to the **Deployments** tab, click the three dots next to your latest deployment, and select **Redeploy** to ensure the new database environment variables are loaded.

---

## Step 3: Register the Telegram Webhook

To tell Telegram to send messages to your newly deployed Vercel function:
1. Copy the Vercel deployment URL (e.g., `https://my-pokemon-bot.vercel.app`).
2. Run this URL in your web browser, replacing the placeholders with your actual token and Vercel domain:
   ```
   https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/webhook
   ```
3. You should see a JSON success message:
   ```json
   {
     "ok": true,
     "result": true,
     "description": "Webhook was set"
   }
   }
   ```

---

## How to Use the Bot

1. Open a chat with your Telegram Bot.
2. Send `/start` to see instructions.
3. Upload screenshots of your Pokemon Go account one by one. The bot will respond with the number of images currently saved in your active session.
4. When you have sent all screenshots (e.g., profile page, list of shinies, item bag), type `/generate`.
5. The bot will download the images, analyze them, and output a beautifully structured description ready to copy and paste.
6. Type `/clear` to wipe all images from the current session and start a new account.
