import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [realtimeData, setRealtimeData] = useState({
    keyStatus: {},
    metrics: {},
    alerts: [],
  });

  useEffect(() => {
    const socketInstance = io('/', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      toast.success('Connected to real-time updates');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      toast.error('Disconnected from real-time updates');
    });

    socketInstance.on('key:created', (data) => {
      setRealtimeData((prev) => ({
        ...prev,
        keyStatus: {
          ...prev.keyStatus,
          [data.id]: data,
        },
      }));
      toast.success(`New API key created: ${data.name}`);
    });

    socketInstance.on('key:updated', (data) => {
      setRealtimeData((prev) => ({
        ...prev,
        keyStatus: {
          ...prev.keyStatus,
          [data.id]: data,
        },
      }));
    });

    socketInstance.on('key:rotated', (data) => {
      setRealtimeData((prev) => ({
        ...prev,
        keyStatus: {
          ...prev.keyStatus,
          [data.id]: data,
        },
      }));
      toast.info(`API key rotated: ${data.name}`);
    });

    socketInstance.on('key:deleted', (data) => {
      setRealtimeData((prev) => {
        const newKeyStatus = { ...prev.keyStatus };
        delete newKeyStatus[data.id];
        return {
          ...prev,
          keyStatus: newKeyStatus,
        };
      });
      toast.warning(`API key deleted: ${data.name}`);
    });

    socketInstance.on('metrics:update', (data) => {
      setRealtimeData((prev) => ({
        ...prev,
        metrics: data,
      }));
    });

    socketInstance.on('alert:new', (alert) => {
      setRealtimeData((prev) => ({
        ...prev,
        alerts: [alert, ...prev.alerts].slice(0, 50), // Keep last 50 alerts
      }));
      
      if (alert.severity === 'critical') {
        toast.error(alert.message);
      } else if (alert.severity === 'warning') {
        toast.warning(alert.message);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value = {
    socket,
    connected,
    realtimeData,
    emit: (event, data) => socket?.emit(event, data),
    on: (event, handler) => {
      socket?.on(event, handler);
      return () => socket?.off(event, handler);
    },
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};