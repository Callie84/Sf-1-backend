import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { authStore } from '@/store/auth';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<{
  items?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = authStore.getState().token;
        const tenantId = authStore.getState().currentTenant?.id;

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = authStore.getState().refreshToken;
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh-token', {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
              
              authStore.getState().setTokens(accessToken, newRefreshToken);
              
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            authStore.getState().logout();
            window.location.href = '/auth/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else if (error.message) {
          toast.error(error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  // File upload method
  async uploadFile(file: File, onUploadProgress?: (progressEvent: any) => void): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  }

  // Download file method
  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const api = new ApiClient();

// API methods grouped by feature
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: (data?: any) => api.post('/auth/logout', data),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.patch(`/auth/reset-password/${token}`, { password }),
  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),
  changePassword: (data: any) => api.patch('/auth/change-password', data),
  getProfile: () => api.get('/auth/profile'),
};

export const usersApi = {
  getUsers: (params?: any) => api.get('/users', { params }),
  getUserById: (id: string) => api.get(`/users/${id}`),
  updateUser: (id: string, data: any) => api.patch(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  getCurrentUser: () => api.get('/users/me'),
  updateProfile: (data: any) => api.patch('/users/me', data),
  getUserStats: () => api.get('/users/stats'),
  assignRoles: (id: string, roles: string[]) => api.patch(`/users/${id}/roles`, { roles }),
};

export const messagesApi = {
  getMessages: (channelId: string, params?: any) => api.get(`/messages/channel/${channelId}`, { params }),
  createMessage: (data: any) => api.post('/messages', data),
  updateMessage: (id: string, content: string) => api.patch(`/messages/${id}`, { content }),
  deleteMessage: (id: string) => api.delete(`/messages/${id}`),
  addReaction: (id: string, emoji: string) => api.post(`/messages/${id}/reactions`, { emoji }),
  removeReaction: (id: string, emoji: string) => api.delete(`/messages/${id}/reactions`, { data: { emoji } }),
  searchMessages: (params: any) => api.get('/messages/search', { params }),
};

export const notificationsApi = {
  getNotifications: (params?: any) => api.get('/notifications', { params }),
  markAsRead: (notificationIds: string[]) => api.patch('/notifications/mark-read', { notificationIds }),
  markAllAsRead: () => api.patch('/notifications/mark-all-read'),
  deleteNotification: (id: string) => api.delete(`/notifications/${id}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  createNotification: (data: any) => api.post('/notifications', data),
};

export const filesApi = {
  getFiles: (params?: any) => api.get('/files', { params }),
  uploadFile: (file: File, metadata?: any, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }
    return api.post('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress ? (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      } : undefined,
    });
  },
  getFileById: (id: string) => api.get(`/files/${id}`),
  updateFile: (id: string, data: any) => api.patch(`/files/${id}`, data),
  deleteFile: (id: string) => api.delete(`/files/${id}`),
  downloadFile: (id: string) => api.downloadFile(id),
  shareFile: (id: string, userId: string, permissions: string) => 
    api.post(`/files/${id}/share`, { userId, permissions }),
  removeShare: (id: string, userId: string) => api.delete(`/files/${id}/share/${userId}`),
  getFileStats: () => api.get('/files/stats'),
};

export const adminApi = {
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getSystemHealth: () => api.get('/admin/system/health'),
  getAuditLogs: (params?: any) => api.get('/admin/audit-logs', { params }),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  updateUserStatus: (id: string, status: string) => api.patch(`/admin/users/${id}/status`, { status }),
  getFiles: (params?: any) => api.get('/admin/files', { params }),
  deleteFile: (id: string) => api.delete(`/admin/files/${id}`),
  broadcastNotification: (data: any) => api.post('/admin/notifications/broadcast', data),
  exportData: (dataType: string, format: string = 'json') => 
    api.get('/admin/export', { params: { dataType, format } }),
};