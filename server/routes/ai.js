const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

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
            const normalizedMealType = String(mealType || '').toLowerCase().trim();
            const messLabel = messType === 'non_veg' ? 'Non-Vegetarian' :
                messType === 'veg' ? 'Vegetarian' :
                    messType === 'food_park' ? 'Food Park (any type)' : 'Special';
            const cuisineBalanceInstruction =
                normalizedMealType === 'lunch' || normalizedMealType === 'dinner'
                    ? 'CRITICAL BALANCE RULE: Ensure the 5 dishes are culturally balanced so students with North Indian and South Indian preferences both have suitable choices. Include at least 2 clearly North Indian style dishes and at least 2 clearly South Indian style dishes in the 5 suggestions.'
                    : 'Prefer variety across regional Indian styles where possible.';

            const prompt = `You are an expert Indian hostel mess chef. A caterer has the following raw materials available: ${ingredientsList}.
            
Suggest exactly 5 dishes suitable for ${mealType} in a ${messLabel} hostel mess that can be prepared IN BULK for hundreds of students using ONLY these ingredients (assume standard pantry staples like salt, oil, spices are always available).

${cuisineBalanceInstruction}

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
     * POST /api/ai/upload-food-image
     * Proxies image upload to imgbb API
     * Body: { image: base64String }
     * Returns: { url: string, deleteUrl: string }
     */
    router.post('/upload-food-image', async (req, res) => {
        try {
            const { image } = req.body;
            if (!image) {
                return res.status(400).json({ error: 'image (base64) is required' });
            }

            const apiKey = process.env.IMGBB_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'IMGBB_API_KEY not configured on server' });
            }

            // Upload to imgbb with 24-hour expiration
            const formData = new URLSearchParams();
            formData.append('key', apiKey);
            formData.append('image', image);
            formData.append('expiration', '86400'); // 24 hours

            const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                maxBodyLength: Infinity,
            });

            if (response.data && response.data.success) {
                res.json({
                    url: response.data.data.display_url,
                    thumb: response.data.data.thumb?.url,
                    deleteUrl: response.data.data.delete_url,
                });
            } else {
                res.status(500).json({ error: 'imgbb upload failed' });
            }
        } catch (error) {
            console.error('Image upload error:', error?.response?.data || error.message);
            res.status(500).json({ error: 'Failed to upload image: ' + (error?.response?.data?.error?.message || error.message) });
        }
    });

    /**
     * POST /api/ai/summarize-daily-feedback
     * Summarizes today's food feedback for a caterer using Gemini AI
     * Body: { catererId: string, date?: string, mealType?: string }
     * Returns: { summary: string, feedbackCount: number, mealType: string, date: string }
     */
    router.post('/summarize-daily-feedback', async (req, res) => {
        try {
            const { catererId, date, mealType, feedbacks } = req.body;

            if (!feedbacks || !Array.isArray(feedbacks)) {
                 return res.status(400).json({ error: 'feedbacks array is required' });
            }

            if (!feedbacks || feedbacks.length === 0) {
                return res.json({
                    summary: 'No daily food feedback has been submitted yet for this period. Once students start submitting feedback, you\'ll see AI-generated insights here.',
                    feedbackCount: 0,
                    mealType: mealType || 'all',
                    date: date || new Date().toISOString().split('T')[0],
                    feedbacks: [],
                });
            }

            // Build context for AI
            const feedbackText = feedbacks.map((fb, i) => {
                let entry = `${i + 1}. Student "${fb.student?.full_name || 'Anonymous'}": "${fb.message}"`;
                if (fb.meal_type) entry += ` [Meal: ${fb.meal_type}]`;
                if (fb.day_label) entry += ` [Day: ${fb.day_label}]`;
                return entry;
            }).join('\n');

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const mealLabel = mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1) : 'All Meals';
            const dateLabel = date || 'today';

            const prompt = `You are a food quality analyst for a hostel mess. Below are ${feedbacks.length} student feedback entries for ${mealLabel} on ${dateLabel}:

${feedbackText}

Provide a STRUCTURED FEEDBACK SUMMARY for the caterer in this exact format:

**Overall Rating:** (Good / Average / Needs Improvement)

