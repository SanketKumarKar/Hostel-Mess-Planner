const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = (supabase) => {

    /**
     * POST /api/ai/suggest-dishes
     * Body: { ingredients: string[], mealType: string, messType: string }
     * Returns: [{ name, description }]
     */
    router.post('/suggest-dishes', async (req, res) => {
        try {
            const { ingredients, mealType, messType } = req.body;
            if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({ error: 'ingredients array is required' });
            }

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const ingredientsList = ingredients.join(', ');
            const messLabel = messType === 'non_veg' ? 'Non-Vegetarian' :
                messType === 'veg' ? 'Vegetarian' :
                    messType === 'food_park' ? 'Food Park (any type)' : 'Special';

            const prompt = `You are an expert Indian hostel mess chef. A caterer has the following raw materials available: ${ingredientsList}.
            
Suggest exactly 5 dishes suitable for ${mealType} in a ${messLabel} hostel mess that can be prepared IN BULK for hundreds of students using ONLY these ingredients (assume standard pantry staples like salt, oil, spices are always available).

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no extra text, just pure JSON array):
[
  {"name": "Dish Name", "description": "Brief 1-line description of the dish and key ingredients"},
  {"name": "Dish Name", "description": "Brief 1-line description"},
  {"name": "Dish Name", "description": "Brief 1-line description"},
  {"name": "Dish Name", "description": "Brief 1-line description"},
  {"name": "Dish Name", "description": "Brief 1-line description"}
]`;

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            // Parse the JSON (clean up any markdown code blocks if present)
            const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const dishes = JSON.parse(jsonStr);

            res.json({ dishes });
        } catch (error) {
            console.error('AI suggest-dishes error:', error);
            res.status(500).json({ error: 'Failed to generate dish suggestions: ' + error.message });
        }
    });

    /**
     * POST /api/ai/summarize-feedback
     * Reads all feedbacks from DB, sends to Gemini for summarization
     * Returns: { summary: string }
     */
    router.post('/summarize-feedback', async (req, res) => {
        try {
            const { feedbacks } = req.body;

            if (!feedbacks || feedbacks.length === 0) {
                return res.json({ summary: 'No feedback has been submitted yet. Once students start submitting feedback, you\'ll see AI-generated insights here.' });
            }

            const feedbackText = feedbacks.map(fb =>
                `Student: ${fb.student?.full_name || 'Anonymous'} | Message: "${fb.message}" | ${fb.response ? `Caterer Response: "${fb.response}"` : 'Status: Pending'}`
            ).join('\n');

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const prompt = `You are an analytics assistant for a hostel mess management system. Below are recent student feedback messages:

${feedbackText}

Write a concise EXECUTIVE SUMMARY (3-5 sentences) for the hostel administrator highlighting:
1. Overall sentiment (positive/negative/mixed)
2. Most common complaints or praises
3. Any critical issues that need immediate attention
4. A brief recommendation

Be objective, professional, and actionable. Do not use bullet points - write in clear paragraph form.`;

            const result = await model.generateContent(prompt);
            const summary = result.response.text().trim();

            res.json({ summary, feedbackCount: feedbacks.length });
        } catch (error) {
            console.error('AI summarize-feedback error:', error);
            res.status(500).json({ error: 'Failed to summarize feedback: ' + error.message });
        }
    });

    return router;
};
