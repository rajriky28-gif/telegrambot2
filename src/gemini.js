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

You must follow the template provided below EXACTLY. Fill in the values by extracting them from the screenshots. 

GUIDELINES FOR DATA EXTRACTION:
1. **Level & Year**: Look at the profile screenshot. The level is prominent (e.g. Level 40, 50, etc.). The creation year is derived from the "Start Date" (e.g. Start Date: 07/15/2022 means Year 2022).
2. **Special Stuffs**: Look for high-tier Pokemon. Examples: Level 50 Shiny, Adventure Effect mons (Zacian, Origin Dialga/Palkia, etc. - has adventure effect or special icons), Primal/Mega (Groudon, Kyogre, Rayquaza), Shiny Event/Costume, Shiny Mythical, Shiny Legendary, Special backgrounds, Legacy moves, high CP mons.
3. **Demanded Stuffs**:
   - Shiny Mythicals: List how many and their names (e.g., 1 Shiny Mythical - Darkrai).
   - Max CP: Find the highest CP number visible in the Pokemon list.
   - Shiny Legendaries: Count or list them (e.g., Crowned Zacian, Dawn Wings, Mewtwo).
   - Counts: Try to estimate or extract the total number of Legendaries, Shinies, Mythicals, Event mons, Special background mons, Adventure Effect mons, Dynamax, and Perfect (100% IV/Hando) mons. If not fully visible, estimate based on search filters or write a reasonable number prefixed with a '+' or approximate sign (e.g. 200+).
4. **Storage**: Look at the bottom of the Pokemon screen (e.g., "1250 / 2500" means Pokemon Storage is 2500) and Item bag screen (e.g., "850 / 3875" means Item Storage is 3875).
5. **Items**: Look at the top right of the shop/profile/bag for Coins, and the Pokemon screen for Stardust. Look for Raid Passes (Premium/Remote), Rare Candies, and Master Balls in the items screenshots.

If any value is not visible or cannot be determined at all from the screenshots, use a reasonable estimate or placeholder (e.g. 50+ or [Check screenshots]) instead of leaving it empty, but try to be as accurate as possible. DO NOT make up fake extremely high values if the screenshots show low values.

Here is the exact template you must use. Output ONLY this template filled with the extracted details. Do not add any markdown block wrappers around the template itself, just output the plain text description. Do not add any conversational text before or after the template.

--- TEMPLATE START ---
For sale
🚨INSTANT DELIVERY 

⭐️ Level [LEVEL](Year[YEAR]) Account ⭐️
⭐️ Op Account 


🌛 SPECIAL STUFFS:- 


[List top tier special mons with matching descriptive emojis, e.g.:]
😶🌫️[Level 50 Shiny Adventure Effect Crowned Zacian]
🔥[Shiny Dawn Wings]
😍[Primal Groudon]
...

🥵DEMANDED STUFF:-


🌛 [X] Shiny Mythical - [Names]
💀Upto cp-[MAX_CP]
🥶[X] x Shiny legendary - [Names]
😜[X] x Legendary 
🌚[X] x shiny 
🙄 [X] x mythical & [Y] x Event mons 
👹[X] x Special bg mons 
😼[X] x Adventure Effect mons 
🌛 [X] x Dynamax & [Y] x Legendary 
😈 [X] Perfect mons
💖[X] x Perfect Legendary

🥵 SPECIAL STUFFS :-


🥶[X] X Event shiny
🌚[X] x Mega shiny
😍[X] x Special bg shiny
🥹[X] x Shiny Adventure Effect mons 

🥰STORAGE. :-


🥶Pokemon Storage-[STORAGE_SIZE]
🥴Item Storage-[STORAGE_SIZE]


🤔ITEMS :- 


🔥Coins-[COIN_COUNT]
 🤣 Stardust-[STARDUST_AMOUNT]
😅Raid pass-[RAID_PASS_COUNT]
❤️🔥 Rare candy-[RARE_CANDY_COUNT]
  👽Master ball -[MASTER_BALL_COUNT]


🎄 Our Guarantee:-
 ✨ E-mail changeable 
 ✨ Nickname changeable 
 ✨ No red slash Pokemon 
 ✨ Account 100%safe
 ✨ No soft ban / no red warning ⚠️ 

💎 𝗢𝘃𝗲𝗿𝗮𝗹𝗹 𝗮 𝗦𝘁𝗮𝗰𝗸𝗲𝗱 𝗣𝘃🇵 & 𝗖𝗼𝗹𝗹𝗲𝗰𝘁𝗶𝗯𝗹𝗲 𝗔𝗰𝗰𝗼𝘂𝗻𝘁

💎 𝗘𝘃𝗲𝗻𝘁 𝗘𝘅𝗰𝗹𝘂𝘀𝗶𝘃𝗲𝘀

💎 𝗛𝗶𝗴𝗵-𝗘𝗻𝗱 𝗦𝗵𝗶𝗻𝘆 𝗖𝗼𝗹𝗹𝗲𝗰𝘁𝗶𝗼𝗻

💎 𝗠𝗮𝘀𝘀𝗶𝘃𝗲 𝗦𝘁𝗮𝗿𝗱𝘂𝘀𝘁 & 𝗲𝘀𝗼𝘂𝗿𝗰𝗲𝘀

💎 𝗥𝗲𝗮𝗱𝘆 𝗳𝗼𝗿 𝗣𝘃🇵, 𝗥𝗮𝗶𝗱𝘀 & 𝗖𝗼𝗹𝗹𝗲𝗰𝘁𝗶𝗻𝗴



━━━━━━━━━━━━━━━━━━



🔥 𝗗𝗼𝗻'𝘁 𝗝𝘂𝘀𝘁 𝗦𝗲𝗲 — 𝗕𝘂𝘆 𝗡𝗼𝘄! 🔥



📩 𝗙𝗼𝗿 𝗦𝗮𝗹𝗲

🎄 Thank you 🎄
--- TEMPLATE END ---
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