**Key Issues:**
- List specific items mentioned and what needs fixing (e.g., "Dal was too salty", "Rice was undercooked")
- Be very specific about which food items have problems

**What Worked Well:**
- List any positive mentions

**Actionable Improvements:**
- Give 2-3 specific, actionable suggestions the caterer can implement immediately for the next meal

Keep it concise, direct, and actionable. Focus on specific food items mentioned in the feedback.`;

            const result = await model.generateContent(prompt);
            const summary = result.response.text().trim();

            // Mark these feedbacks as reviewed by AI in the database
            const feedbackIds = feedbacks.map(fb => fb.id).filter(Boolean);
            if (feedbackIds.length > 0) {
                try {
                    await supabase
                        .from('feedbacks')
                        .update({ reviewed_by_ai: true })
                        .in('id', feedbackIds);
                } catch (updateErr) {
                    console.error('Error updating reviewed_by_ai status:', updateErr);
                }
            }

            res.json({
                summary,
                feedbackCount: feedbacks.length,
                mealType: mealType || 'all',
                date: date || new Date().toISOString().split('T')[0],
                feedbacks: feedbacks.map(fb => ({
                    id: fb.id,
                    message: fb.message,
                    studentName: fb.student?.full_name || 'Anonymous',
                    imageUrl: fb.image_url,
                    mealType: fb.meal_type,
                    dayLabel: fb.day_label,
                    createdAt: fb.created_at,
                    reviewedByAi: true,
                })),
            });
        } catch (error) {
            console.error('AI summarize-daily-feedback error:', error);
            res.status(500).json({ error: 'Failed to summarize daily feedback: ' + error.message });
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
            const MAX_BULK_ITEM_REPEATS = 3;
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
            const scheduledItems = [];

            const cloneForSchedule = (item, day) => {
                const publicItem = { ...item };
                delete publicItem.__idx;
                delete publicItem.__repeat;
                return {
                    ...publicItem,
                    day_index: day,
                };
            };

            const buildRepeatedQueue = (mealItems, totalNeeded) => {
                if (!mealItems || mealItems.length === 0 || totalNeeded <= 0) return [];

                const queue = [];
                for (let repeat = 1; repeat <= MAX_BULK_ITEM_REPEATS && queue.length < totalNeeded; repeat += 1) {
                    for (const item of mealItems) {
                        if (queue.length >= totalNeeded) break;
                        queue.push({ ...item, __repeat: repeat });
                    }
                }
                return queue;
            };

            const northKeywords = [
                'roti', 'chapati', 'paratha', 'naan', 'rajma', 'chole', 'dal makhani', 'paneer',
                'kadhi', 'aloo', 'jeera rice', 'pulao', 'palak', 'mutter', 'kulcha', 'amritsari',
            ];
            const southKeywords = [
                'idli', 'dosa', 'uttapam', 'upma', 'sambar', 'rasam', 'curd rice', 'lemon rice',
                'tamarind rice', 'pongal', 'avial', 'poriyal', 'kootu', 'appam', 'puttu', 'bisi bele',
            ];

            const detectCuisine = (item) => {
                const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
                const hasNorth = northKeywords.some((k) => text.includes(k));
                const hasSouth = southKeywords.some((k) => text.includes(k));

                if (hasNorth && hasSouth) return 'both';
                if (hasNorth) return 'north';
                if (hasSouth) return 'south';
                return 'neutral';
            };

            const distributeLunchDinnerBalanced = (meal) => {
                const mealItems = buckets[meal];
                if (!mealItems || mealItems.length === 0) return;

                const pool = {
                    north: [],
                    south: [],
                    both: [],
                    neutral: [],
                };

                const totalMealItems = mode === 'min-config'
                    ? (perDayCounts[meal] || 0) * totalDays
                    : mealItems.length;
                const sourceItems = mode === 'min-config'
                    ? buildRepeatedQueue(mealItems, totalMealItems)
                    : mealItems;

                sourceItems.forEach((item) => {
                    const cuisine = detectCuisine(item);
                    pool[cuisine].push(item);
                });

                const dayCaps = Array.from({ length: totalDays }, (_, day) => {
                    if (mode === 'min-config') return perDayCounts[meal] || 0;
                    const base = Math.floor(totalMealItems / totalDays);
                    const remainder = totalMealItems % totalDays;
                    return day < remainder ? base + 1 : base;
                });

                const dayStats = Array.from({ length: totalDays }, () => ({
                    total: 0,
                    north: 0,
                    south: 0,
                }));

                const takeAny = () => (
                    pool.north.shift() ||
                    pool.south.shift() ||
                    pool.both.shift() ||
                    pool.neutral.shift() ||
                    null
                );

                const place = (day, item, cuisineHint) => {
                    if (!item) return;
                    if (mode === 'min-config') {
                        scheduledItems.push(cloneForSchedule(item, day));
                    } else {
                        assignments[item.__idx] = day;
                    }
                    dayStats[day].total += 1;

                    const resolvedCuisine = cuisineHint || detectCuisine(item);
                    if (resolvedCuisine === 'north') dayStats[day].north += 1;
                    if (resolvedCuisine === 'south') dayStats[day].south += 1;
                    if (resolvedCuisine === 'both') {
                        dayStats[day].north += 1;
                        dayStats[day].south += 1;
                    }
                };

                const takeForNorth = () => pool.north.shift() || pool.both.shift() || pool.neutral.shift() || pool.south.shift() || null;
                const takeForSouth = () => pool.south.shift() || pool.both.shift() || pool.neutral.shift() || pool.north.shift() || null;

                // First pass: try to guarantee a North and South style option each day (best effort).
                for (let day = 0; day < totalDays; day += 1) {
                    if (dayStats[day].total >= dayCaps[day]) continue;

                    const northItem = takeForNorth();
                    if (northItem) {
                        place(day, northItem);
                    }

                    if (dayStats[day].total >= dayCaps[day]) continue;

                    const southItem = takeForSouth();
                    if (southItem) {
                        place(day, southItem);
                    }
                }

                // Second pass: fill remaining slots while keeping north/south counts as balanced as possible.
                for (let day = 0; day < totalDays; day += 1) {
                    while (dayStats[day].total < dayCaps[day]) {
                        let nextItem;
                        if (dayStats[day].north <= dayStats[day].south) {
                            nextItem = takeForNorth();
                        } else {
                            nextItem = takeForSouth();
                        }

                        if (!nextItem) {
                            nextItem = takeAny();
                        }

                        if (!nextItem) break;
                        place(day, nextItem);
                    }
                }

                // Any leftovers due to caps or uneven constraints: place by least-filled day.
                let leftover = takeAny();
                while (leftover) {
                    let targetDay = 0;
                    for (let day = 1; day < totalDays; day += 1) {
                        if (dayStats[day].total < dayStats[targetDay].total) {
                            targetDay = day;
                        }
                    }
                    place(targetDay, leftover);
                    leftover = takeAny();
                }

                buckets[meal] = [];
            };

            if (mode === 'equal') {
                for (const meal of mealOrder) {
                    if (meal === 'lunch' || meal === 'dinner') {
                        distributeLunchDinnerBalanced(meal);
                        continue;
                    }

                    let dayPointer = 0;
                    while (buckets[meal].length > 0) {
                        const nextItem = buckets[meal].shift();
                        assignments[nextItem.__idx] = dayPointer % totalDays;
                        dayPointer += 1;
                    }
                }
            } else {
                distributeLunchDinnerBalanced('lunch');
                distributeLunchDinnerBalanced('dinner');

                const remainingMeals = ['breakfast', 'snacks'];
                for (const meal of remainingMeals) {
                    const take = perDayCounts[meal] || 0;
                    const queue = buildRepeatedQueue(buckets[meal], take * totalDays);
                    let pointer = 0;

                    for (let day = 0; day < totalDays; day += 1) {
                        for (let i = 0; i < take && pointer < queue.length; i += 1) {
                            scheduledItems.push(cloneForSchedule(queue[pointer], day));
                            pointer += 1;
                        }
                    }
                }
            }

            // If any unknown meal types exist, place them in day order at the end.
            buckets.other.forEach((item, idx) => {
                if (mode === 'min-config') {
                    scheduledItems.push(cloneForSchedule(item, idx % totalDays));
                } else {
                    assignments[item.__idx] = idx % totalDays;
                }
            });

            const mappedItems = mode === 'min-config'
                ? scheduledItems
                : items.map((item, idx) => ({
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
