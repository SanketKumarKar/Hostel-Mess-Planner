const DAY_MS = 24 * 60 * 60 * 1000;
const MENU_SLOT_BASE_DATE = '2000-01-03'; // Monday

const pad2 = (value) => String(value).padStart(2, '0');

const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00`);

const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
};

const getNormalizedWeeks = (sessionWeeks) => Number(sessionWeeks) === 1 ? 1 : 2;

const getTotalSlots = (sessionWeeks) => getNormalizedWeeks(sessionWeeks) * 7;

const getCycleIndex = (dateKey, sessionWeeks) => {
    const totalSlots = getTotalSlots(sessionWeeks);
    const current = parseDateKey(dateKey);
    const base = parseDateKey(MENU_SLOT_BASE_DATE);
    const diffDays = Math.floor((current.getTime() - base.getTime()) / DAY_MS);
    return ((diffDays % totalSlots) + totalSlots) % totalSlots;
};

const formatSlotLabel = (dateKey, sessionWeeks, weekdayStyle = 'long') => {
    const index = getCycleIndex(dateKey, sessionWeeks);
    const slotDate = new Date(parseDateKey(MENU_SLOT_BASE_DATE));
    slotDate.setDate(slotDate.getDate() + index);

    const dayName = slotDate.toLocaleDateString('en-US', { weekday: weekdayStyle });
    if (getNormalizedWeeks(sessionWeeks) === 1) {
        return dayName;
    }

    const weekNumber = Math.floor(index / 7) + 1;
    return `${dayName}, Wk${weekNumber}`;
};

const buildSlotOptions = (sessionWeeks) => {
    const totalSlots = getTotalSlots(sessionWeeks);
    const base = parseDateKey(MENU_SLOT_BASE_DATE);

    return Array.from({ length: totalSlots }, (_, index) => {
        const slotDate = new Date(base);
        slotDate.setDate(slotDate.getDate() + index);
        const value = formatDateKey(slotDate);

        return {
            value,
            label: formatSlotLabel(value, sessionWeeks, 'long'),
            index,
        };
    });
};

export {
    buildSlotOptions,
    formatSlotLabel,
    getTotalSlots,
    getNormalizedWeeks,
};
