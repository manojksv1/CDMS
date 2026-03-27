import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'ENGINEER';
  software_access: 'INSTALLATION' | 'IMPLEMENTATION' | 'BOTH';
  timezone?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') as string) : null,
  token: null, // Token is now in HttpOnly cookie

  login: (_, user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null });
  },
}));
