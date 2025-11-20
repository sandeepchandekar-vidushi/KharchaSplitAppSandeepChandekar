import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { Platform, AppState, AppStateStatus } from 'react-native';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  connectionDetails: {
    isWifi: boolean;
    isCellular: boolean;
    isEthernet: boolean;
    cellularGeneration: string | null;
    strength: number | null; // iOS only
    isExpensive: boolean; // iOS: cellular, Android: metered
  };
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<NetInfoStateType>(NetInfoStateType.unknown);
  const [connectionDetails, setConnectionDetails] = useState({
    isWifi: false,
    isCellular: false,
    isEthernet: false,
    cellularGeneration: null as string | null,
    strength: null as number | null,
    isExpensive: false,
  });

  // Update network state from NetInfo state
  const updateNetworkState = useCallback((state: NetInfoState) => {
    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);

    // Extract detailed connection info
    const details = {
      isWifi: state.type === NetInfoStateType.wifi,
      isCellular: state.type === NetInfoStateType.cellular,
      isEthernet: state.type === NetInfoStateType.ethernet,
      cellularGeneration: null as string | null,
      strength: null as number | null,
      isExpensive: false,
    };

    // Get cellular generation (2g, 3g, 4g, 5g)
    if (state.type === NetInfoStateType.cellular && state.details) {
      details.cellularGeneration = state.details.cellularGeneration || null;
      details.isExpensive = state.details.isConnectionExpensive ?? false;
    }

    // Get WiFi signal strength (iOS only)
    if (state.type === NetInfoStateType.wifi && state.details) {
      if (Platform.OS === 'ios') {
        // iOS provides signal strength as percentage
        details.strength = (state.details as any).strength ?? null;
      }
      details.isExpensive = state.details.isConnectionExpensive ?? false;
    }

    setConnectionDetails(details);
  }, []);

  // Check connection manually
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network connection:', error);
      return false;
    }
  }, [updateNetworkState]);

  // Subscribe to network state changes
  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then(updateNetworkState);

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);

    // Also check when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        NetInfo.fetch().then(updateNetworkState);
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [updateNetworkState]);

  const value: NetworkContextType = {
    isConnected,
    isInternetReachable,
    connectionType,
    connectionDetails,
    checkConnection,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export default NetworkContext;
