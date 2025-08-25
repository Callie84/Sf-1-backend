import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { authStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

export const useAuth = () => {
  const router = useRouter();
  const {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    currentTenant,
    setUser,
    setTokens,
    setLoading,
    setCurrentTenant,
    logout,
    updateUser,
  } = authStore();

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await authApi.login({ email, password });
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        setUser(user);
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        toast.success('Login successful!');
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    try {
      setLoading(true);
      const response = await authApi.register(userData);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        setUser(user);
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        toast.success('Registration successful! Please check your email to verify your account.');
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    try {
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      logout();
      router.push('/auth/login');
      toast.success('Logged out successfully');
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const response = await authApi.updateProfile(updates);
      
      if (response.success && response.data) {
        updateUser(response.data.user);
        toast.success('Profile updated successfully');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      
      if (response.success) {
        toast.success('Password changed successfully');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await authApi.forgotPassword(email);
      
      if (response.success) {
        toast.success('Password reset link sent to your email');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send reset link');
    }
  };

  const resetPassword = async (token: string, password: string) => {
    try {
      const response = await authApi.resetPassword(token, password);
      
      if (response.success) {
        toast.success('Password reset successful');
        router.push('/auth/login');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      const response = await authApi.verifyEmail(token);
      
      if (response.success) {
        toast.success('Email verified successfully');
        // Refresh user data
        if (isAuthenticated) {
          const profileResponse = await authApi.getProfile();
          if (profileResponse.success && profileResponse.data) {
            setUser(profileResponse.data.user);
          }
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to verify email');
    }
  };

  // Check if user has specific role
  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  // Check if user is admin
  const isAdmin = (): boolean => {
    return hasRole('admin');
  };

  // Check if user is moderator or admin
  const isModerator = (): boolean => {
    return hasAnyRole(['admin', 'moderator']);
  };

  // Check if user has premium access
  const isPremium = (): boolean => {
    return hasAnyRole(['admin', 'premium']);
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (token && !user) {
        try {
          const response = await authApi.getProfile();
          if (response.success && response.data) {
            setUser(response.data.user);
          }
        } catch (error) {
          // Token might be invalid, logout
          logout();
        }
      }
    };

    initAuth();
  }, [token, user, setUser, logout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    currentTenant,
    login,
    register,
    logout: logoutUser,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    setCurrentTenant,
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
    isPremium,
  };
};