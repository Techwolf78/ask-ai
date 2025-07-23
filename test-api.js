require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testAPI() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say hello in Spanish" }],
    });
    console.log("Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testAPI();