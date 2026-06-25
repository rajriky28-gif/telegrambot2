const { GoogleGenAI } = require('@google/genai');

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please set it in Vercel settings or your local .env file.');
  }
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithFallback(ai, contents) {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[Gemini API] Trying model: ${model}`);
      return await ai.models.generateContent({
        model,
        contents
      });
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || '';
      console.warn(`[Gemini API] Model ${model} failed: ${errorMsg}`);
      
      const isTransient = error.status === 'UNAVAILABLE' || 
                          error.status === 503 ||
                          errorMsg.includes('503') || 
                          errorMsg.includes('UNAVAILABLE') ||
                          errorMsg.includes('Resource has been exhausted') ||
                          errorMsg.includes('429') ||
                          error.status === 429;
                          
      if (isTransient) {
        // Try the next model in the list
        continue;
      }
      throw error;
    }
  }
  
  // If all failed, wait 2 seconds and try one last time with gemini-3.5-flash
  console.warn(`[Gemini API] All models failed initially. Waiting 2s for final attempt with gemini-3.5-flash...`);
  await sleep(2000);
  return await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents
  });
}

async function generateDescription(imageBuffers) {
  const ai = getGeminiClient();

  // Convert image buffers to the inlineData format expected by Gemini API
  const imageParts = imageBuffers.map((buffer) => ({
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: 'image/jpeg' // Telegram photos are downloaded as jpegs
    }
  }));

  const systemInstruction = `
You are an expert Pokemon Go broker. Your task is to analyze one or more screenshots/collages of a Pokemon Go account and generate a highly attractive, accurate, and professional sales description.

CRITICAL RULES FOR ACCURACY & ZERO HALLUCINATION:
1. **100% FACTUAL ACCURACY ONLY:** You must ONLY write down values, numbers, and Pokemon names that you can clearly see in the screenshots. Do not make up, guess, or estimate any detail. If a detail is not visible in the screenshots, do not mention it at all.
2. **NO ASSUMPTIONS ON LARGE ACCOUNTS:** Large accounts often have screenshots of complex collages. Look at them very carefully. Do not assume or guess the total counts of Shinies, Legendaries, or Mythicals unless they are clearly written in search result text (e.g. "Showing 250 of 250" or filter counts). If filter counts are not visible, do not guess a number; instead, list the high-value highlights that you can clearly see (e.g., "Includes Shiny Legendaries: Mewtwo, Rayquaza, Zacian").
3. **DO NOT GUESS ITEMS:** Only list item counts (Stardust, Coins, Raid Passes, Master Balls, Rare Candies) if they are explicitly visible in the shop, profile, or items bag screenshots. If not visible, omit them completely.

DYNAMIC SALES TEMPLATE DESIGN:
You have complete freedom to design the structure of the sales description. Do NOT use a rigid template. Instead, design the best possible listing template dynamically based on the specific account's strengths:
- If the account has massive resources (Stardust/Coins), make a highlighted "RESOURCES" section.
- If it has rare Shiny Legendaries or Event Pokemon, create a featured "COLLECTOR HIGHLIGHTS" section.
- If it has high-level PvP Pokemon, add a "PVP & RAID READY" section.
- Always include a professional "Guarantees" section at the bottom (e.g. Email/Nickname changeable, Safe account, etc.).
- Format the output beautifully using bold headings, spacers (e.g. ━━━━━━━━━━━━━━━━━━), emojis, and bullet points.
- Organize the layout to make the account look as stacked, premium, and attractive as possible to buyers, but keep it 100% truthful to the screenshots.

Your output must consist ONLY of the generated sales description. Do not add any markdown block wrappers (like \`\`\`) around the description itself, just output the plain formatted text. Do not add any conversational text before or after the description.
`;

  try {
    const response = await callGeminiWithFallback(ai, [
      {
        role: 'user',
        parts: [
          ...imageParts,
          { text: systemInstruction }
        ]
      }
    ]);

    // Remove template boundaries if the model accidentally included them
    let text = response.text || '';
    text = text.replace('--- TEMPLATE START ---', '');
    text = text.replace('--- TEMPLATE END ---', '');
    return text.trim();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

module.exports = {
  generateDescription
};
