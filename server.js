const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Loads environment variables from .env file
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3001; // We'll run the backend on a different port

// --- Middleware ---
app.use(cors()); // Allow requests from our React front-end
app.use(express.json()); // Allow the server to understand JSON in request bodies

// --- Google AI Setup ---
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- API Endpoint ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message, subject } = req.body;

    // This is the core of FocusBot: creating a specialized prompt
    const prompt = `You are FocusBot, a helpful tutor who is an expert in ${subject}. Please provide a clear and concise answer to the following question, staying strictly within the context of ${subject}.\n\nQuestion: "${message}"\n\nAnswer:`;

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });

  } catch (error) {
    console.error("Error calling Google AI:", error);
    res.status(500).json({ error: 'Failed to get a response from the AI model.' });
  }
});

app.listen(PORT, () => {
  console.log(`FocusBot server listening on http://localhost:${PORT}`);
});