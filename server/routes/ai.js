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

    /**
     * POST /api/ai/distribute-csv
     * Body: { items: [{ name, meal_type, description }], days: 14, distributionMode?: 'equal' | 'min-config', mealCounts?: { breakfast, lunch, snacks, dinner } }
     * Returns: distributed array mapping items to `day_index`
     */
    router.post('/distribute-csv', async (req, res) => {
        try {
            const { items, days, mealCounts, distributionMode } = req.body;
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'items array is required' });
            }

            const totalDays = Number(days) > 0 ? Number(days) : 14;
            const mode = distributionMode === 'equal' ? 'equal' : 'min-config';
            const perDayCounts = {
                breakfast: Number(mealCounts?.breakfast) > 0 ? Number(mealCounts.breakfast) : 3,
                lunch: Number(mealCounts?.lunch) > 0 ? Number(mealCounts.lunch) : 6,
                snacks: Number(mealCounts?.snacks) > 0 ? Number(mealCounts.snacks) : 2,
                dinner: Number(mealCounts?.dinner) > 0 ? Number(mealCounts.dinner) : 6,
            };

            const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
            const buckets = {
                breakfast: [],
                lunch: [],
                snacks: [],
                dinner: [],
                other: [],
            };

            items.forEach((item, idx) => {
                const normalizedMeal = String(item.meal_type || '').toLowerCase().trim();
                const entry = { ...item, __idx: idx };
                if (buckets[normalizedMeal]) {
                    buckets[normalizedMeal].push(entry);
                } else {
                    buckets.other.push(entry);
                }
            });

            const assignments = new Array(items.length);

            const hasPendingMealItems = () => (
                buckets.breakfast.length > 0 ||
                buckets.lunch.length > 0 ||
                buckets.snacks.length > 0 ||
                buckets.dinner.length > 0
            );

            if (mode === 'equal') {
                for (const meal of mealOrder) {
                    let dayPointer = 0;
                    while (buckets[meal].length > 0) {
                        const nextItem = buckets[meal].shift();
                        assignments[nextItem.__idx] = dayPointer % totalDays;
                        dayPointer += 1;
                    }
                }
            } else {
                // Fill one full day at a time in meal order, then move to the next day.
                while (hasPendingMealItems()) {
                    for (let day = 0; day < totalDays; day += 1) {
                        for (const meal of mealOrder) {
                            const take = perDayCounts[meal] || 0;
                            for (let i = 0; i < take && buckets[meal].length > 0; i += 1) {
                                const nextItem = buckets[meal].shift();
                                assignments[nextItem.__idx] = day;
                            }
                        }

                        if (!hasPendingMealItems()) break;
                    }
                }
            }

            // If any unknown meal types exist, place them in day order at the end.
            buckets.other.forEach((item, idx) => {
                assignments[item.__idx] = idx % totalDays;
            });

            const mappedItems = items.map((item, idx) => ({
                ...item,
                day_index: Number.isInteger(assignments[idx]) ? assignments[idx] : (idx % totalDays),
            }));

            res.json({ distributed: mappedItems });
        } catch (error) {
            console.error('AI distribute error:', error);
            res.status(500).json({ error: 'Failed to distribute items using AI: ' + error.message });
        }
    });

    return router;
};
