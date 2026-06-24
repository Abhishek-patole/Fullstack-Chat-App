export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const isWithinEditWindow = (createdAt: Date, now = new Date()): boolean => {
  return now.getTime() - createdAt.getTime() <= MESSAGE_EDIT_WINDOW_MS;
};