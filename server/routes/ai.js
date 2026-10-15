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
     * Body: {
     *   items: [{ name, meal_type, description, is_repeating? }],
     *   repeatingItems?: { breakfast: string[], lunch: string[], snacks: string[], dinner: string[] },
     *   days: 14,
     *   distributionMode?: 'equal' | 'min-config',
     *   mealCounts?: { breakfast, lunch, snacks, dinner },
     *   messType?: 'veg' | 'non_veg' | 'special' | 'food_park',
     *   startDate?: string
     * }
     * Returns: distributed array mapping items to `day_index`
     */
    router.post('/distribute-csv', async (req, res) => {
        try {
            const { items, repeatingItems, days, mealCounts, distributionMode, messType, startDate } = req.body;

            const rawRegularItems = Array.isArray(items) ? items : [];
            const repeatingBuckets = {
                breakfast: [],
                lunch: [],
                snacks: [],
                dinner: [],
            };

            // 1. Ingest repeating items from repeatingItems object
            if (repeatingItems && typeof repeatingItems === 'object') {
                ['breakfast', 'lunch', 'snacks', 'dinner'].forEach((m) => {
                    const list = repeatingItems[m] || repeatingItems[m.toUpperCase()] || [];
                    if (Array.isArray(list)) {
                        list.forEach((entry) => {
                            const nameStr = typeof entry === 'string' ? entry : entry?.name;
                            if (nameStr && typeof nameStr === 'string' && nameStr.trim()) {
                                const trimmed = nameStr.trim();
                                if (!repeatingBuckets[m].includes(trimmed)) {
                                    repeatingBuckets[m].push(trimmed);
                                }
                            }
                        });
                    }
                });
            }

            // 2. Ingest any item marked with is_repeating from items array
            const nonRepeatingItems = [];
            rawRegularItems.forEach((it) => {
                const normMeal = String(it.meal_type || '').toLowerCase().trim();
                const nameStr = String(it.name || '').trim();
                if (it.is_repeating && repeatingBuckets[normMeal]) {
                    if (nameStr && !repeatingBuckets[normMeal].includes(nameStr)) {
                        repeatingBuckets[normMeal].push(nameStr);
                    }
                } else if (nameStr) {
                    nonRepeatingItems.push({
                        ...it,
                        name: nameStr,
                        meal_type: normMeal || 'lunch',
                    });
                }
            });

            const totalRepeatingItems = Object.values(repeatingBuckets).reduce((s, a) => s + a.length, 0);
            if (nonRepeatingItems.length === 0 && totalRepeatingItems === 0) {
                return res.status(400).json({ error: 'No menu items or repeating items provided to distribute' });
            }

            const totalDays = Number(days) > 0 ? Number(days) : 14;
            const mode = distributionMode === 'equal' ? 'equal' : 'min-config';

            // Target per-day counts derived from comprehensive analysis of October 2025 Veg, Non-Veg, and Special menus
            const perDayCounts = {
                breakfast: Number(mealCounts?.breakfast) > 0 ? Number(mealCounts.breakfast) : 6,
                lunch: Number(mealCounts?.lunch) > 0 ? Number(mealCounts.lunch) : 11,
                snacks: Number(mealCounts?.snacks) > 0 ? Number(mealCounts.snacks) : 3,
                dinner: Number(mealCounts?.dinner) > 0 ? Number(mealCounts.dinner) : 11,
            };

            const parsedStartDate = startDate ? new Date(startDate) : new Date();
            const startDayOfWeek = isNaN(parsedStartDate.getTime()) ? 1 : parsedStartDate.getDay();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const startDayName = dayNames[startDayOfWeek];
            const messLabel = messType === 'non_veg' ? 'Non-Vegetarian' :
                messType === 'veg' ? 'Vegetarian' :
                messType === 'food_park' ? 'Food Park' : 'Special';

            // 3. If Gemini is available, attempt AI institutional dietitian distribution
            if (process.env.GEMINI_API_KEY) {
                try {
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const distributionPrompt = `You are an expert institutional dietitian and executive chef for a prestigious Indian university hostel mess catering to students from North, South, East, and West India.

We have a list of raw menu items to schedule for a ${totalDays}-day cycle in a ${messLabel} mess.
The schedule starts on a ${startDayName} (Day 0 = ${startDayName}, Day 1 = next day, etc.).

TARGET NON-REPEATING MEAL ALLOCATIONS PER DAY:
- Breakfast: ${perDayCounts.breakfast} items
- Lunch: ${perDayCounts.lunch} items
- Snacks: ${perDayCounts.snacks} items
- Dinner: ${perDayCounts.dinner} items
Distribution Mode: ${mode}

DAILY REPEATING ITEMS (MUST appear on every single day, day_index 0 to ${totalDays - 1}):
- Breakfast: ${JSON.stringify(repeatingBuckets.breakfast)}
- Lunch: ${JSON.stringify(repeatingBuckets.lunch)}
- Snacks: ${JSON.stringify(repeatingBuckets.snacks)}
- Dinner: ${JSON.stringify(repeatingBuckets.dinner)}

REGULAR DISHES TO DISTRIBUTE ACROSS THE DAYS:
${JSON.stringify(nonRepeatingItems.map(it => ({ name: it.name, meal_type: it.meal_type })), null, 2)}

CRITICAL BALANCING AND NUTRITIONAL RULES:
1. BALANCED DIET (Monday through Friday):
   - Weekdays must follow a healthy, balanced diet.
   - Emphasize lean proteins (dals, legumes, rajma, chole, sprouts, paneer, eggs, chicken/fish), complex carbohydrates (phulka, chapati, millets, whole grains, steamed rice), fiber-rich vegetables (poriyals, kootu, dry sabzis, salads, fruits), and digestive aids (curd, buttermilk, rasam).
   - Low excess oil/grease, no heavy junk meals on weekdays.

2. WEEKEND INDULGENCE / JUNK / SPECIAL ITEMS (Saturday & Sunday):
   - Saturdays: Feature street food, Indo-Chinese specials, deep-fried snacks, and comfort foods (e.g., Schezwan Fried Rice, Veg/Gobi Manchurian, Pav Bhaji, Chole Bhature, Samosas, Pakoras, Vada Pav, Veg Puffs, Pastries / Tea Cake, Ice Cream, Jalebi).
   - Sundays: Festive feasts, weekend biryani specials, and celebratory dishes (e.g., Hyderabadi Dum Biryani, Chicken Biryani, Paneer Butter Masala, Puri Chana, Pani Puri / Chaats, Dosa Extravaganza, Semiya Payesh, Halwa, Gulab Jamun).

3. REGIONAL BALANCE (North, South, East, West India):
   - Ensure authentic representation so students from all 4 zones feel at home every single day:
     * North India: Phulka, Parathas (Aloo, Paneer, Palak), Rajma, Chole Masala, Dal Makhani, Dal Tadka, Kadhi Pakora, Paneer dishes, Pulao, Jeera Rice.
     * South India: Idli, Dosa (Masala, Podi, Plain), Vada, Pongal, Upma, Uttapam, Chettinad gravies, Arachivitta Sambar, Udupi Sambar, Rasam (Milagu, Paruppu, Tomato, Pineapple, Mysore), Vatha/Mor Kuzhambu, Poriyal, Kootu, Curd rice, Lemon/Tamarind rice.
     * East India: Luchi/Puri, Cholar Dal, Ghugni, Alur Dom, Mustard fish/curry, Dalma, Aloo Posto, Semiya payesh, Rosogolla/Sandesh.
     * West India: Pav Bhaji, Poha, Misal Pav, Thepla, Dhokla, Sev Tameta, Gujarati Kadhi, Usal.
   - For Lunch & Dinner: Always guarantee both North-style bread/curry and South-style rice/sambar/poriyal/rasam options, rotating East and West specialties.

4. RESEMBLANCE TO REAL HOSTEL MESS MENUS (as attached October 2025 docx):
   - Output dish pairings should resemble authentic hostel mess menus (e.g., Onion Aloo Veg Paratha + Tomato Chutney + Curd, Dosa (Podi Karam) + Sambar + Peanut Chutney, Phulka + Rajma Curry + Veg Pulao + Boondi Raita, White Rice + Mochai Kara Kuzhambu + Beans Poriyal + Rasam).

5. REPEATING ITEMS INCLUSION:
   - Ensure the repeating items provided for Breakfast, Lunch, Snacks, and Dinner are scheduled on EVERY day (days 0 to ${totalDays - 1}) with "is_repeating": true.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "day_index": 0,
    "meal_type": "breakfast",
    "name": "Dish Name",
    "description": "Short description",
    "is_repeating": false
  }
]
No markdown fences, no conversational text, strictly the JSON array.`;

                    const result = await model.generateContent(distributionPrompt);
                    const text = result.response.text().trim();
                    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                    const aiDistributed = JSON.parse(jsonStr);

                    if (Array.isArray(aiDistributed) && aiDistributed.length > 0) {
                        const cleanedDistributed = aiDistributed
                            .filter(it => it && it.name && it.meal_type && Number.isInteger(it.day_index))
                            .map(it => ({
                                name: String(it.name).trim(),
                                meal_type: String(it.meal_type).toLowerCase().trim(),
                                description: it.description ? String(it.description).trim() : (it.is_repeating ? 'Daily Repeating Item' : 'Bulk Upload'),
                                day_index: Math.max(0, Math.min(totalDays - 1, Number(it.day_index))),
                                is_repeating: Boolean(it.is_repeating),
                            }));

                        if (cleanedDistributed.length > 0) {
                            return res.json({ distributed: cleanedDistributed, engine: 'gemini' });
                        }
                    }
                } catch (geminiError) {
                    console.warn('Gemini AI distribute encountered an error, falling back to deterministic engine:', geminiError.message);
                }
            }

            // 4. Deterministic distribution fallback engine
            const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
            const MAX_BULK_ITEM_REPEATS = 3;
            const scheduledItems = [];

            // A. Schedule repeating items on EVERY day
            for (let day = 0; day < totalDays; day += 1) {
                mealOrder.forEach((meal) => {
                    repeatingBuckets[meal].forEach((repName) => {
                        scheduledItems.push({
                            name: repName,
                            meal_type: meal,
                            description: 'Daily Repeating Item',
                            day_index: day,
                            is_repeating: true,
                        });
                    });
                });
            }

            // B. Classify regular items by region and diet/weekend
            const northKeywords = [
                'roti', 'chapati', 'paratha', 'naan', 'rajma', 'chole', 'dal makhani', 'paneer',
                'kadhi', 'aloo', 'jeera rice', 'pulao', 'palak', 'mutter', 'kulcha', 'amritsari',
                'dal tadka', 'kofta', 'bhindi masala', 'baingan', 'kashmiri', 'methi', 'malai'
            ];
            const southKeywords = [
                'idli', 'dosa', 'uttapam', 'upma', 'sambar', 'rasam', 'curd rice', 'lemon rice',
                'tamarind rice', 'pongal', 'avial', 'poriyal', 'kootu', 'appam', 'puttu', 'bisi bele',
                'chettinad', 'kara kuzhambu', 'more kuzhambu', 'vatha kuzhambu', 'thorvaiyal',
                'thovaiyal', 'parupu podi', 'arachivitta', 'uduppi', 'udupi', 'seva', 'masiyal',
                'varuval', 'bonda'
            ];
            const eastKeywords = [
                'luchi', 'cholar dal', 'aloo posto', 'ghugni', 'dalma', 'mustard', 'rosogolla',
                'rasgulla', 'sandesh', 'payesh', 'kosha', 'kolkata', 'macher', 'fish curry',
                'dim kosha', 'chhena', 'posto'
            ];
            const westKeywords = [
                'pav bhaji', 'poha', 'misal', 'thepla', 'dhokla', 'sev tameta', 'gujarati',
                'usal', 'batata', 'vada pav', 'kolhapuri', 'dabeli', 'shrikhand', 'dal baati'
            ];
            const weekendKeywords = [
                'biryani', 'briyani', 'fried rice', 'manchurian', 'pav bhaji', 'samosa', 'chaat',
                'chat', 'pani puri', 'poori', 'puri', 'burger', 'pasta', 'pizza', 'french fries',
                'chips', 'schezwan', 'ice cream', 'jalebi', 'jelabi', 'gulab jamun', 'halwa',
                'ladoo', 'laddu', 'pakoda', 'bajji', 'pastry', 'cake', 'kheer', 'payasam',
                'custard', 'milkshake', 'noodles', 'maggi', 'puff', 'chilly', 'chilli', 'crispy'
            ];

            const detectCuisine = (item) => {
                const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
                const isNorth = northKeywords.some((k) => text.includes(k));
                const isSouth = southKeywords.some((k) => text.includes(k));
                const isEast = eastKeywords.some((k) => text.includes(k));
                const isWest = westKeywords.some((k) => text.includes(k));

                const matches = [];
                if (isNorth) matches.push('north');
                if (isSouth) matches.push('south');
                if (isEast) matches.push('east');
                if (isWest) matches.push('west');

                if (matches.length > 1) return 'pan_indian';
                if (matches.length === 1) return matches[0];
                return 'neutral';
            };

            const isWeekendSpecial = (item) => {
                const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
                return weekendKeywords.some((k) => text.includes(k));
            };

            // Buckets for regular items
            const buckets = {
                breakfast: [],
                lunch: [],
                snacks: [],
                dinner: [],
                other: [],
            };

            nonRepeatingItems.forEach((item, idx) => {
                const normMeal = String(item.meal_type || '').toLowerCase().trim();
                const entry = { ...item, __idx: idx };
                if (buckets[normMeal]) {
                    buckets[normMeal].push(entry);
                } else {
                    buckets.other.push(entry);
                }
            });

            const cloneForSchedule = (item, day) => {
                const publicItem = { ...item };
                delete publicItem.__idx;
                delete publicItem.__repeat;
                return {
                    ...publicItem,
                    day_index: day,
                    is_repeating: false,
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

            const isWeekendDay = (day) => {
                const dow = (startDayOfWeek + day) % 7;
                return dow === 0 || dow === 6; // Sunday (0) or Saturday (6)
            };

            // Distribute each meal type
            mealOrder.forEach((meal) => {
                const mealItems = buckets[meal];
                if (!mealItems || mealItems.length === 0) return;

                const targetPerDay = perDayCounts[meal] || 0;
                const totalMealItems = mode === 'min-config'
                    ? targetPerDay * totalDays
                    : mealItems.length;

                const sourceItems = mode === 'min-config'
                    ? buildRepeatedQueue(mealItems, totalMealItems)
                    : [...mealItems];

                // Segregate by weekend special vs balanced weekday, and regional cuisine
                const weekendPool = [];
                const weekdayPool = [];

                sourceItems.forEach((it) => {
                    if (isWeekendSpecial(it)) {
                        weekendPool.push(it);
                    } else {
                        weekdayPool.push(it);
                    }
                });

                // Regional pools for balanced distribution
                const regionPool = {
                    north: [],
                    south: [],
                    east: [],
                    west: [],
                    pan_indian: [],
                    neutral: [],
                };

                sourceItems.forEach((it) => {
                    const c = detectCuisine(it);
                    regionPool[c].push(it);
                });

                const dayCaps = Array.from({ length: totalDays }, (_, day) => {
                    if (mode === 'min-config') return targetPerDay;
                    const base = Math.floor(totalMealItems / totalDays);
                    const remainder = totalMealItems % totalDays;
                    return day < remainder ? base + 1 : base;
                });

                const dayAllocations = Array.from({ length: totalDays }, () => []);

                // Pass 1: For Saturdays and Sundays, allocate weekend special items first
                for (let day = 0; day < totalDays; day += 1) {
                    if (isWeekendDay(day) && weekendPool.length > 0) {
                        while (dayAllocations[day].length < dayCaps[day] && weekendPool.length > 0) {
                            const item = weekendPool.shift();
                            dayAllocations[day].push(cloneForSchedule(item, day));
                        }
                    }
                }

                // Pass 2: For Weekdays (Mon-Fri), allocate wholesome balanced items first
                for (let day = 0; day < totalDays; day += 1) {
                    if (!isWeekendDay(day) && weekdayPool.length > 0) {
                        while (dayAllocations[day].length < Math.min(dayCaps[day], 2) && weekdayPool.length > 0) {
                            const item = weekdayPool.shift();
                            dayAllocations[day].push(cloneForSchedule(item, day));
                        }
                    }
                }

                // Pass 3: Pan-Indian balance for lunch and dinner (North, South, East, West)
                if (meal === 'lunch' || meal === 'dinner') {
                    for (let day = 0; day < totalDays; day += 1) {
                        if (dayAllocations[day].length < dayCaps[day] && regionPool.north.length > 0) {
                            dayAllocations[day].push(cloneForSchedule(regionPool.north.shift(), day));
                        }
                        if (dayAllocations[day].length < dayCaps[day] && regionPool.south.length > 0) {
                            dayAllocations[day].push(cloneForSchedule(regionPool.south.shift(), day));
                        }
                        if (dayAllocations[day].length < dayCaps[day] && regionPool.east.length > 0) {
                            dayAllocations[day].push(cloneForSchedule(regionPool.east.shift(), day));
                        }
                        if (dayAllocations[day].length < dayCaps[day] && regionPool.west.length > 0) {
                            dayAllocations[day].push(cloneForSchedule(regionPool.west.shift(), day));
                        }
                    }
                }

                // Pass 4: Fill remaining day caps from remaining pools
                const remainingPool = [...weekendPool, ...weekdayPool];
                for (let day = 0; day < totalDays; day += 1) {
                    while (dayAllocations[day].length < dayCaps[day] && remainingPool.length > 0) {
                        const item = remainingPool.shift();
                        dayAllocations[day].push(cloneForSchedule(item, day));
                    }
                }

                // Pass 5: If there are still empty slots due to pool depletion, cycle through mealItems
                if (mode === 'min-config') {
                    let fillPointer = 0;
                    for (let day = 0; day < totalDays; day += 1) {
                        while (dayAllocations[day].length < dayCaps[day]) {
                            const item = mealItems[fillPointer % mealItems.length];
                            dayAllocations[day].push(cloneForSchedule(item, day));
                            fillPointer += 1;
                        }
                    }
                }

                // Collect all allocated items for this meal
                dayAllocations.forEach((allocs) => {
                    allocs.forEach((it) => scheduledItems.push(it));
                });
            });

            // Any unrecognized meal types: place across days
            buckets.other.forEach((item, idx) => {
                scheduledItems.push(cloneForSchedule(item, idx % totalDays));
            });

            return res.json({ distributed: scheduledItems, engine: 'deterministic' });
        } catch (error) {
            console.error('AI distribute error:', error);
            res.status(500).json({ error: 'Failed to distribute items using AI: ' + error.message });
        }
    });

    return router;
};
