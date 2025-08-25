import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@sf1/shared';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentTenant: Tenant | null;
  
  // Actions
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (isLoading: boolean) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const authStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      currentTenant: null,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: true,
        isLoading: false 
      }),

      setTokens: (accessToken, refreshToken) => set({ 
        token: accessToken, 
        refreshToken,
        isAuthenticated: true 
      }),

      setLoading: (isLoading) => set({ isLoading }),

      setCurrentTenant: (tenant) => set({ currentTenant: tenant }),

      logout: () => set({ 
        user: null, 
        token: null, 
        refreshToken: null, 
        isAuthenticated: false,
        isLoading: false,
        currentTenant: null
      }),

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: 'sf1-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        currentTenant: state.currentTenant,
      }),
    }
  )
);