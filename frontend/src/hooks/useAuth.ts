import { useState, useEffect } from 'react';

interface AuthUser {
  user_idx: number;
  email: string;
  status?: string;
  tz?: string;
}

/**
 * Authentication hook - manages user session with JWT tokens
 * Uses localStorage to persist authentication state
 */
export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Load token and user from localStorage
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = (accessToken: string, refreshToken: string, userData: AuthUser) => {
    setToken(accessToken);
    setUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  };

  return {
    token,
    user,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
  };
}
