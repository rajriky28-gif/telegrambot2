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
1. **100% FACTUAL ACCURACY ONLY:** You must ONLY write down values, numbers, cosmetics, ranks, achievements, and assets that you can clearly see in the screenshots. Do not make up, guess, or estimate any detail. If a detail is not visible in the screenshots, do not mention it at all.
2. **NO ASSUMPTIONS ON LARGE ACCOUNTS:** Look at the screenshots/collages very carefully. Do not assume or guess the total counts of items/assets unless they are clearly written in text on the screen. If counts are not visible, do not guess a number; instead, list the high-value highlights that you can clearly see (e.g., "Includes legendary skins: skin1, skin2").
3. **DO NOT GUESS RESOURCES/ITEMS:** Only list resource counts (gems, coins, stardust, levels, items) if they are explicitly visible in the screenshots. If not visible, omit them completely.

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
