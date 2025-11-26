import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Animated,
  Alert,
  // --- RESPONSIVE ---
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateNewGroupScreen } from './CreateNewGroupScreen';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
// import { firebaseService } from '../services/firebaseService'; // MIGRATED to PostgreSQL
import { groupApi } from '../services/api/groupApi';
import { expenseApi } from '../services/api/expenseApi';
// --- RESPONSIVE ---
// We now use this object to create scaled sizes
import { typography } from '../utils/typography';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ensureDataUri } from '../utils/imageUtils';
import { FCMTokenManager } from '../services/fcmTokenManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreenSkeleton } from '../components/SkeletonLoader';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// (Interfaces remain the same)
interface GroupDetail {
  text: string;
  amount: number;
  type: 'owe' | 'owed';
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  coverImageUrl?: string | null;
  youOwe: number;
  youAreOwed: number;
  details: GroupDetail[];
  moreBalances?: number | null;
  members?: any[];
  createdAt?: any;
  totalExpenses?: number;
}

interface OverallBalance {
  netBalance: number;
  totalYouOwe: number;
  totalYouAreOwed: number;
  groupBalanceDetails: any[];
}

interface PrefillExpenseData {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  receiptBase64?: string;
}

interface HomeScreenProps {
  navigation: any;
  route?: {
    params?: {
      openCreateGroup?: boolean;
      prefillExpense?: PrefillExpenseData;
    };
  };
}

// Helper function to calculate user's balance in a specific group
const calculateUserGroupBalance = (expenses: any[], userId: string, members: any[]) => {
  let netBalance = 0;
  const details: GroupDetail[] = [];
  const memberBalances: { [key: string]: number } = {};

  // Initialize member balances
  members.forEach(member => {
    memberBalances[member.userId] = 0;
  });

  // Process each expense
  expenses.forEach(expense => {
    // Handle both nested paidBy object and flat paidById field
    // Backend returns snake_case: paid_by_id, so check all formats
    const payerId = expense.paid_by_id || expense.paidBy?.id || expense.paidById || expense.paidBy || '';
    if (!payerId) return; // Skip if no payer info

    (expense.participants || []).forEach((participant: any) => {
      // Backend returns user_id (snake_case), so check all formats
      const participantId = participant?.user_id || participant?.userId || participant?.id || '';
      const participantAmount = Number(participant?.amount || 0);

      if (participantId && participantId !== payerId) {
        // Participant owes payer
        memberBalances[participantId] -= participantAmount;
        memberBalances[payerId] += participantAmount;
      }
    });
  });

  // Calculate net balance for current user
  netBalance = memberBalances[userId] || 0;

  // Generate balance details for current user
  members.forEach(member => {
    if (member.userId !== userId) {
      const memberBalance = memberBalances[member.userId] || 0;
      const userBalance = memberBalances[userId] || 0;
      
      // If user owes this member
      if (userBalance < 0 && memberBalance > 0) {
        const amount = Math.min(Math.abs(userBalance), memberBalance);
        if (amount > 0.01) {
          details.push({
            text: `you owe ${member.name}`,
            amount: amount,
            type: 'owe'
          });
        }
      }
      
      // If this member owes user
      if (userBalance > 0 && memberBalance < 0) {
        const amount = Math.min(userBalance, Math.abs(memberBalance));
        if (amount > 0.01) {
          details.push({
            text: `${member.name} owes you`,
            amount: amount,
            type: 'owed'
          });
        }
      }
    }
  });

  return { netBalance, details };
};


