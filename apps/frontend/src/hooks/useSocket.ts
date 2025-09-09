import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { authStore } from '@/store/auth';
import { notificationStore } from '@/store/notifications';
import { toast } from 'react-hot-toast';

interface UseSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { autoConnect = true, onConnect, onDisconnect, onError } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const { token, user } = authStore();
  const { addNotification } = notificationStore();

  useEffect(() => {
    if (!token || !autoConnect) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      onConnect?.();
      
      // Join user-specific room
      if (user?.id) {
        socket.emit('join-room', `user:${user.id}`);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      setConnectionError(error.message);
      setIsConnected(false);
      onError?.(error);
    });

    // Real-time event handlers
    socket.on('notification', (data) => {
      if (data.type === 'notification:new' || data.title) {
        addNotification(data);
        
        // Show toast for important notifications
        if (data.priority === 'high' || data.priority === 'urgent') {
          toast(data.title, {
            icon: data.type === 'error' ? '🚨' : data.type === 'warning' ? '⚠️' : 'ℹ️',
          });
        }
      }
    });

    socket.on('message:created', (message) => {
      // Handle new message
      // This would typically update a messages store
    });

    socket.on('message:updated', (message) => {
      // Handle message update
    });

    socket.on('message:deleted', (data) => {
      // Handle message deletion
    });

    socket.on('message:reaction:added', (data) => {
      // Handle reaction added
    });

    socket.on('message:reaction:removed', (data) => {
      // Handle reaction removed
    });

    socket.on('user:status:changed', (data) => {
      // Handle user status change (online/offline)
    });

    socket.on('channel:member:joined', (data) => {
      // Handle member joined channel
    });

    socket.on('channel:member:left', (data) => {
      // Handle member left channel
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, user?.id, autoConnect, onConnect, onDisconnect, onError, addNotification]);

  const emit = (event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  const joinRoom = (roomId: string) => {
    emit('join-room', roomId);
  };

  const leaveRoom = (roomId: string) => {
    emit('leave-room', roomId);
  };

  const sendMessage = (channelId: string, message: any) => {
    emit('message:send', { channelId, ...message });
  };

  const joinChannel = (channelId: string) => {
    joinRoom(channelId);
  };

  const leaveChannel = (channelId: string) => {
    leaveRoom(channelId);
  };

  const updateTypingStatus = (channelId: string, isTyping: boolean) => {
    emit('typing', { channelId, isTyping });
  };

  const updateUserStatus = (status: 'online' | 'away' | 'busy' | 'offline') => {
    emit('user:status', { status });
  };

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    emit,
    joinRoom,
    leaveRoom,
    joinChannel,
    leaveChannel,
    sendMessage,
    updateTypingStatus,
    updateUserStatus,
  };
};