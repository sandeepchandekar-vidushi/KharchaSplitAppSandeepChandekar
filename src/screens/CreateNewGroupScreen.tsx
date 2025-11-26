import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Share,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { launchImageLibrary, ImageLibraryOptions, Asset } from 'react-native-image-picker';
import { request, check, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import Contacts, { Contact } from 'react-native-contacts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { firebaseService, CreateGroup } from '../services/firebaseService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureDataUri } from '../utils/imageUtils';
import { contactsCacheService } from '../services/contactsCacheService';
import { formatPhoneForDisplay } from '../utils/phoneFormatter';
import { groupApi } from '../services/api/groupApi';
import { inviteApi } from '../services/api/inviteApi';
import { userApi } from '../services/api/userApi';

interface GroupData {
  name: string;
  description: string;
  numberOfMembers: string;
  currency: string;
  coverImage: string | null;
  coverImageBase64: string | null;
}

// Common currencies with symbols
const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

interface PrefillExpenseData {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  receiptBase64?: string;
}

interface CreateNewGroupScreenProps {
  onClose?: () => void;
  onSave?: (group: any, prefillExpense?: PrefillExpenseData) => void;
  prefillExpense?: PrefillExpenseData;
}

interface FilteredContact extends Contact {
  isRegistered: boolean;
  userProfile?: any;
}

