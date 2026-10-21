/**
 * Meal Time Detection Utility
 * Auto-detects the current day and meal period based on local time.
 * Exact meal windows per requirements.
 */

const MEAL_WINDOWS = [
    { meal: 'breakfast', start: 7.5, end: 10 },      // 07:30–10:00
    { meal: 'lunch',     start: 12, end: 14.5 },     // 12:00–14:30
    { meal: 'snacks',    start: 16.5, end: 18 },     // 16:30–18:00
    { meal: 'dinner',    start: 19.5, end: 22 },     // 19:30–22:00
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns the current meal info based on the user's local time.
 * Returns null if outside all windows.
 */
export const getCurrentMealInfo = () => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const day = DAY_NAMES[now.getDay()];

    // Format YYYY-MM-DD using local time
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

    // Outside all windows
    return null;
};

/**
 * Returns whether a given meal type is currently within its window.
 */
export const isWithinMealWindow = (mealType) => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const window = MEAL_WINDOWS.find(w => w.meal === mealType);
    return window && hour >= window.start && hour < window.end;
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

/**
 * Returns the exact window description for a meal.
 */
export const getMealWindow = (mealType) => {
    const windows = {
        breakfast: '07:30–10:00',
        lunch: '12:00–14:30',
        snacks: '16:30–18:00',
        dinner: '19:30–22:00',
    };
    return windows[mealType] || '';
};

/**
 * Returns the next upcoming meal and time until it starts.
 */
export const getNextMeal = () => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    // Find the next window
    const upcoming = MEAL_WINDOWS
        .filter(w => w.end > hour)
        .sort((a, b) => a.start - b.start)[0];

    if (!upcoming) return null;

    const minutesUntil = Math.max(0, Math.round((upcoming.start - hour) * 60));
    return {
        meal: upcoming.meal,
        startsInMinutes: minutesUntil,
        window: getMealWindow(upcoming.meal)
    };
};
