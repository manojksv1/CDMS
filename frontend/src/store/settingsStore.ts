import { create } from 'zustand';

interface SettingsState {
  appTimezone: string;
  setAppTimezone: (tz: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  appTimezone: 'UTC',
  setAppTimezone: (tz) => set({ appTimezone: tz }),
}));
