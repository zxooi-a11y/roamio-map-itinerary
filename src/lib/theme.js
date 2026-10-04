/** One colour per day, cycling. Used on the map, chips, rails and cards. */
export const DAY_COLORS = ['#06402B', '#b5541c', '#1f5d8c', '#8a3b62', '#a07408', '#4b5563'];
export const dayColor = (index) => DAY_COLORS[index % DAY_COLORS.length];
