import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  BackHandler,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import { wp, hp } from '../utils/deviceDimensions';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface NoInternetModalProps {
  visible: boolean;
  onRetry?: () => void;
}

export const NoInternetModal: React.FC<NoInternetModalProps> = ({
  visible,
  onRetry,
}) => {
  const { colors } = useTheme();
  const { checkConnection, connectionDetails } = useNetwork();
  const [isRetrying, setIsRetrying] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for the icon
  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);

  // Prevent back button when modal is visible
  useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [visible]);

  // Handle retry
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const isConnected = await checkConnection();
      if (isConnected && onRetry) {
        onRetry();
      }
    } catch (error) {
      console.error('Error retrying connection:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Open device settings
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      // Open iOS Settings app
      Linking.openURL('App-Prefs:root=WIFI');
    } else {
      // Open Android WiFi settings
      Linking.openSettings();
    }
  };

  // Get connection type message
  const getConnectionMessage = () => {
    if (connectionDetails.isWifi) {
      return 'WiFi connected but no internet access';
    } else if (connectionDetails.isCellular) {
      const gen = connectionDetails.cellularGeneration;
      if (gen) {
        return `${gen.toUpperCase()} connected but no internet access`;
      }
      return 'Mobile data connected but no internet access';
    }
    return 'No network connection detected';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
          {/* Animated Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                backgroundColor: colors.error + '20',
                transform: [{ scale: pulseAnim }]
              }
            ]}
          >
            <Icon
              name="cloud-offline-outline"
              size={wp ? wp(12) : 48}
              color={colors.error}
            />
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.primaryText }]}>
            No Internet Connection
          </Text>

          {/* Connection Status */}
          <View style={[styles.statusContainer, { backgroundColor: colors.inputBackground }]}>
            <View style={styles.statusRow}>
              <MaterialIcons
                name={connectionDetails.isWifi ? 'wifi-off' : 'signal-cellular-off'}
                size={20}
                color={colors.secondaryText}
              />
              <Text style={[styles.statusText, { color: colors.secondaryText }]}>
                {getConnectionMessage()}
              </Text>
            </View>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            Please check your internet connection and try again. Make sure you're connected to WiFi or have mobile data enabled.
          </Text>

          {/* Platform-specific tips */}
          <View style={[styles.tipsContainer, { borderColor: colors.border }]}>
            <Text style={[styles.tipsTitle, { color: colors.primaryText }]}>
              Troubleshooting Tips:
            </Text>
            {Platform.OS === 'ios' ? (
              <>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Toggle WiFi off and on in Control Center
                </Text>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Check if Airplane Mode is enabled
                </Text>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Restart your router or modem
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Toggle WiFi or Mobile Data in Quick Settings
                </Text>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Check if Airplane Mode is enabled
                </Text>
                <Text style={[styles.tipText, { color: colors.secondaryText }]}>
                  {'\u2022'} Reset network settings if issue persists
                </Text>
              </>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.retryButton,
                { backgroundColor: colors.primaryButton },
                isRetrying && { opacity: 0.7 }
              ]}
              onPress={handleRetry}
              activeOpacity={0.8}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsButton, { borderColor: colors.border }]}
              onPress={openSettings}
              activeOpacity={0.8}
            >
              <Icon name="settings-outline" size={20} color={colors.primaryText} />
              <Text style={[styles.settingsButtonText, { color: colors.primaryText }]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: wp ? wp(6) : 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: wp ? wp(24) : 96,
    height: wp ? wp(24) : 96,
    borderRadius: wp ? wp(12) : 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp ? hp(2) : 16,
  },
  title: {
    fontSize: wp ? wp(5.5) : 22,
    fontWeight: 'bold',
    marginBottom: hp ? hp(1.5) : 12,
    textAlign: 'center',
  },
  statusContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginBottom: hp ? hp(2) : 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: wp ? wp(3.5) : 14,
    fontWeight: '500',
    flex: 1,
  },
  message: {
    fontSize: wp ? wp(3.8) : 15,
    textAlign: 'center',
    marginBottom: hp ? hp(2) : 16,
    lineHeight: 22,
    paddingHorizontal: wp ? wp(2) : 8,
  },
  tipsContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: hp ? hp(2.5) : 20,
  },
  tipsTitle: {
    fontSize: wp ? wp(3.5) : 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: wp ? wp(3.2) : 13,
    lineHeight: 20,
    marginLeft: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp ? hp(1.8) : 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: wp ? wp(4) : 16,
    fontWeight: 'bold',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp ? hp(1.8) : 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  settingsButtonText: {
    fontSize: wp ? wp(4) : 16,
    fontWeight: '600',
  },
});

export default NoInternetModal;