export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  // --- STATUS BAR FIX ---
  // Assuming your theme context provides an isDarkMode boolean
  // If it provides a string like `mode`, you can do:
  // const { colors, mode } = useTheme();
  // const isDarkMode = mode === 'dark';
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Animation for content fade in
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  // --- END FIX ---

  // --- RESPONSIVE ---
  // Get screen width
  const { width: screenWidth } = useWindowDimensions();

  // Define base width and scaling function
  const baseWidth = 375;
  const scale = (size: number) => (screenWidth / baseWidth) * size;

  // Calculate safe bottom padding for content
  const getContentBottomPadding = () => {
    // Base tab bar height + safe area bottom + extra padding
    const baseTabBarHeight = 64;
    const safeTabBarSpace = baseTabBarHeight + insets.bottom + scale(20);
    return safeTabBarSpace;
  };

  // Calculate floating button position for iOS and Android
  const getFloatingButtonBottom = () => {
    // For iOS, use a fixed lower position to match Android
    const bottomSpace = insets.bottom || 0;
    return bottomSpace + scale(16); // Very close to tab bar
  };

  // Create an object of scaled font sizes using the imported typography file
  const scaledFontSize = {
    lg: scale(typography.fontSize.lg),
    '2xl': scale(typography.fontSize['2xl']),
    headerLarge: scale(typography.text.headerLarge.fontSize),
    header: scale(typography.text.header.fontSize),
    title: scale(typography.text.title.fontSize),
    subtitle: scale(typography.text.subtitle.fontSize),
    body: scale(typography.text.body.fontSize),
    caption: scale(typography.text.caption.fontSize),
  };
  // --- END RESPONSIVE ---

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [overallBalance, setOverallBalance] = useState<OverallBalance>({
    netBalance: 0,
    totalYouOwe: 0,
    totalYouAreOwed: 0,
    groupBalanceDetails: [],
  });
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Store prefill expense data when coming from scan flow
  const [pendingPrefillExpense, setPendingPrefillExpense] = useState<PrefillExpenseData | undefined>(undefined);
  // Personal Expenses moved to bottom tab - removed from HomeScreen

  // Handle route params for opening create group modal with prefilled expense
  useEffect(() => {
    if (route?.params?.openCreateGroup) {
      setPendingPrefillExpense(route.params.prefillExpense);
      setShowCreateGroup(true);
      // Clear the params to prevent re-triggering
      navigation.setParams({ openCreateGroup: undefined, prefillExpense: undefined });
    }
  }, [route?.params?.openCreateGroup, route?.params?.prefillExpense]);

  const loadGroupsFromFirebase = async () => {
    if (!user) {
      // Set initial loading to false even when no user
      if (initialLoading) {
        setInitialLoading(false);
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
      return;
    }

    try {
      setGroupsLoading(true);

      // Load groups from PostgreSQL API
      console.log('[HomeScreen] Loading groups from PostgreSQL API...');
      const response = await groupApi.getUserGroups(user.id);
      const userGroups = response.data;
      console.log(`[HomeScreen] Loaded ${userGroups.length} groups`);

      // Convert API groups to UI format with placeholder balances
      const convertedGroups: Group[] = userGroups.map((group) => {
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          avatar: group.coverImageBase64 ? null : '🎭',
          coverImageUrl: group.coverImageBase64 || null,
          youOwe: 0,
          youAreOwed: 0,
          details: [],
          moreBalances: 0,
          members: group.members,
          createdAt: group.createdAt,
          totalExpenses: group.totalExpenses || 0,
        };
      });

      setGroups(convertedGroups);

      // Load expenses and calculate balances in background
      loadGroupBalancesInBackground(userGroups);

      // Calculate overall balance (will update after expenses are loaded)
      calculateOverallBalance(convertedGroups);
    } catch (error: any) {
      console.error('[HomeScreen] Error loading groups:', error);

      // Keep existing groups on error - don't clear the state
      if (error.response?.status === 401) {
        // Unauthorized - token might be expired
        console.error('[HomeScreen] Unauthorized - please login again');
      }
    } finally {
      setGroupsLoading(false);
    }
  };

  // Background loading of group balances (non-blocking)
  const loadGroupBalancesInBackground = async (userGroups: any[]) => {
    if (!user) return;

    console.log(`[HomeScreen] Loading balances for ${userGroups.length} groups in background...`);

    try {
      // Load expenses for all groups in parallel
      const balancePromises = userGroups.map(async (group, index) => {
        try {
          // Load expenses from PostgreSQL API
          const expenseResponse = await expenseApi.getGroupExpenses(group.id);
          const apiExpenses = expenseResponse.data || [];

          // Pass API expenses directly - calculateUserGroupBalance handles snake_case fields
          // Backend returns: paid_by_id, paid_by_name, participants with user_id
          const balance = calculateUserGroupBalance(apiExpenses, user.id, group.members);

          // Update the specific group in the state
          setGroups(prevGroups => {
            const updatedGroups = [...prevGroups];
            if (updatedGroups[index]) {
              updatedGroups[index] = {
                ...updatedGroups[index],
                youOwe: parseFloat(Math.max(0, -balance.netBalance).toFixed(2)),
                youAreOwed: parseFloat(Math.max(0, balance.netBalance).toFixed(2)),
                details: balance.details,
                moreBalances: balance.details.length > 3 ? balance.details.length - 3 : 0,
                totalExpenses: apiExpenses.length, // Update with actual expense count
              };
            }
            return updatedGroups;
          });

          return balance;
        } catch (error) {
          return null;
        }
      });

      // Wait for all balances to load
      await Promise.all(balancePromises);

      // Recalculate overall balance after all groups are loaded
      setGroups(prevGroups => {
        calculateOverallBalance(prevGroups);
        return prevGroups;
      });
    } catch (error) {
      console.error('Error loading group balances:', error);
    }
  };

  const calculateOverallBalance = (groups: Group[]) => {
    let totalYouOwe = 0;
    let totalYouAreOwed = 0;
    const groupBalanceDetails: any[] = [];

    groups.forEach(group => {
      totalYouOwe += group.youOwe;
      totalYouAreOwed += group.youAreOwed;
      
      // Add group balance details
      if (group.youOwe > 0 || group.youAreOwed > 0) {
        groupBalanceDetails.push({
          groupName: group.name,
          groupId: group.id,
          youOwe: group.youOwe,
          youAreOwed: group.youAreOwed,
          netBalance: group.youAreOwed - group.youOwe,
          details: group.details
        });
      }
    });

    const netBalance = totalYouAreOwed - totalYouOwe;

    // Format to 2 decimal places to prevent multiple decimal issues
    setOverallBalance({
      netBalance: parseFloat(netBalance.toFixed(2)),
      totalYouOwe: parseFloat(totalYouOwe.toFixed(2)),
      totalYouAreOwed: parseFloat(totalYouAreOwed.toFixed(2)),
      groupBalanceDetails
    });
  };

  const loadGroupsAndBalance = async () => {
    setBalanceLoading(true);

    // Load groups from PostgreSQL API
    await loadGroupsFromFirebase();

    setBalanceLoading(false);

    // Set initial loading to false after first load and animate content in
    if (initialLoading) {
      setInitialLoading(false);
      // Fade in content after skeleton disappears
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    // Only load data if user is available
    console.log(`[HomeScreen] useEffect triggered - user?.id: ${user?.id}`);
    if (user?.id) {
      loadGroupsAndBalance();
    } else {
      // If no user, still show skeleton briefly then show empty state
      setTimeout(() => {
        if (initialLoading) {
          setInitialLoading(false);
          Animated.timing(contentFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      }, 1000);
    }
    
    // Auto-refresh FCM token if user doesn't have one
    const autoRefreshFCMToken = async () => {
      if (!user?.id) return;
      
      try {
        // Check if user has FCM token in Firebase
        const hasToken = await FCMTokenManager.checkUserToken(user.id);
        
        if (!hasToken) {
          await FCMTokenManager.getAndSaveToken(user.id);
        }
      } catch (error) {
        // Silently handle FCM token initialization errors
      }
    };
    
    // Delay token refresh to not interfere with screen loading
    setTimeout(autoRefreshFCMToken, 2000);
  }, [user?.id]);

  // Track if we navigated away to a detail screen
  const hasNavigatedAway = useRef(false);

  // Refresh data when screen comes into focus ONLY if we navigated away
  // This prevents unnecessary API calls on tab switches while still refreshing
  // when returning from GroupDetail, AddExpense, etc.
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we actually navigated away and came back
      if (hasNavigatedAway.current && !initialLoading && user?.id) {
        console.log('[HomeScreen] Returned from detail screen - refreshing data');
        loadGroupsAndBalance();
        hasNavigatedAway.current = false;
      }

      // Cleanup: mark that we're navigating away when screen loses focus
      return () => {
        hasNavigatedAway.current = true;
      };
    }, [initialLoading, user?.id])
  );

  const handleAddGroup = () => setShowCreateGroup(true);
  const handleCloseCreateGroup = () => setShowCreateGroup(false);

  const handleSaveNewGroup = (newGroup: any, prefillExpense?: PrefillExpenseData) => {
    // Convert Firebase group to legacy format for display
    const transformedGroup: Group = {
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description,
      avatar: newGroup.coverImageBase64 ? null : '🎭',
      coverImageUrl: newGroup.coverImageBase64 || null,
      youOwe: 0,
      youAreOwed: 0,
      details: [],
      members: newGroup.members || [],
      createdAt: newGroup.createdAt,
      totalExpenses: newGroup.totalExpenses,
    };

    // Add to groups
    setGroups(prev => [transformedGroup, ...prev]);
    setShowCreateGroup(false);

    // Clear pending prefill expense
    setPendingPrefillExpense(undefined);

    // If there's a prefilled expense from scan flow, navigate to AddExpense
    if (prefillExpense) {
      // Small delay to allow modal to close
      setTimeout(() => {
        navigation.navigate('AddExpense', {
          group: transformedGroup,
          prefillData: {
            description: prefillExpense.description,
            amount: prefillExpense.amount,
            currency: prefillExpense.currency,
            category: prefillExpense.category,
            date: prefillExpense.date,
            notes: prefillExpense.notes,
            receiptBase64: prefillExpense.receiptBase64,
          },
        });
      }, 300);
    }
  };

  const handleSearch = () => {
    setShowSearchBar(!showSearchBar);
    if (showSearchBar) setSearchQuery('');
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!user) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use PostgreSQL backend
              console.log('Deleting group from PostgreSQL backend...');
              const response = await groupApi.deleteGroup(groupId);

              if (response.success) {
                console.log('Group deleted successfully from PostgreSQL');

                // Remove from local state
                setGroups(prev => prev.filter(g => g.id !== groupId));

                Alert.alert('Success', 'Group deleted successfully');
              }
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredGroups = groups.filter(
    group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.details.some(detail =>
        detail.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  // Handle archive group
  const handleArchiveGroup = async (group: Group) => {
    try {
      // Move group to archived list
      setArchivedGroups(prev => [...prev, group]);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      Alert.alert('Success', `${group.name} archived successfully`);
    } catch (error) {
      console.error('Error archiving group:', error);
      Alert.alert('Error', 'Failed to archive group. Please try again.');
    }
  };

  // Render right swipe actions (archive and delete buttons)
  const renderRightActions = (group: Group) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={styles.archiveAction}
          onPress={() => handleArchiveGroup(group)}
        >
          <Ionicons name="archive-outline" size={scale(24)} color="#FFFFFF" />
          <Text style={styles.actionText}>Archive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDeleteGroup(group.id, group.name)}
        >
          <Ionicons name="trash-outline" size={scale(24)} color="#FFFFFF" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroupsAndBalance();
    setRefreshing(false);
  };

  // --- RESPONSIVE ---
  // createStyles is now called with the scale function and fonts object
  const styles = createStyles(colors, scale, scaledFontSize);

  // --- STATUS BAR FIX ---
  // Use dynamic status bar style from theme colors
  // --- END FIX ---

  // Show skeleton loader during initial loading
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.statusBarBackground} />
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
       {/* --- STATUS BAR FIX --- */}
       {/* Use dynamic status bar style from theme colors */}
       <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.statusBarBackground} />
       {/* --- END FIX --- */}
       
      <Animated.View style={[{ flex: 1 }, { opacity: contentFadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
        <Text style={styles.headerTitle}>My Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleSearch}>
            <MaterialIcons
              name={showSearchBar ? 'close' : 'search'}
              size={scaledFontSize.lg}
              color={colors.primaryText}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowHeaderMenu(!showHeaderMenu)}
          >
            <MaterialIcons
              name="more-vert"
              size={scaledFontSize.lg}
              color={colors.primaryText}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Dropdown Menu */}
      {showHeaderMenu && (
        <>
          <TouchableOpacity
            style={styles.headerMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowHeaderMenu(false)}
          />
          <View style={styles.headerMenuContainer}>
            <TouchableOpacity
              style={styles.headerMenuItem}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowArchivedGroups(true);
              }}
            >
              <MaterialIcons
                name="archive"
                size={scale(20)}
                color={colors.primaryText}
              />
              <Text style={styles.headerMenuText}>Archived Groups</Text>
            </TouchableOpacity>
            <View style={styles.headerMenuDivider} />
            <TouchableOpacity
              style={styles.headerMenuItem}
              onPress={() => {
                setShowHeaderMenu(false);
                handleAddGroup();
              }}
            >
              <MaterialIcons
                name="group-add"
                size={scale(20)}
                color={colors.primaryText}
              />
              <Text style={styles.headerMenuText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Search Bar */}
      {showSearchBar && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search groups or members..."
            placeholderTextColor={colors.secondaryText}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              {/* --- RESPONSIVE --- Correctly uses scaled size */}
              <Text style={{ fontSize: scaledFontSize.lg }}>✖</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        // --- RESPONSIVE --- Account for tab bar height and floating button with safe area
        contentContainerStyle={{
          paddingBottom: getContentBottomPadding(), // Dynamic padding for safe tab bar space
          flexGrow: 1
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Overall Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.sectionTitle}>Overall Balance</Text>
          {balanceLoading ? (
            <ActivityIndicator color={colors.primaryButton} />
          ) : (
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Net Balance</Text>
                <Text style={styles.balanceValue}>
                  ₹{overallBalance.netBalance.toFixed(2)}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>You Owe</Text>
                <Text style={styles.balanceValue}>
                  ₹{overallBalance.totalYouOwe.toFixed(2)}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>You Are Owed</Text>
                <Text style={styles.balanceValue}>
                  ₹{overallBalance.totalYouAreOwed.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Groups List */}
        {groupsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryButton} />
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="group" size={scaledFontSize.headerLarge * 2} color={colors.secondaryText} />
            <Text style={styles.emptyText}>No groups yet</Text>
            <Text style={styles.emptySubtext}>Create your first group to start splitting expenses!</Text>
          </View>
        ) : (
          <>
            {filteredGroups.map(group => (
              <Swipeable
                key={group.id}
                renderRightActions={() => renderRightActions(group)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={styles.groupCard}
                  onPress={() => navigation.navigate('GroupDetail', { group })}
                >
                  <View style={styles.groupHeader}>
                    <View style={styles.avatarContainer}>
                      {group.coverImageUrl ? (
                        <Image source={{ uri: ensureDataUri(group.coverImageUrl) || '' }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatar}>{group.avatar}</Text>
                      )}
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      {group.description && (
                        <Text style={styles.groupDescription}>{group.description}</Text>
                      )}
                      <Text style={styles.membersCount}>{group.members?.length || 0} members</Text>
                    </View>
                  </View>
                  <View style={styles.groupDetails}>
                    {group.details.length > 0 ? (
                      group.details.map((detail, idx) => (
                        <View key={idx} style={styles.detailRow}>
                          <Text style={styles.detailText}>{detail.text}</Text>
                          <Text style={styles.detailText}>
                            {detail.type === 'owe' ? '-' : '+'}₹{Number(detail.amount || 0).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    ) : (group.totalExpenses || 0) > 0 ? (
                      <Text style={styles.settledText}>All settled up! 🎉</Text>
                    ) : (
                      <Text style={styles.noExpensesText}>No expenses yet</Text>
                    )}
                    {group.moreBalances ? (
                      <Text style={styles.moreBalances}>+ {group.moreBalances} more</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Swipeable>
            ))}
            
            {/* See All Groups Button */}
            {filteredGroups.length > 0 && (
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('AllGroups')}
              >
                <MaterialIcons
                  name="view-list"
                  size={scaledFontSize.lg}
                  color={colors.primaryButton}
                />
                <Text style={styles.seeAllButtonText}>See All Groups</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={scaledFontSize.lg}
                  color={colors.primaryButton}
                />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          { bottom: getFloatingButtonBottom() } // iOS & Android compatible positioning
        ]}
        onPress={handleAddGroup}
      >
        <MaterialIcons
          name="add"
          // --- RESPONSIVE --- Correctly uses scaled size
          size={scaledFontSize.headerLarge}
          color={colors.primaryButtonText}
        />
      </TouchableOpacity>

        {/* Create New Group Modal */}
        <Modal visible={showCreateGroup} animationType="slide" presentationStyle="pageSheet">
          <CreateNewGroupScreen onClose={handleCloseCreateGroup} onSave={handleSaveNewGroup} prefillExpense={pendingPrefillExpense} />
        </Modal>

        {/* Archived Groups Modal */}
        <Modal visible={showArchivedGroups} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right']}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Archived Groups</Text>
              <TouchableOpacity onPress={() => setShowArchivedGroups(false)}>
                <MaterialIcons name="close" size={scale(28)} color={colors.primaryText} />
              </TouchableOpacity>
            </View>

            {/* Archived Groups List */}
            <ScrollView style={styles.modalScrollView}>
              {archivedGroups.length === 0 ? (
                <View style={styles.emptyArchivedContainer}>
                  <MaterialIcons name="archive" size={scale(80)} color={colors.secondaryText} />
                  <Text style={styles.emptyArchivedText}>No Archived Groups</Text>
                  <Text style={styles.emptyArchivedSubtext}>
                    Groups you archive will appear here
                  </Text>
                </View>
              ) : (
                archivedGroups.map(group => (
                  <View key={group.id} style={styles.archivedGroupCard}>
                    <View style={styles.groupHeader}>
                      <View style={styles.avatarContainer}>
                        {group.coverImageUrl ? (
                          <Image source={{ uri: ensureDataUri(group.coverImageUrl) || '' }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.avatar}>{group.avatar}</Text>
                        )}
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        {group.description && (
                          <Text style={styles.groupDescription}>{group.description}</Text>
                        )}
                        <Text style={styles.membersCount}>{group.members?.length || 0} members</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.unarchiveButton}
                      onPress={() => {
                        setGroups(prev => [...prev, group]);
                        setArchivedGroups(prev => prev.filter(g => g.id !== group.id));
                        Alert.alert('Success', `${group.name} restored successfully`);
                      }}
                    >
                      <MaterialIcons name="unarchive" size={scale(20)} color={colors.primaryButton} />
                      <Text style={styles.unarchiveButtonText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Animated.View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
};

// --- RESPONSIVE ---
// (createStyles function remains unchanged)
const createStyles = (
  colors: ReturnType<typeof useTheme>['colors'],
  scale: (size: number) => number,
  fonts: { [key: string]: number } // The scaledFontSize object
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(16),
      paddingVertical: scale(12),
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 0,
      borderBottomColor: colors.secondaryText,
    },
    headerTitle: {
      ...typography.text.headerLarge,
      color: colors.primaryText,
      fontSize: fonts.headerLarge, // Use passed-in font
    },
    headerActions: { flexDirection: 'row' },
    headerButton: { padding: scale(8), marginLeft: scale(12) },
    headerMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    headerMenuContainer: {
      position: 'absolute',
      top: scale(60),
      right: scale(16),
      backgroundColor: colors.cardBackground,
      borderRadius: scale(12),
      paddingVertical: scale(8),
      minWidth: scale(220),
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    headerMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(16),
      paddingVertical: scale(12),
      gap: scale(12),
    },
    headerMenuText: {
      fontSize: fonts.body,
      color: colors.primaryText,
      fontWeight: '500',
    },
    headerMenuDivider: {
      height: 1,
      backgroundColor: colors.secondaryText,
      opacity: 0.2,
      marginHorizontal: scale(12),
      marginVertical: scale(4),
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      paddingHorizontal: scale(12),
      margin: scale(12),
      borderRadius: scale(12),
    },
    searchInput: {
      flex: 1,
      height: scale(40),
      color: colors.inputText,
      fontSize: fonts.body, // Use passed-in font
    },
    scrollView: {
      flex: 1,
    },
    balanceSection: {
      backgroundColor: colors.cardBackground,
      margin: scale(16),
      padding: scale(12),
      borderRadius: scale(8),
    },
    sectionTitle: {
      ...typography.text.header,
      marginBottom: scale(8),
      color: colors.primaryText,
      fontSize: fonts.header, // Use passed-in font
    },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-around' },
    balanceItem: { alignItems: 'center' },
    balanceLabel: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption, // Use passed-in font
    },
    balanceValue: {
      ...typography.text.subtitle,
      color: colors.primaryText,
      fontSize: fonts.subtitle, // Use passed-in font
    },
    groupCard: {
      backgroundColor: colors.cardBackground,
      marginHorizontal: scale(16),
      marginVertical: scale(8),
      padding: scale(12),
      borderRadius: scale(8),
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(8),
    },
    avatarContainer: {
      width: scale(50),
      height: scale(50),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    avatar: {
      fontSize: fonts['2xl'], // Use passed-in font
    },
    avatarImage: {
      width: scale(50),
      height: scale(50),
      borderRadius: scale(25),
    },
    groupInfo: {
      flex: 1,
      marginLeft: scale(12),
    },
    groupName: {
      ...typography.text.title,
      color: colors.primaryText,
      fontSize: fonts.title, // Use passed-in font
    },
    groupDescription: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption,
      marginTop: scale(2),
    },
    membersCount: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption,
      marginTop: scale(4),
    },
    groupDetails: {
      paddingLeft: scale(8),
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: scale(2),
    },
    detailText: {
      ...typography.text.caption,
      color: colors.primaryText,
      fontSize: fonts.caption, // Match "No expenses yet" font size
    },
    moreBalances: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption, // Use passed-in font
    },
    noExpensesText: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption,
      fontStyle: 'italic',
    },
    settledText: {
      ...typography.text.caption,
      color: '#10B981',
      fontSize: fonts.caption,
      fontWeight: '500',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(40),
    },
    loadingText: {
      ...typography.text.body,
      color: colors.secondaryText,
      fontSize: fonts.body,
      marginTop: scale(8),
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(60),
      paddingHorizontal: scale(40),
    },
    emptyText: {
      ...typography.text.title,
      color: colors.primaryText,
      fontSize: fonts.title,
      marginTop: scale(16),
      textAlign: 'center',
    },
    emptySubtext: {
      ...typography.text.body,
      color: colors.secondaryText,
      fontSize: fonts.body,
      marginTop: scale(8),
      textAlign: 'center',
      lineHeight: scale(20),
    },
    floatingButton: {
      position: 'absolute',
      right: scale(24),
      width: scale(60),
      height: scale(60),
      borderRadius: scale(30),
      backgroundColor: colors.primaryButton,
      justifyContent: 'center',
      alignItems: 'center',
      shadowOffset: { width: 0, height: scale(2) },
      shadowOpacity: 0.25,
      shadowRadius: scale(4),
      elevation: 5,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      marginHorizontal: scale(16),
      marginVertical: scale(12),
      paddingVertical: scale(16),
      paddingHorizontal: scale(20),
      borderRadius: scale(8),
      borderWidth: 1,
      borderColor: colors.primaryButton,
    },
    seeAllButtonText: {
      ...typography.text.body,
      color: colors.primaryButton,
      fontSize: fonts.body,
      fontWeight: '600',
      marginHorizontal: scale(8),
    },
    personalExpensesCard: {
      backgroundColor: colors.cardBackground,
      marginHorizontal: scale(16),
      marginVertical: scale(8),
      padding: scale(16),
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: colors.primaryButton + '20',
    },
    personalExpensesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    personalExpensesIcon: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      backgroundColor: colors.primaryButton,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    personalExpensesInfo: {
      flex: 1,
    },
    personalExpensesTitle: {
      ...typography.text.title,
      color: colors.primaryText,
      fontSize: fonts.title,
      fontWeight: '600',
    },
    personalExpensesSubtitle: {
      ...typography.text.caption,
      color: colors.secondaryText,
      fontSize: fonts.caption,
      marginTop: scale(2),
    },
    personalExpensesAmount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(4),
    },
    personalExpensesValue: {
      ...typography.text.subtitle,
      color: colors.primaryText,
      fontSize: fonts.subtitle,
      fontWeight: '700',
    },
    swipeActionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: scale(8),
    },
    archiveAction: {
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
      width: scale(80),
      height: '100%',
      marginRight: scale(4),
    },
    deleteAction: {
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      width: scale(80),
      height: '100%',
      marginRight: scale(16),
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: fonts.caption,
      fontWeight: '600',
      marginTop: scale(4),
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: scale(20),
      paddingVertical: scale(16),
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.secondaryText + '20',
    },
    modalTitle: {
      fontSize: fonts.headerLarge,
      fontWeight: '700',
      color: colors.primaryText,
    },
    modalScrollView: {
      flex: 1,
      paddingHorizontal: scale(16),
      paddingTop: scale(16),
    },
    emptyArchivedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(100),
    },
    emptyArchivedText: {
      fontSize: fonts.title,
      fontWeight: '600',
      color: colors.primaryText,
      marginTop: scale(16),
    },
    emptyArchivedSubtext: {
      fontSize: fonts.body,
      color: colors.secondaryText,
      marginTop: scale(8),
      textAlign: 'center',
    },
    archivedGroupCard: {
      backgroundColor: colors.cardBackground,
      marginBottom: scale(12),
      padding: scale(16),
      borderRadius: scale(12),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unarchiveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryButton + '20',
      paddingHorizontal: scale(12),
      paddingVertical: scale(8),
      borderRadius: scale(8),
      gap: scale(6),
    },
    unarchiveButtonText: {
      fontSize: fonts.body,
      fontWeight: '600',
      color: colors.primaryButton,
    },
  });