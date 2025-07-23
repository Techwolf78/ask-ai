require('dotenv').config();
const Together = require('together-ai');

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});

async function testAPI() {
  try {
    const response = await together.chat.completions.create({
      model: "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
      messages: [{ role: "user", content: "Say hello in Spanish" }],
    });
    console.log("Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testAPI();
