import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  StatusBar,
  FlatList,
} from 'react-native';
import { EditProfileScreen } from './EditProfileScreen';
import { ThemeSettingsScreen } from './ThemeSettingsScreen';
import { ReferralSystemScreen } from './ReferralSystemScreen';
import { Settings } from './Settings';
import { HelpandSupport } from './HelpandSupport';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationProps } from '../types/navigation';
import { getProfileImageUri } from '../utils/imageUtils';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { userStorage } from '../services/userStorage';
import { firebaseService } from '../services/firebaseService';
import { userApi } from '../services/api/userApi';

// Currency options
const currencies = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
];

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
}

type ProfileScreenProps = NavigationProps;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, logout, isLoading, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showReferralSystem, setShowReferralSystem] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelpandSupport, setShowHelpandSupport] = useState(false);
  const [loadingProfile] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  // Get current preferred currency
  const selectedCurrency = currencies.find(c => c.code === (user?.preferredCurrency || 'INR')) || currencies[0];

  // Handle currency change
  const handleCurrencyChange = async (currencyCode: string) => {
    if (!user) return;

    setSavingCurrency(true);
    setShowCurrencyModal(false);

    try {
      // Try PostgreSQL backend first
      try {
        await userApi.updateUser(user.id, {
          preferredCurrency: currencyCode,
        });
      } catch (backendError: any) {
        console.log('PostgreSQL backend error, falling back to Firebase:', backendError.message);
        // Fallback to Firebase
        await firebaseService.updateUser(user.id, {
          preferredCurrency: currencyCode,
        });
      }

      // Update local user
      const updatedUser = {
        ...user,
        preferredCurrency: currencyCode,
      };

      // Update local storage
      await userStorage.saveUser(updatedUser);

      // Update auth context
      login(updatedUser);

    } catch (error) {
      console.error('Error saving currency preference:', error);
    } finally {
      setSavingCurrency(false);
    }
  };

  // Use actual user profile from auth context
  const userProfile: UserProfile = {
    firstName: user?.name?.split(' ')[0] || 'User',
    lastName: user?.name?.split(' ')[1] || '',
    email: user?.email || user?.phoneNumber || '',
    profileImageUrl: null,
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const menuItems = [
    {
      id: 0,
      title: 'Preferred Currency',
      icon: 'attach-money',
      onPress: () => setShowCurrencyModal(true),
      rightContent: (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.secondaryText, marginRight: 4 }}>
            {selectedCurrency.symbol} {selectedCurrency.code}
          </Text>
          {savingCurrency ? (
            <ActivityIndicator size="small" color={colors.primaryButton} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          )}
        </View>
      ),
      isLoading: savingCurrency,
    },
    { id: 1, title: 'Theme Setting', icon: 'palette', onPress: () => setShowThemeSettings(true) },
    { id: 2, title: 'Payments', icon: 'credit-card', onPress: () => navigation.navigate('PaymentHistory') },
    { id: 3, title: 'Settings', icon: 'settings', onPress: () => setShowSettings(true) },
    { id: 4, title: 'Referral System', icon: 'card-giftcard', onPress: () => setShowReferralSystem(true) },
    { id: 5, title: 'Help & Support', icon: 'help-outline', onPress: () => setShowHelpandSupport(true) },
    {
      id: 6,
      title: 'Logout',
      icon: 'logout',
      onPress: handleLogout,
      isLoading: isLoading,
    },
  ];

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.statusBarBackground}
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }} // Only safe area padding
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {loadingProfile ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator size="small" color={colors.primaryButton} />
                </View>
              ) : user?.profileImageBase64 ? (
                <Image
                  source={{ uri: getProfileImageUri(user || {}) }}
                  style={styles.avatar}
                  onError={() => {
                    // Image load error
                  }}
                  onLoad={() => {
                  }}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {userProfile.firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {`${userProfile.firstName} ${userProfile.lastName}`}
              </Text>
              <Text style={styles.userEmail}>{userProfile.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => setShowEditProfile(true)}>
            <MaterialIcons name="edit" size={20} color={colors.primaryButton} />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item: any) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                item.isLoading && { opacity: 0.6 }
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
              disabled={item.isLoading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialIcons
                  name={item.icon}
                  size={24}
                  color={item.title === 'Logout' ? colors.error || '#EF4444' : colors.primaryText}
                  style={{ marginRight: 16 }}
                />
                <Text style={[
                  styles.menuTitle,
                  item.title === 'Logout' && { color: colors.error || '#EF4444' }
                ]}>{item.title}</Text>
                {item.title === 'Logout' && isLoading && (
                  <ActivityIndicator size="small" color={colors.error || '#EF4444'} style={{ marginLeft: 8 }} />
                )}
              </View>
              {item.rightContent && item.rightContent}
            </TouchableOpacity>
          ))}
        </View>
        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.1.0</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet">
        <EditProfileScreen onClose={() => setShowEditProfile(false)} />
      </Modal>

      <Modal visible={showThemeSettings} animationType="slide" presentationStyle="pageSheet">
        <ThemeSettingsScreen onClose={() => setShowThemeSettings(false)} />
      </Modal>


      <Modal visible={showReferralSystem} animationType="slide" presentationStyle="pageSheet">
        <ReferralSystemScreen onClose={() => setShowReferralSystem(false)} />
      </Modal>

      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <Settings onClose={() => setShowSettings(false)} />
      </Modal>

      <Modal visible={showHelpandSupport} animationType="slide" presentationStyle="pageSheet">
        <HelpandSupport onClose={() => setShowHelpandSupport(false)} />
      </Modal>

      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close" size={24} color={colors.primaryText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyItem,
                    item.code === selectedCurrency.code && styles.currencyItemSelected
                  ]}
                  onPress={() => handleCurrencyChange(item.code)}
                >
                  <View style={styles.currencyItemContent}>
                    <Text style={styles.currencyItemSymbol}>{item.symbol}</Text>
                    <View style={styles.currencyItemDetails}>
                      <Text style={styles.currencyItemCode}>{item.code}</Text>
                      <Text style={styles.currencyItemName}>{item.name}</Text>
                    </View>
                  </View>
                  {item.code === selectedCurrency.code && (
                    <Ionicons name="checkmark" size={24} color={colors.primaryButton} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 0,
      borderBottomColor: colors.secondaryText,
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.primaryText },
    scrollView: { flex: 1 },
    profileSection: {
      backgroundColor: colors.cardBackground,
      margin: 16,
      padding: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarContainer: { marginRight: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30 },
    avatarFallback: {
      backgroundColor: colors.primaryButton,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primaryButtonText,
    },
    avatarPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 18, fontWeight: '600', color: colors.primaryText, marginBottom: 4 },
    userEmail: { fontSize: 14, color: colors.secondaryText },
    editButton: { padding: 8 },
    menuSection: {
      backgroundColor: colors.cardBackground,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground,
    },
    menuTitle: { fontSize: 16, color: colors.primaryText, fontWeight: '500' },
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    versionText: {
      color: colors.primaryText,
      opacity: 0.5,
      fontSize: 14,
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBackground,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primaryText,
    },
    currencyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBackground,
    },
    currencyItemSelected: {
      backgroundColor: colors.inputBackground,
    },
    currencyItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    currencyItemSymbol: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.primaryText,
      marginRight: 12,
      width: 30,
      textAlign: 'center',
    },
    currencyItemDetails: {
      flexDirection: 'column',
    },
    currencyItemCode: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
    },
    currencyItemName: {
      fontSize: 12,
      color: colors.secondaryText,
    },
  });
