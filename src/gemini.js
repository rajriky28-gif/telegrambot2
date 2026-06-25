const { GoogleGenAI } = require('@google/genai');

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please set it in Vercel settings or your local .env file.');
  }
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithFallback(ai, contents, config = {}) {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[Gemini API] Trying model: ${model}`);
      return await ai.models.generateContent({
        model,
        contents,
        config
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
    contents,
    config
  });
}

async function generateDescription(imageBuffers, gameName, templatePref, customTemplate) {
  const ai = getGeminiClient();

  // Convert image buffers to the inlineData format expected by Gemini API
  const imageParts = imageBuffers.map((buffer) => ({
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: 'image/jpeg' // Telegram photos are downloaded as jpegs
    }
  }));

  const systemInstruction = `
You are an expert game account broker. Your task is to analyze one or more screenshots/collages of an account for the game: **${gameName}** and generate a highly attractive, accurate, and professional sales description.

CRITICAL RULES FOR ACCURACY & ZERO HALLUCINATION:
1. **NO HALLUCINATIONS / STRICT EVIDENCE-BASED LISTING:** Under no circumstances may you guess, estimate, assume, or invent any statistic, level, asset, item, skin, character, or value. Everything you write in the description MUST be directly visible in the screenshots.
2. **STRICT STATS RULE:** If a statistic (such as Matches Played, Win Rate, Likes, Level, KD Ratio, Rank, MMR, etc.) is NOT visible in the screenshots, you must **COMPLETELY DELETE/OMIT** that line or section from the output. Never invent placeholder numbers (do not invent "2,394 Matches" or "3,756 Likes" if no stats screen is provided).
3. **VISUAL OWNED VS LOCKED ITEMS DETECTION (CRITICAL FOR SKINS/HEROES/WEAPONS):**
   - You must carefully analyze the visual state of item cards, hero cards, or skins in gallery/catalog grids.
   - **Owned/Unlocked Assets:** These are fully colored, bright, vivid, and have no lock symbols or purchase prices.
   - **Locked/Not Owned Assets:** These are faded, greyed out, darkened, desaturated, or semi-transparent. They often display lock icons, purchase prices (e.g., in diamonds/gold), or "Get/Buy" buttons.
   - **Faction/Category Counters (e.g., "Grand (2/105)"):** If a grid header displays a fraction like \`Category (Numerator/Denominator)\`, the numerator is the actual count of owned assets, and the denominator is the total catalog size. You must ONLY list the fully colored (owned) assets. For example, if a grid is titled "Grand (2/105)" and shows only 2 colored skins (Leona Karina, Fluffy Dream Floryn) and the rest are greyed out (Arrow of Spring Miya, Mistbender Nana, Obi-Wan Kenobi Alucard, etc.), you must **ONLY list the 2 colored skins**. Do NOT include the faded/greyed-out skins in your output. This applies to skins, heroes, characters, emotes, weapons, cards, and collectibles across all games (MLBB, Brawl Stars, Clash of Clans, Free Fire, PUBG, etc.).

SALES LAYOUT & FORMATTING:
${templatePref === 'CUSTOM' ? `
You MUST follow this template structure EXACTLY. Extract the values from the screenshots and fill this template:
--- TEMPLATE START ---
${customTemplate}
--- TEMPLATE END ---
Do not add any "N/A", "0", or "Not shown" placeholders for missing items. If a placeholder line from the custom template cannot be filled because the item/value is not visible in the screenshots, **completely delete/omit that line** from your output.
` : `
You have complete freedom to design the structure of the sales description dynamically to highlight the account's top features.
- Identify the game's core high-value assets shown in the screenshots (e.g. rare characters, levels, skins, rank, premium items, resources).
- Organize the layout to make the account look as stacked, premium, and attractive as possible to buyers.
- Format the output beautifully using bold headings, spacers (e.g. ━━━━━━━━━━━━━━━━━━), emojis, and bullet points.
- Include a professional "Guarantees" section at the bottom (e.g. Email/Nickname changeable, Safe account, etc.).
`}

Your output must consist ONLY of the generated sales description. Do not add any markdown block wrappers (like \`\`\`) around the description itself, just output the plain formatted text. Do not add any conversational text before or after the description.
`;

  try {
    const response = await callGeminiWithFallback(ai, [
      {
        role: 'user',
        parts: imageParts
      }
    ], {
      temperature: 0.0,
      systemInstruction: systemInstruction
    });

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

async function extractTemplateFromPdf(pdfBuffer) {
  const ai = getGeminiClient();
  
  const pdfPart = {
    inlineData: {
      data: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf'
    }
  };
  
  const promptPart = {
    text: 'Analyze this PDF document and extract the game account description template, layout, or style. Extract only the structure (e.g. headings, labels, fields) and ignore any sample values or instructions. Return ONLY the clean plain text template structure, with no markdown code blocks, no explanation, and no introductory or concluding text.'
  };

  try {
    const response = await callGeminiWithFallback(ai, [
      {
        role: 'user',
        parts: [pdfPart, promptPart]
      }
    ]);
    return (response.text || '').trim();
  } catch (error) {
    console.error('Error extracting template from PDF:', error);
    throw error;
  }
}

module.exports = {
  generateDescription,
  extractTemplateFromPdf
};