export const CreateNewGroupScreen: React.FC<CreateNewGroupScreenProps> = ({ onClose, onSave, prefillExpense }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [groupData, setGroupData] = useState<GroupData>({
    name: '',
    description: '',
    numberOfMembers: '',
    currency: 'INR',
    coverImage: null,
    coverImageBase64: null,
  });
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const [selectedMembers, setSelectedMembers] = useState<FilteredContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [filteredContacts, setFilteredContacts] = useState<FilteredContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [phoneSearchResult, setPhoneSearchResult] = useState<FilteredContact | null>(null);
  const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<{
    status: 'checking' | 'granted' | 'denied' | 'blocked' | 'unavailable';
    hasRequested: boolean;
    initialized: boolean;
  }>({ status: 'checking', hasRequested: false, initialized: false });

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const permissionCheckRef = useRef<boolean>(false);
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initialize cache and check permissions once on mount
    const initAndClearCache = async () => {
      await contactsCacheService.init();
      console.log('[CreateGroup] Cache stats before clear:', contactsCacheService.getStats());
      // Clear cache to force fresh backend lookup for accurate registration status
      await contactsCacheService.clear();
      console.log('[CreateGroup] Cache cleared - forcing fresh backend lookup');
    };

    if (!permissionState.initialized) {
      initAndClearCache();
      checkContactsPermission();
    }

    // Cleanup: Clear base64 image from memory on unmount
    return () => {
      setGroupData(prev => ({
        ...prev,
        coverImageBase64: null,
      }));
    };
  }, []); // Remove dependencies to prevent re-runs

  // Set default currency from user's preferred currency
  useEffect(() => {
    if (user?.preferredCurrency) {
      setGroupData(prev => ({
        ...prev,
        currency: user.preferredCurrency || 'INR',
      }));
    }
  }, [user?.preferredCurrency]);

  // Shimmer animation effect
  useEffect(() => {
    if (contactsLoading) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [contactsLoading, shimmerAnimation]);

  useEffect(() => {
    // Listen for app state changes to re-check permissions when returning from settings
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        permissionState.initialized &&
        (permissionState.status === 'blocked' || permissionState.status === 'denied')
      ) {
        setTimeout(() => {
          checkContactsPermission();
        }, 500); // Small delay to prevent rapid state changes
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [permissionState.initialized, permissionState.status]);

  const getContactsPermission = () => {
    return Platform.OS === 'android'
      ? PERMISSIONS.ANDROID.READ_CONTACTS
      : PERMISSIONS.IOS.CONTACTS;
  };

  const checkContactsPermission = async () => {
    // Prevent multiple simultaneous permission checks
    if (permissionCheckRef.current) {
      return;
    }

    try {
      permissionCheckRef.current = true;

      // Don't show checking state if already initialized to prevent blinking
      if (!permissionState.initialized) {
        setPermissionState(prev => ({ ...prev, status: 'checking' }));
      }

      const permission = getContactsPermission();
      const result = await check(permission);

      switch (result) {
        case RESULTS.GRANTED:
          setPermissionState({ status: 'granted', hasRequested: true, initialized: true });
          loadContacts();
          break;
        case RESULTS.BLOCKED:
          setPermissionState({ status: 'blocked', hasRequested: true, initialized: true });
          break;
        case RESULTS.UNAVAILABLE:
          setPermissionState({ status: 'unavailable', hasRequested: true, initialized: true });
          break;
        case RESULTS.DENIED:
        default:
          setPermissionState({ status: 'denied', hasRequested: false, initialized: true });
          break;
      }
    } catch (error) {
      setPermissionState({ status: 'denied', hasRequested: false, initialized: true });
    } finally {
      permissionCheckRef.current = false;
    }
  };

  const requestContactsPermission = async () => {
    try {
      const permission = getContactsPermission();
      const result = await request(permission);

      switch (result) {
        case RESULTS.GRANTED:
          setPermissionState({ status: 'granted', hasRequested: true, initialized: true });
          loadContacts();
          break;
        case RESULTS.DENIED:
          setPermissionState({ status: 'denied', hasRequested: true, initialized: true });
          showPermissionDeniedAlert();
          break;
        case RESULTS.BLOCKED:
          setPermissionState({ status: 'blocked', hasRequested: true, initialized: true });
          showPermissionBlockedAlert();
          break;
        case RESULTS.UNAVAILABLE:
          setPermissionState({ status: 'unavailable', hasRequested: true, initialized: true });
          showPermissionUnavailableAlert();
          break;
        default:
          setPermissionState({ status: 'denied', hasRequested: true, initialized: true });
          showPermissionDeniedAlert();
      }
    } catch (error) {
      setPermissionState({ status: 'denied', hasRequested: true, initialized: true });
      Alert.alert('Error', 'Failed to request contacts permission. Please try again.');
    }
  };

  const showPermissionDeniedAlert = () => {
    Alert.alert(
      'Contacts Access Required',
      'To add members to your group, we need access to your contacts. This helps you find friends who are already using KharchaSplit.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Grant Access', onPress: requestContactsPermission },
      ]
    );
  };

  const showPermissionBlockedAlert = () => {
    Alert.alert(
      'Contacts Access Blocked',
      'Contacts access has been permanently denied. To add members, please enable contacts access in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openSettings() },
      ]
    );
  };

  const showPermissionUnavailableAlert = () => {
    Alert.alert(
      'Contacts Unavailable',
      'Contacts are not available on this device. You can still create groups, but you\'ll need to add members manually.',
      [{ text: 'OK' }]
    );
  };

  /**
   * Direct contacts permission request handler - triggers permission dialog immediately
   */
  const handleRequestContacts = async () => {
    try {
      setContactsLoading(true);
      // First request permission directly
      const permission = getContactsPermission();
      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        // Permission granted! Now fetch contacts
        setPermissionState({ status: 'granted', hasRequested: true, initialized: true });

        try {
          const contacts = await Contacts.getAll();

          // Map contacts to ensure proper display names (like AddMemberScreen does)
          const mappedContacts = contacts.map(contact => ({
            ...contact,
            displayName: contact.displayName ||
                         `${contact.givenName || ''} ${contact.familyName || ''}`.trim() ||
                         'Unknown',
          }));

          // Process contacts with registration status together
          await processContactsWithRegistration(mappedContacts);
        } catch (contactError: any) {
          Alert.alert('Error', 'Failed to load contacts. Please try again.');
        }
      } else if (result === RESULTS.BLOCKED) {
        // Permission permanently blocked
        setPermissionState({ status: 'blocked', hasRequested: true, initialized: true });

        Alert.alert(
          'Contacts Access Required',
          'Contacts access has been blocked. To add friends from your contacts, please enable contacts access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => openSettings().catch(err => { })
            },
          ]
        );
      } else if (result === RESULTS.UNAVAILABLE) {
        // Contacts unavailable
        setPermissionState({ status: 'unavailable', hasRequested: true, initialized: true });

        Alert.alert(
          'Contacts Unavailable',
          'Contacts are not available on this device. You can still create groups by entering phone numbers manually.',
          [{ text: 'OK' }]
        );
      } else {
        // Permission denied
        setPermissionState({ status: 'denied', hasRequested: true, initialized: true });

        Alert.alert(
          'Contacts Access Denied',
          'You can still create groups, but you\'ll need to add members manually using phone numbers.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: handleRequestContacts }
          ]
        );
      }
    } catch (error: any) {
      setPermissionState({ status: 'denied', hasRequested: true, initialized: true });
      Alert.alert('Error', error.message || 'Failed to request contacts permission. Please try again.');
    } finally {
      setContactsLoading(false);
    }
  };

  const normalizePhoneNumber = (phoneNumber: string): string => {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Handle Indian phone numbers - normalize to 10-digit format without country code
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      // Remove country code 91
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      // Remove leading 0
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 10) {
      // Already in correct 10-digit format
    }

    return cleaned;
  };

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      // Get contacts from device
      const contactsList = await Contacts.getAll();

      // Map contacts to ensure proper display names (like AddMemberScreen does)
      const mappedContacts = contactsList.map(contact => ({
        ...contact,
        displayName: contact.displayName ||
                     `${contact.givenName || ''} ${contact.familyName || ''}`.trim() ||
                     'Unknown',
      }));

      // Process contacts and get backend data simultaneously
      await processContactsWithRegistration(mappedContacts);

      setContactsLoading(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts.');
      setContactsLoading(false);
    }
  };

  const handleRefreshContacts = async () => {
    if (refreshing || contactsLoading) return;

    try {
      setRefreshing(true);

      // Clear cache to force fresh backend lookup
      await contactsCacheService.clear();
      console.log('[CreateGroup] Cache cleared for refresh - forcing fresh backend lookup');

      // Reload contacts
      await loadContacts();
    } catch (error) {
      console.error('[CreateGroup] Error refreshing contacts:', error);
      Alert.alert('Error', 'Failed to refresh contacts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Search for user by phone number
   * Triggers when exactly 10 digits are entered
   */
  const searchByPhoneNumber = async (phoneNumber: string) => {
    try {
      setPhoneSearchLoading(true);
      setPhoneSearchResult(null);

      // Format phone number to +91XXXXXXXXXX
      const formattedPhone = `+91${phoneNumber}`;
      console.log('[CreateGroup] Searching for phone number:', formattedPhone);

      // Check with backend
      const response = await userApi.checkRegisteredUsers([formattedPhone]);

      if (response.success && response.data?.registered?.length > 0) {
        const registeredUser = response.data.registered[0];

        // Check if user is already in contacts list
        const existingContact = filteredContacts.find(c => {
          const contactPhone = normalizePhoneNumber(c.phoneNumbers?.[0]?.number || '');
          return contactPhone === phoneNumber;
        });

        if (existingContact) {
          console.log('[CreateGroup] User already in contacts list');
          setPhoneSearchResult(null);
          return;
        }

        // Check if user is current user
        const currentUserPhone = user?.phoneNumber ? normalizePhoneNumber(user.phoneNumber) : null;
        if (currentUserPhone === phoneNumber) {
          console.log('[CreateGroup] Cannot add yourself');
          setPhoneSearchResult(null);
          return;
        }

        // Create a contact object from the registered user
        const nameParts = (registeredUser?.name || '').split(' ');
        const searchedContact: FilteredContact = {
          recordID: `phone-search-${registeredUser.userId}`,
          displayName: registeredUser.name,
          givenName: nameParts[0] || registeredUser.name,
          familyName: nameParts.slice(1).join(' '),
          phoneNumbers: [{ number: formattedPhone, label: 'mobile' }],
          emailAddresses: registeredUser.email ? [{ email: registeredUser.email, label: 'work' }] : [],
          thumbnailPath: registeredUser.profileImage,
          isRegistered: true,
          userProfile: {
            id: registeredUser.userId,
            name: registeredUser.name,
            phoneNumber: formattedPhone,
            email: registeredUser.email,
            profileImage: registeredUser.profileImage,
          },
        };

        console.log('[CreateGroup] Found registered user:', registeredUser.name);
        setPhoneSearchResult(searchedContact);
      } else {
        console.log('[CreateGroup] No registered user found for:', formattedPhone);
        setPhoneSearchResult(null);
      }
    } catch (error) {
      console.error('[CreateGroup] Error searching by phone:', error);
      setPhoneSearchResult(null);
    } finally {
      setPhoneSearchLoading(false);
    }
  };

  /**
   * Handle search query change
   * Detect when 10 digits are entered and trigger phone search
   */
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);

    // Extract only digits from the query
    const digits = query.replace(/\D/g, '');

    // If exactly 10 digits, trigger phone search
    if (digits.length === 10) {
      searchByPhoneNumber(digits);
    } else {
      // Clear phone search result if not 10 digits
      setPhoneSearchResult(null);
    }
  };

  const processContactsWithRegistration = async (contactsList: Contact[]) => {
    try {
      console.log('[CreateGroup] Processing', contactsList.length, 'contacts with cache optimization');

      // Process contacts and separate cached from uncached
      const allContacts: FilteredContact[] = [];
      const uncachedPhones: string[] = [];
      const processedContactIds = new Set<string>();

      contactsList.forEach(contact => {
        if (contact.phoneNumbers?.length > 0 && !processedContactIds.has(contact.recordID)) {
          processedContactIds.add(contact.recordID);

          const primaryPhone = normalizePhoneNumber(contact.phoneNumbers?.[0]?.number || '');

          if (primaryPhone.length === 10) {
            // Check cache first
            const cached = contactsCacheService.get(primaryPhone);

            if (cached) {
              // Use cached data
              if (cached.userProfile?.id !== user?.id) {
                allContacts.push({
                  ...contact,
                  isRegistered: cached.isRegistered,
                  userProfile: cached.userProfile,
                });
              }
            } else {
              // Need to fetch from backend
              allContacts.push({
                ...contact,
                isRegistered: false,
                userProfile: undefined,
              });
              uncachedPhones.push(`+91${primaryPhone}`);
            }
          }
        }
      });

      console.log('[CreateGroup] Cached:', allContacts.filter(c => c.isRegistered).length, 'Uncached:', uncachedPhones.length);

      // Fetch only uncached contacts from backend API
      if (uncachedPhones.length > 0) {
        console.log('[CreateGroup] Fetching', uncachedPhones.length, 'uncached from backend API');

        const response = await userApi.checkRegisteredUsers(uncachedPhones);
        const registeredUsers = response?.data?.registered || [];
        console.log('[CreateGroup] Found', registeredUsers.length, 'registered users from backend');

        const registeredPhones = new Set<string>();
        const userProfileMap: { [key: string]: any } = {};

        // Build cache entries
        const cacheEntries: Array<{ phoneNumber: string; isRegistered: boolean; userProfile?: any }> = [];

        registeredUsers.forEach(registeredUser => {
          const normalizedPhone = normalizePhoneNumber(registeredUser.phoneNumber);
          const userProfile = {
            id: registeredUser.userId,
            name: registeredUser.name,
            phoneNumber: registeredUser.phoneNumber,
            email: registeredUser.email,
            profileImage: registeredUser.profileImage,
          };
          registeredPhones.add(normalizedPhone);
          userProfileMap[normalizedPhone] = userProfile;
          cacheEntries.push({
            phoneNumber: normalizedPhone,
            isRegistered: true,
            userProfile,
          });
        });

        // Mark unregistered numbers in cache
        uncachedPhones.forEach(phone => {
          const normalized = normalizePhoneNumber(phone);
          if (!registeredPhones.has(normalized)) {
            cacheEntries.push({
              phoneNumber: normalized,
              isRegistered: false,
            });
          }
        });

        // Update cache in bulk
        await contactsCacheService.setMultiple(cacheEntries);

        // Update contacts with backend results
        allContacts.forEach(contact => {
          const primaryPhone = normalizePhoneNumber(contact.phoneNumbers?.[0]?.number || '');
          if (primaryPhone && registeredPhones.has(primaryPhone)) {
            contact.isRegistered = true;
            contact.userProfile = userProfileMap[primaryPhone];
          }
        });
      }

      // Filter out current user - check both userProfile (from backend) and cached data
      const currentUserPhone = user?.phoneNumber ? normalizePhoneNumber(user.phoneNumber) : null;
      const finalContacts = allContacts.filter(contact => {
        const primaryPhone = normalizePhoneNumber(contact.phoneNumbers?.[0]?.number || '');

        // Check if this is the current user's phone number
        if (currentUserPhone && primaryPhone === currentUserPhone) {
          return false;
        }

        // Check if userProfile matches current user
        if (contact.userProfile?.id === user?.id) {
          return false;
        }

        // Check cached data
        const cached = contactsCacheService.get(primaryPhone);
        if (cached?.userProfile?.id === user?.id) {
          return false;
        }

        return true;
      });

      // Sort: registered first
      const sortedContacts = finalContacts.sort((a, b) => {
        if (a.isRegistered && !b.isRegistered) return -1;
        if (!a.isRegistered && b.isRegistered) return 1;
        return 0;
      });

      console.log('[CreateGroup] Final:', sortedContacts.length, 'contacts,', sortedContacts.filter(c => c.isRegistered).length, 'registered');
      setFilteredContacts(sortedContacts);
    } catch (error) {
      console.error('[CreateGroup] Error processing contacts:', error);

      // Fallback: show all contacts without registration status
      const basicContacts: FilteredContact[] = contactsList
        .filter(contact => contact.phoneNumbers?.length > 0)
        .map(contact => ({
          ...contact,
          isRegistered: false,
          userProfile: undefined,
        }));

      setFilteredContacts(basicContacts);
    }
  };



  const handleInputChange = (field: keyof GroupData, value: string) => {
    setGroupData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectMember = (contact: FilteredContact) => {
    // Only allow adding registered members to group
    if (!contact.isRegistered) {
      return;
    }

    const isSelected = selectedMembers.find(member => member.recordID === contact.recordID);

    if (isSelected) {
      setSelectedMembers(prev => prev.filter(member => member.recordID !== contact.recordID));
    } else {
      setSelectedMembers(prev => [...prev, contact]);
    }
  };

  const handleInviteContact = async (contact: FilteredContact) => {
    try {
      const contactName = contact.displayName || 'Friend';
      const phoneNumber = contact.phoneNumbers?.[0]?.number;

      if (!phoneNumber) {
        Alert.alert('Error', 'No phone number found for this contact.');
        return;
      }

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const formattedPhone = `+91${normalizedPhone}`;

      // Create invite in backend
      const inviteResponse = await inviteApi.createInvite({
        phoneNumbers: [formattedPhone],
        context: {
          message: `Invited from Create Group screen`,
        },
      });

      if (inviteResponse.success && inviteResponse.data?.invites?.length > 0) {
        const invite = inviteResponse.data.invites[0];

        // Use the invite message from backend or create default
        const inviteMessage = invite.shareMessage ||
          `Hi ${contactName}! 👋\n\nI'm using KharchaSplit to split expenses with friends and family. It's super easy to track shared costs and settle payments!\n\n🎁 Join using my referral code: ${user?.referralCode || user?.id || 'KHARCHASPLIT'}\n\nDownload KharchaSplit now:\n📱 Android: https://play.google.com/store/apps/details?id=com.kharchasplit\n🍎 iOS: https://apps.apple.com/app/kharchasplit\n\nLet's split smarter together! 💰`;

        // Share the invitation
        await Share.share({
          message: inviteMessage,
          title: 'Join KharchaSplit with my referral code!',
        });

        console.log('[CreateGroup] Invite created and shared:', invite.inviteCode);
      } else {
        throw new Error('Failed to create invite');
      }
    } catch (error: any) {
      console.error('[CreateGroup] Error sending invite:', error);
      Alert.alert('Error', error.message || 'Failed to share invitation. Please try again.');
    }
  };

  const openImagePicker = () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1000,
      maxHeight: 1000,
      includeBase64: true, // This will include base64 in the response
    };

    launchImageLibrary(options, response => {
      if (response.didCancel) {
      } else if (response.errorMessage) {
        Alert.alert('Error', 'Failed to select image');
      } else if (response.assets && response.assets[0]) {
        const asset: Asset = response.assets[0];
        if (asset.uri && asset.base64) {
          const base64Image = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
          setGroupData(prev => ({
            ...prev,
            coverImage: asset.uri || null,
            coverImageBase64: base64Image,
          }));
        }
      }
    });
  };

  const handleSave = async () => {
    if (!groupData.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Validate that at least one member is added
    if (selectedMembers.length === 0) {
      Alert.alert('Members Required', 'Please add at least one member to the group');
      return;
    }

    try {
      setLoading(true);

      // Extract phone numbers from selected contacts
      const memberPhoneNumbers: string[] = [];
      selectedMembers.forEach(contact => {
        if (contact.userProfile) {
          // Use the phone number from backend user profile for accuracy
          memberPhoneNumbers.push(contact.userProfile.phoneNumber);
        } else if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          // Fallback to normalized phone number from contact
          const normalizedPhone = normalizePhoneNumber(contact.phoneNumbers?.[0]?.number || '');
          if (normalizedPhone.length >= 10) {
            memberPhoneNumbers.push(normalizedPhone);
          }
        }
      });

      // Prepare group data
      const groupName = groupData.name.trim();
      const groupDescription = groupData.description.trim() || undefined;
      const coverImageBase64 = groupData.coverImageBase64 || undefined;

      let newGroup: any;

      // Try PostgreSQL backend first
      try {
        console.log('Creating group in PostgreSQL backend...');

        // Format members for PostgreSQL API
        const members = selectedMembers.map(contact => ({
          userId: contact.userProfile?.id || contact.recordID,
          name: contact.userProfile?.name || contact.displayName || contact.givenName || 'Unknown',
          phoneNumber: contact.userProfile?.phoneNumber ||
                       (contact.phoneNumbers && contact.phoneNumbers.length > 0
                         ? normalizePhoneNumber(contact.phoneNumbers?.[0]?.number || '')
                         : undefined),
          email: contact.userProfile?.email ||
                 (contact.emailAddresses && contact.emailAddresses.length > 0
                   ? contact.emailAddresses?.[0]?.email
                   : undefined),
        }));

        const response = await groupApi.createGroup({
          name: groupName,
          description: groupDescription,
          coverImageBase64,
          currency: groupData.currency,
          members,
        });

        if (response.success) {
          newGroup = response.data;
          console.log('Group created successfully in PostgreSQL:', newGroup.id);
        }
      } catch (backendError: any) {
        console.error('PostgreSQL backend error:', backendError.message);
        throw new Error('Failed to create group in backend. Please try again.');

        // COMMENTED OUT: Firebase fallback - No longer using Firebase
        // console.log('PostgreSQL backend error, falling back to Firebase:', backendError.message);
        //
        // // Fallback to Firebase
        // const createGroupData: CreateGroup = {
        //   name: groupName,
        //   description: groupDescription,
        //   coverImageBase64,
        //   memberPhoneNumbers,
        //   currency: groupData.currency,
        // };
        //
        // newGroup = await firebaseService.createGroup(createGroupData, user.id);
        // console.log('Group created successfully in Firebase:', newGroup.id);
      }

      // Clear base64 image from memory after successful upload
      setGroupData(prev => ({
        ...prev,
        coverImageBase64: null,
      }));

      Alert.alert(
        'Success',
        `Group "${newGroup.name}" created successfully with ${newGroup.members?.length || selectedMembers.length} member(s)!`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSave) onSave(newGroup, prefillExpense);
              if (onClose) onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts based on search query (all contacts - registered and unregistered)
  const searchFilteredContacts = (() => {
    const filtered = filteredContacts.filter(contact => {
      // If no search query, show all contacts
      if (!searchQuery.trim()) {
        return true;
      }

      const searchLower = searchQuery.toLowerCase().trim();

      // Search by display name (combined first + last name)
      const displayName = (contact.userProfile?.name || contact.displayName || '').toLowerCase();
      if (displayName.includes(searchLower)) {
        return true;
      }

      // Search by given name
      if (contact.givenName?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search by family name
      if (contact.familyName?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search by phone number (digits only for better matching)
      if (contact.phoneNumbers?.some(phone => {
        const phoneDigits = phone.number.replace(/\D/g, '');
        const queryDigits = searchQuery.replace(/\D/g, '');
        if (queryDigits && phoneDigits.includes(queryDigits)) {
          return true;
        }
        // Also try matching formatted phone
        if (phone.number.includes(searchLower)) {
          return true;
        }
        return false;
      })) {
        return true;
      }

      return false;
    });

    // If phone search result exists and has 10 digits, add it to the top
    if (phoneSearchResult && searchQuery.replace(/\D/g, '').length === 10) {
      // Check if already in filtered list
      const alreadyExists = filtered.some(c => c.recordID === phoneSearchResult.recordID);
      if (!alreadyExists) {
        return [phoneSearchResult, ...filtered];
      }
    }

    return filtered;
  })();

  const styles = createStyles(colors);
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Group</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover Image Upload */}
        <View style={styles.coverImageSection}>
          <TouchableOpacity style={styles.coverImageContainer} onPress={openImagePicker}>
            {groupData.coverImageBase64 ? (
              <Image source={{ uri: ensureDataUri(groupData.coverImageBase64) || '' }} style={styles.coverImage} />
            ) : (
              <>
                <View style={styles.uploadIcon}>
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.uploadText}>Upload cover image</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Group Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={groupData.name}
            onChangeText={value => handleInputChange('name', value)}
            placeholder="Trip to Busan 🚗"
            placeholderTextColor={colors.secondaryText}
          />
        </View>

        {/* Group Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Group Description</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={groupData.description}
            onChangeText={value => handleInputChange('description', value)}
            placeholder="Add short description"
            placeholderTextColor={colors.secondaryText}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Currency Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Currency</Text>
          <TouchableOpacity
            style={styles.currencySelector}
            onPress={() => setShowCurrencyPicker(true)}
          >
            <View style={styles.currencyDisplay}>
              <Text style={styles.currencySymbol}>
                {CURRENCIES.find(c => c.code === groupData.currency)?.symbol || '₹'}
              </Text>
              <Text style={styles.currencyText}>
                {groupData.currency} - {CURRENCIES.find(c => c.code === groupData.currency)?.name || 'Indian Rupee'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          <Text style={styles.helperText}>
            All expenses in this group will be in this currency
          </Text>
        </View>

        {/* Number of Members */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Members (Optional)</Text>
          <TextInput
            style={styles.input}
            value={groupData.numberOfMembers}
            onChangeText={value => {
              // Only allow numbers
              const numericValue = value.replace(/[^0-9]/g, '');
              handleInputChange('numberOfMembers', numericValue);
            }}
            placeholder="e.g., 4"
            placeholderTextColor={colors.secondaryText}
            keyboardType="numeric"
            maxLength={3}
          />
          <Text style={styles.helperText}>
            This helps you plan how many people you'll split expenses with
          </Text>
        </View>

        {/* Add Members Section */}
        <View style={styles.membersSection}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>
              Add Members {selectedMembers.length > 0 && `(${selectedMembers.length} selected)`}
            </Text>
            {permissionState.status === 'granted' && (
              <TouchableOpacity
                onPress={handleRefreshContacts}
                disabled={refreshing || contactsLoading}
                style={styles.refreshButton}
              >
                <Ionicons
                  name="refresh"
                  size={20}
                  color={refreshing || contactsLoading ? colors.secondaryText : colors.primaryButton}
                />
              </TouchableOpacity>
            )}
          </View>

          {permissionState.status === 'granted' && (
            <Text style={styles.sectionSubtitle}>
              {groupData.numberOfMembers && parseInt(groupData.numberOfMembers) > 0 ? (
                selectedMembers.length >= parseInt(groupData.numberOfMembers) ? (
                  `✓ You've added ${selectedMembers.length}/${groupData.numberOfMembers} members`
                ) : (
                  `Add ${parseInt(groupData.numberOfMembers) - selectedMembers.length} more to reach your planned ${groupData.numberOfMembers} members`
                )
              ) : filteredContacts.length > 0 ? (
                `${filteredContacts.filter(c => c.isRegistered).length} registered • ${filteredContacts.filter(c => !c.isRegistered).length} can be invited`
              ) : (
                'Select registered contacts or invite friends to join KharchaSplit'
              )}
            </Text>
          )}

          {/* Search Bar - only show when permission is granted */}
          {permissionState.status === 'granted' && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                placeholder="Search Person or Phone Number"
                placeholderTextColor={colors.secondaryText}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="default"
              />
              {phoneSearchLoading && (
                <ActivityIndicator size="small" color={colors.primaryButton} style={{ marginLeft: 8 }} />
              )}
            </View>
          )}


          {permissionState.status === 'checking' && !permissionState.initialized ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primaryButton} />
              <Text style={styles.loadingText}>Checking permissions...</Text>
            </View>
          ) : permissionState.status === 'granted' ? (
            // Permission granted - show contacts or loading
            contactsLoading ? (
              // Skeleton loader for contacts
              <View>
                {[...Array(8)].map((_, index) => (
                  <View key={index} style={styles.skeletonContactItem}>
                    <Animated.View
                      style={[
                        styles.skeletonAvatar,
                        {
                          opacity: shimmerAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 0.7],
                          }),
                        },
                      ]}
                    />
                    <View style={styles.skeletonContent}>
                      <Animated.View
                        style={[
                          styles.skeletonName,
                          {
                            opacity: shimmerAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 0.7],
                            }),
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.skeletonPhone,
                          {
                            opacity: shimmerAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 0.7],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <Animated.View
                      style={[
                        styles.skeletonButton,
                        {
                          opacity: shimmerAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 0.7],
                          }),
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            ) : searchFilteredContacts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.noContactsText}>
                  {filteredContacts.length === 0
                    ? "No contacts found"
                    : "No matching contacts"}
                </Text>
                <Text style={styles.noContactsSubtext}>
                  {filteredContacts.length === 0
                    ? "Make sure you have contacts with phone numbers"
                    : "Try a different search term"}
                </Text>
              </View>
            ) : (
              searchFilteredContacts.map(contact => {
                const displayName = contact.userProfile?.name || contact.displayName || 'Unknown';
                // Get initials from first and last name parts
                const nameParts = displayName.trim().split(' ').filter(Boolean);
                const initials = nameParts.length >= 2
                  ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
                  : displayName.charAt(0).toUpperCase() || '?';
                return (
                <View key={contact.recordID} style={styles.contactItem}>
                  <View style={styles.contactInfo}>
                    {contact.thumbnailPath ? (
                      <Image source={{ uri: contact.thumbnailPath }} style={styles.contactImage} />
                    ) : (
                      <View style={styles.contactImagePlaceholder}>
                        <Text style={styles.contactImagePlaceholderText}>
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View style={styles.contactDetails}>
                      <Text style={styles.contactName}>
                        {displayName}
                      </Text>
                      {contact.phoneNumbers && contact.phoneNumbers?.[0] && (
                        <Text style={styles.contactPhone}>
                          {formatPhoneForDisplay(contact.phoneNumbers?.[0]?.number || '')}
                        </Text>
                      )}
                      {contact.isRegistered && (
                        <View style={styles.registeredBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.primaryButton} />
                          <Text style={styles.registeredText}>Registered</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.contactActions}>
                    {contact.isRegistered ? (
                      // Registered user - show Add/Remove button
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          selectedMembers.find(m => m.recordID === contact.recordID)
                            ? styles.removeButton
                            : styles.addButton
                        ]}
                        onPress={() => handleSelectMember(contact)}
                      >
                        <Ionicons
                          name={selectedMembers.find(m => m.recordID === contact.recordID) ? "checkmark" : "add"}
                          size={16}
                          color="white"
                        />
                        <Text style={styles.actionButtonText}>
                          {selectedMembers.find(m => m.recordID === contact.recordID) ? 'Added' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      // Unregistered user - show Invite button
                      <TouchableOpacity
                        style={[styles.actionButton, styles.inviteButton]}
                        onPress={() => handleInviteContact(contact)}
                      >
                        <Ionicons name="share-outline" size={16} color="white" />
                        <Text style={styles.actionButtonText}>Invite</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
              })
            )
          ) : (
            // Permission not granted - show permission UI
            <View style={styles.permissionContainer}>
              {permissionState.status === 'denied' && !permissionState.hasRequested ? (
                <>
                  <Ionicons name="contacts" size={48} color={colors.secondaryText} />
                  <Text style={styles.permissionTitle}>Access Your Contacts</Text>
                  <Text style={styles.permissionMessage}>
                    Find friends who are already using KharchaSplit and add them to your group easily.
                  </Text>
                  <TouchableOpacity
                    style={[styles.permissionButton, contactsLoading && styles.saveButtonDisabled]}
                    onPress={handleRequestContacts}
                    disabled={contactsLoading}
                  >
                    {contactsLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.permissionButtonText}>Allow Access</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : permissionState.status === 'denied' && permissionState.hasRequested ? (
                <>
                  <Ionicons name="contacts" size={48} color={colors.secondaryText} />
                  <Text style={styles.permissionTitle}>Contacts Access Denied</Text>
                  <Text style={styles.permissionMessage}>
                    You can still create groups, but you'll need to add members manually using phone numbers.
                  </Text>
                  <TouchableOpacity style={styles.permissionButton} onPress={handleRequestContacts}>
                    <Text style={styles.permissionButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </>
              ) : permissionState.status === 'blocked' ? (
                <>
                  <Ionicons name="settings" size={48} color={colors.secondaryText} />
                  <Text style={styles.permissionTitle}>Enable in Settings</Text>
                  <Text style={styles.permissionMessage}>
                    Contacts access is blocked. Please enable it in your device settings to add members from contacts.
                  </Text>
                  <TouchableOpacity style={styles.permissionButton} onPress={() => openSettings()}>
                    <Text style={styles.permissionButtonText}>Open Settings</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle" size={48} color={colors.secondaryText} />
                  <Text style={styles.permissionTitle}>Contacts Unavailable</Text>
                  <Text style={styles.permissionMessage}>
                    Contacts are not available on this device. You can still create groups without selecting from contacts.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

      </ScrollView>

      {/* Fixed Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Create Group</Text>}
      </TouchableOpacity>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyPicker(false)}
        >
          <View style={styles.currencyPickerContainer}>
            <View style={styles.currencyPickerHeader}>
              <Text style={styles.currencyPickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                <Ionicons name="close" size={24} color={colors.primaryText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CURRENCIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyItem,
                    groupData.currency === item.code && styles.currencyItemSelected
                  ]}
                  onPress={() => {
                    handleInputChange('currency', item.code);
                    setShowCurrencyPicker(false);
                  }}
                >
                  <View style={styles.currencyItemContent}>
                    <Text style={styles.currencyItemSymbol}>{item.symbol}</Text>
                    <View style={styles.currencyItemDetails}>
                      <Text style={styles.currencyItemCode}>{item.code}</Text>
                      <Text style={styles.currencyItemName}>{item.name}</Text>
                    </View>
                  </View>
                  {groupData.currency === item.code && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryButton} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 100 }, // Add padding to prevent content from being hidden behind fixed button
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
    backButton: { padding: 8, borderRadius: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.primaryText },
    placeholder: { width: 40 },
    scrollView: { flex: 1 },
    coverImageSection: { alignItems: 'center', paddingVertical: 32 },
    coverImageContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondaryText,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    uploadText: { fontSize: 14, color: colors.secondaryText, textAlign: 'center' },
    coverImage: { width: 120, height: 120, borderRadius: 60 },
    inputGroup: { paddingHorizontal: 16, marginBottom: 20 },
    label: { fontSize: 14, color: colors.secondaryText, marginBottom: 8, fontWeight: '500' },
    input: {
      borderWidth: 1,
      borderColor: colors.cardBackground,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.primaryText,
      backgroundColor: colors.cardBackground,
    },
    descriptionInput: { height: 100, textAlignVertical: 'top' },
    helperText: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 6,
      fontStyle: 'italic',
    },
    membersSection: { paddingHorizontal: 16, marginBottom: 24 },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.primaryText, flex: 1 },
    refreshButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      marginLeft: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
      marginBottom: 16,
      lineHeight: 18,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 25,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
    },
    searchInput: { flex: 1, fontSize: 16, color: colors.primaryText, marginLeft: 8 },
    searchIcon: { marginRight: 8 },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground,
    },
    contactInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    contactImagePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryButton + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactImagePlaceholderText: {
      color: colors.primaryButton,
      fontWeight: 'bold',
      fontSize: 18,
    },
    contactDetails: {
      flex: 1,
      marginLeft: 12,
    },
    contactName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
      marginBottom: 4,
    },
    contactPhone: {
      fontSize: 14,
      color: colors.secondaryText,
      marginBottom: 4,
    },
    registeredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    registeredText: {
      fontSize: 12,
      color: colors.primaryButton,
      marginLeft: 4,
      fontWeight: '500',
    },
    contactActions: {
      marginLeft: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      minWidth: 70,
      justifyContent: 'center',
    },
    addButton: {
      backgroundColor: colors.success,
    },
    removeButton: {
      backgroundColor: colors.secondaryText,
    },
    inviteButton: {
      backgroundColor: '#3B82F6', // Blue
    },
    actionButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    contactStatus: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 8,
    },
    loadingSubtext: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 4,
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    noContactsSubtext: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    permissionContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    permissionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primaryText,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    permissionMessage: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    permissionButton: {
      backgroundColor: colors.primaryButton,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 120,
    },
    permissionButtonText: {
      color: colors.primaryButtonText,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    saveButton: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.primaryButton,
      marginHorizontal: 16,
      marginBottom: 34, // Safe area padding for bottom
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 8,
    },
    saveButtonText: { color: colors.primaryButtonText, fontSize: 16, fontWeight: '600' },
    saveButtonDisabled: { opacity: 0.6 },
    permissionText: { textAlign: 'center', color: colors.secondaryText, marginTop: 16 },
    noContactsText: { textAlign: 'center', color: colors.secondaryText, marginTop: 16 },
    // Skeleton loader styles
    skeletonContactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground,
    },
    skeletonAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      marginRight: 12,
    },
    skeletonContent: {
      flex: 1,
    },
    skeletonName: {
      height: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 4,
      marginBottom: 8,
      width: '70%',
    },
    skeletonPhone: {
      height: 14,
      backgroundColor: colors.cardBackground,
      borderRadius: 4,
      width: '50%',
    },
    skeletonButton: {
      width: 70,
      height: 32,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      marginLeft: 12,
    },
    // Currency selector styles
    currencySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.cardBackground,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.cardBackground,
    },
    currencyDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    currencySymbol: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.primaryButton,
      marginRight: 12,
      width: 30,
      textAlign: 'center',
    },
    currencyText: {
      fontSize: 16,
      color: colors.primaryText,
    },
    // Currency picker modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    currencyPickerContainer: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 34,
    },
    currencyPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    currencyPickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primaryText,
    },
    currencyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    currencyItemSelected: {
      backgroundColor: colors.primaryButton + '10',
    },
    currencyItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    currencyItemSymbol: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.primaryButton,
      width: 40,
      textAlign: 'center',
    },
    currencyItemDetails: {
      marginLeft: 12,
    },
    currencyItemCode: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
    },
    currencyItemName: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 2,
    },
  });
