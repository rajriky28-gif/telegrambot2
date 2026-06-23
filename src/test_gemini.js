require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateDescription } = require('./gemini');

async function main() {
  // Check for API Key
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY environment variable is not set in your .env file.');
    process.exit(1);
  }

  // Get image paths from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('\n================================================================');
    console.log('Usage: node src/test_gemini.js <path-to-image-1> [path-to-image-2] ...');
    console.log('Example: node src/test_gemini.js ./profile.jpg ./items.jpg');
    console.log('================================================================\n');
    console.log('Please run the command with actual image files to test.');
    return;
  }

  console.log(`Loading ${args.length} test image(s)...`);
  const imageBuffers = [];

  try {
    for (const imagePath of args) {
      const absolutePath = path.resolve(imagePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }
      console.log(`- Reading: ${absolutePath}`);
      const buffer = fs.readFileSync(absolutePath);
      imageBuffers.push(buffer);
    }

    console.log('\nSending images to Gemini API for analysis... (this may take a few seconds)');
    const description = await generateDescription(imageBuffers);

    console.log('\n================ GENERATED SALES DESCRIPTION ================');
    console.log(description);
    console.log('=============================================================\n');
    console.log('Success! Gemini successfully analyzed the images and filled the template.');
  } catch (error) {
    console.error('\nERROR running test:', error.message || error);
  }
}

main();
