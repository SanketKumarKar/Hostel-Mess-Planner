/**
 * Meal Time Detection Utility
 * Auto-detects the current day and meal period based on IST time.
 */

const MEAL_WINDOWS = [
    { meal: 'breakfast', start: 7, end: 10 },
    { meal: 'lunch',     start: 12, end: 15 },
    { meal: 'snacks',    start: 17, end: 18.5 }, // 5:00 PM – 6:30 PM
    { meal: 'dinner',    start: 19, end: 22 },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns the current meal info based on the user's local time.
 * If the current time falls outside any meal window, picks the most
 * recently ended or upcoming meal.
 */
export const getCurrentMealInfo = () => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60; // e.g. 17.5 = 5:30 PM
    const day = DAY_NAMES[now.getDay()];
    
    // Format YYYY-MM-DD using local time (not UTC via toISOString)
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Check if we're inside a meal window
    for (const w of MEAL_WINDOWS) {
        if (hour >= w.start && hour < w.end) {
            return { day, mealType: w.meal, date: dateStr };
        }
    }

    // Outside all windows — pick the closest meal (past preferred)
    let bestMeal = 'dinner'; // default fallback
    let bestDist = Infinity;

    for (const w of MEAL_WINDOWS) {
        // Distance to end of this window (how long ago it ended)
        const distAfter = hour - w.end;
        // Distance to start of next window
        const distBefore = w.start - hour;

        if (distAfter >= 0 && distAfter < bestDist) {
            bestDist = distAfter;
            bestMeal = w.meal;
        }
        if (distBefore >= 0 && distBefore < bestDist) {
            bestDist = distBefore;
            bestMeal = w.meal;
        }
    }

    return { day, mealType: bestMeal, date: dateStr };
};

/**
 * Returns a human-friendly label for a meal type.
 */
export const getMealLabel = (mealType) => {
    const labels = {
        breakfast: '🌅 Breakfast',
        lunch: '☀️ Lunch',
        snacks: '🍪 Snacks',
        dinner: '🌙 Dinner',
    };
    return labels[mealType] || mealType;
};

/**
 * Returns all meal types in order.
 */
export const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];
