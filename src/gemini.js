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

async function generateDescription(imageBuffers, gameName, templatePref, customTemplate, fewShotExamples = []) {
  const ai = getGeminiClient();

  // Step 1: Parallel Factual Extraction from each screenshot individually
  console.log(`[Gemini Pipeline] Starting Step 1: Factual Extraction for ${imageBuffers.length} images in parallel...`);
  
  const extractPromises = imageBuffers.map(async (buffer, index) => {
    const singleImagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: 'image/jpeg'
      }
    };

    const extractionInstruction = `
You are an expert game data extractor. Your task is to analyze this single screenshot from the game **${gameName}** and extract all visible stats, levels, resources, items, player IDs, and account details.

CRITICAL RULES:
1. **NO HALLUCINATIONS:** List ONLY what is directly visible. If a resource count, player ID, character, or level is not visible in this screenshot, do not list it.
2. **NUMBERS & CODES:** Transcribe every digit of any Player ID, User ID, UID, Account ID, level, or resource balance (gold, gems, stardust, coins, win rate, matches) with 100% precision. Pay close attention to visually similar characters (like '8' vs '0', '5' vs 'S').
3. **VISUAL DETECTIONS:** Identify character names, weapon names, skin names, or items clearly. Note whether they are "OWNED/UNLOCKED" (fully colored) or "LOCKED/NOT OWNED" (greyed out/faded).
4. **NO PROSE:** Output a clean, bulleted list of raw facts. Do not write a sales description or conversational text.
`;

    try {
      const response = await callGeminiWithFallback(ai, [
        {
          role: 'user',
          parts: [singleImagePart, { text: extractionInstruction }]
        }
      ], {
        temperature: 0.0
      });
      return response.text || '';
    } catch (err) {
      console.error(`[Extraction Step] Failed to analyze screenshot ${index + 1}:`, err);
      return `[Screenshot ${index + 1} Error: Failed to analyze]`;
    }
  });

  const rawExtractions = await Promise.all(extractPromises);
  console.log(`[Gemini Pipeline] Successfully completed Step 1 (Factual Extraction) for ${imageBuffers.length} images.`);

  // Step 2: Synthesis and Template/Formatting compilation
  const synthesisInstruction = `
You are an expert game account broker. Your task is to review the raw data extracted from several screenshots and compile it into a highly attractive, accurate, and professional sales description for the game: **${gameName}**.

CRITICAL RULES FOR ACCURACY & ZERO HALLUCINATION:
1. **STRICT EVIDENCE-BASED COMPILATION:** Under no circumstances may you guess, estimate, assume, or invent any statistic, level, asset, item, skin, character, or value. Everything you write in the description MUST be directly present in the "EXTRACTED RAW DATA" section below.
2. **STRICT STATS & RESOURCES RULE:** If a statistic or resource balance (such as Matches Played, Win Rate, Likes, Level, KD Ratio, Rank, MMR, Battle Points, Diamonds, Gems, Tickets, Gold, Stardust, Magic Dust, Fragments, etc.) is NOT present in the raw data, you must **COMPLETELY DELETE/OMIT** that line or section from the output. Never invent placeholder numbers.
3. **DO NOT CONFUSE MILESTONES/TIERS WITH ACTUAL BALANCES (CRITICAL):**
   - If the raw data indicates milestone thresholds or levels to unlock rewards (e.g. 4000, 3000, 2000 points to unlock rewards), do NOT assume these are the user's actual resource balances. Only list actual balances if they are explicitly stated as the player's active current balance.
4. **OWNED VS LOCKED ITEMS:**
   - Only list assets, characters, skins, or weapons that are explicitly marked as "OWNED" or "UNLOCKED" in the raw data. Do NOT include assets that are marked as "LOCKED/NOT OWNED" or greyed out.
5. **STRICT GAME ID / USER ID / UID RULE (CRITICAL):**
   - If a Game ID, User ID, UID, Account ID, or Character ID is present in the raw data, transcribe it exactly. Do NOT alter a single digit.
   - If no player ID/UID is present in the raw data, you must **COMPLETELY DELETE/OMIT** the ID/UID field or line from the final description.
6. **SPECIALIZED RULES FOR POKÉMON GO (PG / POKÉMON GO) ACCOUNTS:**
   - **Trainer Profile & Stats:** Extract the Trainer Nickname, Level, XP, Team Name, and Start Date exactly as present in the raw data.
   - **CRITICAL:** Do NOT confuse the "Total Pokémon Caught" count (e.g., "104,821") with the current Pokémon inventory storage count (e.g. "850/900").
   - **Shiny, Legendary, and Shiny Legendary Counts:** Use only the counts explicitly present in the raw data (extracted from the search filter headers). Do not guess or extrapolate.

SALES LAYOUT & FORMATTING:
${templatePref === 'CUSTOM' ? `
You MUST follow this template structure EXACTLY. Extract the values from the raw data and fill this template:
--- TEMPLATE START ---
${customTemplate}
--- TEMPLATE END ---
Do not add any "N/A", "0", or "Not shown" placeholders. If a placeholder line from the custom template cannot be filled because the value is missing from the raw data, **completely delete/omit that line** from your output.
For fields requesting an ID, User ID, Game ID, UID, or Account ID: if the exact ID/UID is not present in the raw data, you MUST completely delete/omit the entire line from the description. Never guess or hallucinate any numbers or digits for the ID/UID.
` : `
You have complete freedom to design the structure of the sales description dynamically to highlight the account's top features.
- Identify the game's core high-value assets listed in the raw data (e.g. rare characters, levels, skins, rank, premium items, resources).
- Organize the layout to make the account look as stacked, premium, and attractive as possible to buyers.
- Format the output beautifully using bold headings, spacers (e.g. ━━━━━━━━━━━━━━━━━━), emojis, and bullet points.
- Include a professional "Guarantees" section at the bottom (e.g. Email/Nickname changeable, Safe account, etc.).
`}

Your output must consist ONLY of the generated sales description. Do not add any markdown block wrappers (like \`\`\`) around the description itself, just output the plain formatted text. Do not add any conversational text before or after the description.
`;

  // Build the synthesis user prompt containing the combined raw data
  let synthesisPrompt = `
Here is the raw factual data extracted from the account screenshots:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rawExtractions.map((ext, idx) => `[SCREENSHOT ${idx + 1} EXTRACTIONS]:\n${ext}`).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  const contents = [];

  // Add visual few-shot reference examples as conversational turns to show style
  for (const example of fewShotExamples) {
    if (example.imageBuffers && example.imageBuffers.length > 0) {
      const parts = example.imageBuffers.map((buf) => ({
        inlineData: {
          data: buf.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }));

      // If there are correction notes, add them as a text part to guide the AI
      if (example.correction_notes) {
        parts.push({
          text: `CRITICAL CORRECTION NOTE FROM PREVIOUS RUN (LEARN FROM THIS MISTAKE AND DO NOT REPEAT IT):\n${example.correction_notes}`
        });
      } else {
        parts.push({
          text: "Analyze these screenshots and generate a sales description."
        });
      }

      contents.push({
        role: 'user',
        parts: parts
      });
      contents.push({
        role: 'model',
        parts: [{ text: example.description }]
      });
    }
  }

  // Add the current user turn containing the compiled raw data text
  contents.push({
    role: 'user',
    parts: [{ text: synthesisPrompt }]
  });

  try {
    const response = await callGeminiWithFallback(ai, contents, {
      temperature: 0.0,
      systemInstruction: synthesisInstruction
    });

    // Remove template boundaries if the model accidentally included them
    let text = response.text || '';
    text = text.replace('--- TEMPLATE START ---', '');
    text = text.replace('--- TEMPLATE END ---', '');
    return text.trim();
  } catch (error) {
    console.error('Error during Synthesis Step in Gemini API:', error);
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
