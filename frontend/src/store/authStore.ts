import { create } from 'zustand';
import type { AuthUser } from '../types/api';

interface AuthState {
  user: AuthUser | null;
  isInitialised: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  setInitialised: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitialised: false,

  login: (user) => {
    set({ user });
  },

  logout: () => {
    set({ user: null });
  },

  setInitialised: (user) => {
    set({ user, isInitialised: true });
  },
}));
