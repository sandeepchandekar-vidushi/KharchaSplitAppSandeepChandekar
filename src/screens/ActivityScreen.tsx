import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  useWindowDimensions,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firebaseService, Activity, PersonalExpense } from '../services/firebaseService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityScreenSkeleton } from '../components/SkeletonLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activityApi } from '../services/api/activityApi';
import { personalExpenseApi } from '../services/api/personalExpenseApi';

// Filter types
type ActivityFilter = 'all' | 'groups' | 'personal' | 'other';

// Extended activity type to include personal expenses
interface ExtendedActivity extends Activity {
  isPersonalExpense?: boolean;
  personalExpenseData?: PersonalExpense;
  personalExpenseId?: string; // For activities from API to verify if expense still exists
  isDeleted?: boolean; // True if the linked expense has been deleted
}

interface ActivityScreenProps {
  navigation: any;
}

export const ActivityScreen: React.FC<ActivityScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const baseWidth = 375;
  const scale = (size: number) => (screenWidth / baseWidth) * size;

  const [activities, setActivities] = useState<ExtendedActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ExtendedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Animation for content fade in
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  // Filter options
  const filterOptions: { key: ActivityFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'All Activities', icon: 'list' },
    { key: 'groups', label: 'Group Activities', icon: 'group' },
    { key: 'personal', label: 'Personal Expenses', icon: 'person' },
    { key: 'other', label: 'Other Activities', icon: 'more-horiz' },
  ];

  const loadActivities = useCallback(async () => {
    if (!user?.id) {
      // Set initial loading to false even when no user
      if (initialLoading) {
        setInitialLoading(false);
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
      setLoading(false);
      return;
    }

    try {
      // Show skeleton loader for minimum duration (for better UX)
      const minLoadingTime = new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

      // Get activities from API or Firebase
      const dataPromise = (async () => {
        let loadedActivities: ExtendedActivity[] = [];
        let personalExpenseActivities: ExtendedActivity[] = [];

        // Load group/user activities
        try {
          console.log('Loading activities from PostgreSQL backend...');
          const response = await activityApi.getUserActivities(user.id, 1, 50);

          if (response.success) {
            // Map API response to Activity format
            // Check if activity is a personal expense activity by activityType
            loadedActivities = response.data.map(act => {
              const isPersonalExpenseActivity = act.activityType === 'personal_expense_added';
              return {
                id: act.id,
                userId: act.userId,
                userName: '',
                type: act.activityType as Activity['type'],
                title: act.title,
                description: act.description,
                groupId: act.groupId,
                groupName: act.metadata?.groupName,
                expenseId: act.metadata?.expenseId,
                expenseDescription: act.metadata?.expenseDescription,
                amount: act.metadata?.amount,
                relatedUserId: act.metadata?.relatedUserId,
                relatedUserName: act.metadata?.relatedUserName,
                createdAt: act.createdAt,
                metadata: act.metadata,
                isPersonalExpense: isPersonalExpenseActivity,
                // Store the personal expense ID from entityId for later verification
                personalExpenseId: isPersonalExpenseActivity ? act.entityId : undefined,
              };
            });
            console.log(`Loaded ${loadedActivities.length} activities from PostgreSQL`);
          }
        } catch (backendError: any) {
          console.log('PostgreSQL backend error, falling back to Firebase:', backendError.message);

          // Fallback to Firebase
          const userGroups = await firebaseService.getUserGroups(user.id);
          const groupIds = userGroups.map(group => group.id);

          // Get both user activities and group activities
          const [userActivities, groupActivities] = await Promise.all([
            firebaseService.getUserActivities(user.id, 30),
            firebaseService.getGroupActivities(groupIds, 20)
          ]);

          // Combine and deduplicate activities
          const allActivities = [...userActivities, ...groupActivities];
          loadedActivities = allActivities.filter((activity, index, self) =>
            index === self.findIndex(a => a.id === activity.id)
          ).map(act => ({ ...act, isPersonalExpense: false }));
          console.log(`Loaded ${loadedActivities.length} activities from Firebase`);
        }

        // For personal expense activities, check which expenses still exist
        const personalExpenseActivityIds = loadedActivities
          .filter(act => act.isPersonalExpense && act.personalExpenseId)
          .map(act => act.personalExpenseId as string);

        // Get existing personal expenses to check which ones are deleted
        let existingExpenseIds = new Set<string>();
        if (personalExpenseActivityIds.length > 0) {
          try {
            console.log('Checking which personal expenses still exist...');
            const personalResponse = await personalExpenseApi.getPersonalExpenses(user.id, 1, 100);
            if (personalResponse.success) {
              existingExpenseIds = new Set(personalResponse.data.map(exp => exp.id));
              console.log(`Found ${existingExpenseIds.size} existing personal expenses`);
            }
          } catch (err) {
            console.log('Error fetching personal expenses for existence check:', err);
          }
        }

        // Mark activities as deleted if their expense no longer exists
        loadedActivities = loadedActivities.map(act => {
          if (act.isPersonalExpense && act.personalExpenseId) {
            return {
              ...act,
              isDeleted: !existingExpenseIds.has(act.personalExpenseId),
            };
          }
          return act;
        });

        // Combine all activities (no backward compatibility - only from activity API)
        const allActivities = [...loadedActivities, ...personalExpenseActivities];

        // Sort by creation time (most recent first)
        allActivities.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        // Limit to 50 most recent
        return allActivities.slice(0, 50);
      })();

      // Wait for both data loading and minimum loading time
      const [limitedActivities] = await Promise.all([dataPromise, minLoadingTime]);

      setActivities(limitedActivities);
      // Apply current filter
      applyFilter(limitedActivities, activeFilter);
    } catch (error) {
      Alert.alert('Error', 'Failed to load recent activities. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);

      // Set initial loading to false after first load and animate content in
      if (initialLoading) {
        setInitialLoading(false);
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [user?.id, initialLoading, contentFadeAnim, activeFilter]);

  // Apply filter to activities
  const applyFilter = useCallback((allActivities: ExtendedActivity[], filter: ActivityFilter) => {
    let filtered: ExtendedActivity[];

    switch (filter) {
      case 'groups':
        filtered = allActivities.filter(a => !a.isPersonalExpense && a.groupId);
        break;
      case 'personal':
        filtered = allActivities.filter(a => a.isPersonalExpense);
        break;
      case 'other':
        filtered = allActivities.filter(a => !a.isPersonalExpense && !a.groupId);
        break;
      case 'all':
      default:
        filtered = allActivities;
        break;
    }

    setFilteredActivities(filtered);
  }, []);

  // Handle filter change
  const handleFilterChange = (filter: ActivityFilter) => {
    setActiveFilter(filter);
    applyFilter(activities, filter);
    setShowFilterModal(false);
  };

  useEffect(() => {
    // Only load data if user is available
    if (user?.id) {
      loadActivities();
    } else {
      // If no user, still show skeleton briefly then show empty state
      const timer = setTimeout(() => {
        if (initialLoading) {
          setInitialLoading(false);
          Animated.timing(contentFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      }, 1000);

      // Cleanup timer on unmount
      return () => clearTimeout(timer);
    }
  }, [user?.id, loadActivities, initialLoading, contentFadeAnim]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!loading && !initialLoading && user?.id) {
        loadActivities();
      }
    }, [loadActivities, loading, initialLoading, user?.id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivities();
  }, [loadActivities]);

  const getActivityIcon = (type: Activity['type'], isPersonal?: boolean) => {
    if (isPersonal) {
      return 'account-balance-wallet'; // Wallet icon for personal expenses
    }
    switch (type) {
      case 'expense_added':
        return 'receipt';
      case 'payment_made':
      case 'settlement_created':
      case 'settlement_confirmed':
        return 'swap-horiz';
      case 'group_created':
      case 'group_joined':
        return 'group-add';
      default:
        return 'event-note';
    }
  };

  const getActivityColor = (type: Activity['type'], isPersonal?: boolean) => {
    if (isPersonal) {
      return '#8B5CF6'; // Purple for personal expenses
    }
    switch (type) {
      case 'expense_added':
        return '#F59E0B'; // Orange
      case 'payment_made':
      case 'settlement_created':
        return '#EF4444'; // Red
      case 'settlement_confirmed':
        return '#10B981'; // Green
      case 'group_created':
      case 'group_joined':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return 'Recently';
    const now = new Date();
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return 'Recently';

    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;

    return date.toLocaleDateString();
  };

  const handleActivityPress = async (activity: ExtendedActivity) => {
    if (activity.isPersonalExpense) {
      // For personal expense activities, check if the expense still exists
      const expenseId = activity.personalExpenseId || activity.personalExpenseData?.id;

      if (expenseId) {
        try {
          // Try to fetch the expense to verify it exists
          await personalExpenseApi.getPersonalExpenseById(expenseId);
          // Expense exists, navigate to Personal Expenses tab
          navigation.navigate('PersonalExpenses');
        } catch (error: any) {
          // Expense not found (deleted)
          if (error.response?.status === 404 || error.message?.includes('not found')) {
            Alert.alert(
              'Expense Deleted',
              'This personal expense has been deleted and is no longer available.',
              [{ text: 'OK', style: 'default' }]
            );
          } else {
            // Other error, still try to navigate
            console.log('Error checking expense existence:', error);
            navigation.navigate('PersonalExpenses');
          }
        }
      } else {
        // No expense ID, just navigate
        navigation.navigate('PersonalExpenses');
      }
    } else if (activity.groupId) {
      // Navigate to Home tab first, then to GroupDetail screen
      navigation.navigate('Home', {
        screen: 'GroupDetail',
        params: {
          group: { id: activity.groupId, name: activity.groupName },
          currentUserId: user?.id,
        }
      });
    }
  };

  const handleDeleteActivity = async (activity: Activity) => {
    // Haptic feedback on swipe reveal
    if (Platform.OS === 'ios') {
      Vibration.vibrate(50); // Light haptic feedback
    } else {
      Vibration.vibrate(25); // Short vibration for Android
    }

    Alert.alert(
      '🗑️ Delete Activity',
      `Are you sure you want to delete "${activity.title}"?\n\nThis action cannot be undone.`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            // Light feedback for cancel
            if (Platform.OS === 'ios') {
              Vibration.vibrate(25);
            }
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Set deleting state for loading indicator
              setDeletingActivityId(activity.id!);
              
              // Strong haptic feedback for delete action
              if (Platform.OS === 'ios') {
                Vibration.vibrate([0, 100, 50, 100]); // Pattern vibration
              } else {
                Vibration.vibrate(100);
              }

              // Try PostgreSQL backend first, fallback to Firebase
              try {
                console.log('Deleting activity from PostgreSQL backend...');
                await activityApi.deleteActivity(activity.id!);
                console.log('Activity deleted successfully from PostgreSQL');
              } catch (backendError: any) {
                console.log('PostgreSQL backend error, falling back to Firebase:', backendError.message);
                await firebaseService.deleteActivity(activity.id!);
                console.log('Activity deleted successfully from Firebase');
              }
              
              // Animate out with fade effect
              const activityElement = activities.find(a => a.id === activity.id);
              if (activityElement) {
                // Remove from local state with smooth animation
                setActivities(prevActivities => 
                  prevActivities.filter(a => a.id !== activity.id)
                );
              }
              
              // Success feedback
              if (Platform.OS === 'ios') {
                Vibration.vibrate(50); // Success haptic
              }
              
            } catch (error) {
              
              // Error haptic feedback
              if (Platform.OS === 'ios') {
                Vibration.vibrate([0, 200, 100, 200]); // Error pattern
              } else {
                Vibration.vibrate(200);
              }
              
              Alert.alert(
                '❌ Error', 
                'Failed to delete activity. Please check your connection and try again.',
                [{ text: 'OK', style: 'default' }]
              );
            } finally {
              setDeletingActivityId(null);
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const renderRightActions = (activity: Activity) => {
    const isDeleting = deletingActivityId === activity.id;
    
    return (
      <Animated.View style={styles(colors, scale).deleteButtonContainer}>
        <TouchableOpacity
          style={[
            styles(colors, scale).deleteButton,
            isDeleting && styles(colors, scale).deleteButtonLoading
          ]}
          onPress={() => handleDeleteActivity(activity)}
          activeOpacity={0.8}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles(colors, scale).deleteButtonText}>Deleting...</Text>
            </>
          ) : (
            <>
              <MaterialIcons 
                name="delete" 
                size={scale(24)} 
                color="#FFFFFF" 
              />
              <Text style={styles(colors, scale).deleteButtonText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderActivity = (activity: ExtendedActivity) => {
    const isPersonal = activity.isPersonalExpense;
    const isDeleted = activity.isDeleted;
    const iconName = getActivityIcon(activity.type, isPersonal);
    const iconColor = isDeleted ? colors.secondaryText : getActivityColor(activity.type, isPersonal);

    // Greyed out styles for deleted expenses
    const deletedOpacity = isDeleted ? 0.5 : 1;

    const activityContent = (
      <TouchableOpacity
        style={[styles(colors, scale).activityItem, { opacity: deletedOpacity }]}
        onPress={() => handleActivityPress(activity)}
        activeOpacity={0.7}
      >
        <View style={[styles(colors, scale).activityIcon, { backgroundColor: iconColor + '20' }]}>
          <MaterialIcons name={iconName} size={scale(24)} color={iconColor} />
        </View>

        <View style={styles(colors, scale).activityContent}>
          <Text style={[
            styles(colors, scale).activityTitle,
            isDeleted && { color: colors.secondaryText, textDecorationLine: 'line-through' }
          ]} numberOfLines={2}>
            {activity.title}
          </Text>

          {activity.description && (
            <Text style={styles(colors, scale).activityDescription} numberOfLines={1}>
              {activity.description}
            </Text>
          )}

          <View style={styles(colors, scale).activityMeta}>
            {isDeleted ? (
              <Text style={[styles(colors, scale).activityGroup, { color: '#EF4444' }]} numberOfLines={1}>
                Deleted
              </Text>
            ) : activity.groupName ? (
              <Text style={styles(colors, scale).activityGroup} numberOfLines={1}>
                {activity.groupName}
              </Text>
            ) : isPersonal ? (
              <Text style={[styles(colors, scale).activityGroup, { color: '#8B5CF6' }]} numberOfLines={1}>
                Personal
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles(colors, scale).activityRight}>
          {activity.amount != null && (
            <Text style={[styles(colors, scale).amountText, { color: isDeleted ? colors.secondaryText : iconColor }]}>
              ₹{(Number(activity.amount) || 0).toFixed(0)}
            </Text>
          )}
          <Text style={styles(colors, scale).activityTime}>
            {formatRelativeTime(activity.createdAt)}
          </Text>
        </View>

        <MaterialIcons
          name="chevron-right"
          size={scale(20)}
          color={colors.secondaryText}
        />
      </TouchableOpacity>
    );

    return (
      <Swipeable
        key={activity.id}
        renderRightActions={() => renderRightActions(activity)}
        rightThreshold={40}
        friction={2}
        leftThreshold={30}
        onSwipeableWillOpen={() => {
          // Light haptic feedback when swipe starts to reveal delete button
          if (Platform.OS === 'ios') {
            Vibration.vibrate(25);
          }
        }}
        containerStyle={styles(colors, scale).swipeableContainer}
        childrenContainerStyle={styles(colors, scale).swipeableChildContainer}
      >
        {activityContent}
      </Swipeable>
    );
  };

  const renderEmptyState = () => {
    const emptyMessages: Record<ActivityFilter, { title: string; description: string }> = {
      all: {
        title: 'No Recent Activity',
        description: 'Your recent activities will appear here once you start adding expenses and making payments.',
      },
      groups: {
        title: 'No Group Activities',
        description: 'Group activities will appear here when you add expenses or make payments in your groups.',
      },
      personal: {
        title: 'No Personal Expenses',
        description: 'Your personal expenses will appear here. Tap the Scan button to add your first expense!',
      },
      other: {
        title: 'No Other Activities',
        description: 'Other activities like group joins and account updates will appear here.',
      },
    };

    const message = emptyMessages[activeFilter];

    return (
      <View style={styles(colors, scale).emptyState}>
        <MaterialIcons name="event-note" size={scale(80)} color={colors.secondaryText} />
        <Text style={styles(colors, scale).emptyStateTitle}>{message.title}</Text>
        <Text style={styles(colors, scale).emptyStateDescription}>{message.description}</Text>
      </View>
    );
  };

  const getFilterLabel = () => {
    const option = filterOptions.find(f => f.key === activeFilter);
    return option?.label || 'All Activities';
  };

  const renderFilterDropdown = () => {
    if (!showFilterModal) return null;

    return (
      <>
        <TouchableOpacity
          style={styles(colors, scale).filterMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        />
        <View style={styles(colors, scale).filterMenuContainer}>
          {filterOptions.map((option, index) => (
            <React.Fragment key={option.key}>
              <TouchableOpacity
                style={styles(colors, scale).filterMenuItem}
                onPress={() => handleFilterChange(option.key)}
              >
                <MaterialIcons
                  name={option.icon}
                  size={scale(20)}
                  color={activeFilter === option.key ? colors.primaryButton : colors.primaryText}
                />
                <Text
                  style={[
                    styles(colors, scale).filterMenuText,
                    activeFilter === option.key && styles(colors, scale).filterMenuTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {activeFilter === option.key && (
                  <MaterialIcons name="check" size={scale(18)} color={colors.primaryButton} />
                )}
              </TouchableOpacity>
              {index < filterOptions.length - 1 && (
                <View style={styles(colors, scale).filterMenuDivider} />
              )}
            </React.Fragment>
          ))}
        </View>
      </>
    );
  };

  // Show skeleton loader during initial loading
  if (initialLoading) {
    return (
      <SafeAreaView style={styles(colors, scale).container} edges={['top', 'left', 'right']}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.statusBarBackground}
        />
        <ActivityScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles(colors, scale).container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.statusBarBackground}
      />

      <Animated.View style={[styles(colors, scale).animatedContainer, { opacity: contentFadeAnim }]}>
        {/* Header */}
        <View style={styles(colors, scale).header}>
          <Text style={styles(colors, scale).headerTitle}>Recent Activity</Text>
          <TouchableOpacity
            style={styles(colors, scale).filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialIcons name="filter-list" size={scale(24)} color={colors.primaryText} />
            {activeFilter !== 'all' && (
              <View style={styles(colors, scale).filterBadge}>
                <Text style={styles(colors, scale).filterBadgeText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Filter Indicator */}
        {activeFilter !== 'all' && (
          <View style={styles(colors, scale).activeFilterBar}>
            <Text style={styles(colors, scale).activeFilterText}>
              Showing: {getFilterLabel()}
            </Text>
            <TouchableOpacity onPress={() => handleFilterChange('all')}>
              <MaterialIcons name="close" size={scale(18)} color={colors.primaryButton} />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {loading && filteredActivities.length === 0 ? (
          <View style={styles(colors, scale).loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryButton} />
            <Text style={styles(colors, scale).loadingText}>Loading activities...</Text>
          </View>
        ) : (
        <GestureHandlerRootView style={styles(colors, scale).gestureContainer}>
          <ScrollView
            style={styles(colors, scale).scrollView}
            contentContainerStyle={[
              styles(colors, scale).scrollContent,
              { paddingBottom: insets.bottom } // Only safe area padding, no extra space
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primaryButton]}
                tintColor={colors.primaryButton}
              />
            }
            showsVerticalScrollIndicator={false}
          >
          {filteredActivities.length > 0 ? (
            <>
              {filteredActivities.map(renderActivity)}
              
              {/* Load more placeholder */}
              {activities.length >= 50 && (
                <View style={styles(colors, scale).loadMoreContainer}>
                  <Text style={styles(colors, scale).loadMoreText}>
                    Showing recent 50 activities
                  </Text>
                </View>
              )}
            </>
          ) : (
            renderEmptyState()
          )}
          </ScrollView>
        </GestureHandlerRootView>
        )}
      </Animated.View>

      {/* Filter Dropdown Menu */}
      {renderFilterDropdown()}
    </SafeAreaView>
  );
};

const styles = (colors: any, scale: (size: number) => number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(20),
      paddingVertical: scale(16),
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.secondaryText + '20',
    },
    headerTitle: {
      fontSize: scale(24),
      fontWeight: '700',
      color: colors.primaryText,
    },
    refreshButton: {
      padding: scale(8),
      borderRadius: scale(20),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scale(40),
    },
    loadingText: {
      fontSize: scale(16),
      color: colors.secondaryText,
      marginTop: scale(16),
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: scale(8), // Only top padding, no bottom padding
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(20),
      paddingVertical: scale(16),
      backgroundColor: colors.cardBackground,
      marginVertical: scale(1),
    },
    activityIcon: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(16),
    },
    activityContent: {
      flex: 1,
      marginRight: scale(12),
    },
    activityTitle: {
      fontSize: scale(16),
      fontWeight: '600',
      color: colors.primaryText,
      marginBottom: scale(4),
    },
    activityDescription: {
      fontSize: scale(14),
      color: colors.secondaryText,
      marginBottom: scale(6),
    },
    activityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activityGroup: {
      fontSize: scale(12),
      color: colors.primaryButton,
      fontWeight: '500',
      flex: 1,
      marginRight: scale(8),
    },
    activityTime: {
      fontSize: scale(12),
      color: colors.secondaryText,
    },
    activityRight: {
      alignItems: 'flex-end',
      marginRight: scale(8),
    },
    amountText: {
      fontSize: scale(16),
      fontWeight: '700',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scale(40),
      paddingTop: scale(100),
    },
    emptyStateTitle: {
      fontSize: scale(20),
      fontWeight: '600',
      color: colors.primaryText,
      marginTop: scale(16),
      marginBottom: scale(8),
    },
    emptyStateDescription: {
      fontSize: scale(14),
      color: colors.secondaryText,
      textAlign: 'center',
      lineHeight: scale(20),
    },
    loadMoreContainer: {
      padding: scale(20),
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: scale(14),
      color: colors.secondaryText,
      fontStyle: 'italic',
    },
    deleteButtonContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FF3B30',
      width: scale(80),
    },
    deleteButton: {
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      width: scale(80),
      height: '100%',
      paddingHorizontal: scale(10),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    deleteButtonLoading: {
      backgroundColor: '#FF6B60',
      opacity: 0.8,
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: scale(11),
      fontWeight: '600',
      marginTop: scale(4),
      textAlign: 'center',
    },
    swipeableContainer: {
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    swipeableChildContainer: {
      backgroundColor: colors.cardBackground,
    },
    animatedContainer: {
      flex: 1,
    },
    gestureContainer: {
      flex: 1,
    },
    // Filter button styles
    filterButton: {
      padding: scale(8),
      borderRadius: scale(20),
      position: 'relative',
    },
    filterBadge: {
      position: 'absolute',
      top: scale(2),
      right: scale(2),
      backgroundColor: colors.primaryButton,
      borderRadius: scale(8),
      width: scale(16),
      height: scale(16),
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterBadgeText: {
      color: '#FFFFFF',
      fontSize: scale(10),
      fontWeight: '700',
    },
    activeFilterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scale(20),
      paddingVertical: scale(10),
      backgroundColor: colors.primaryButton + '15',
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryButton + '30',
    },
    activeFilterText: {
      fontSize: scale(14),
      color: colors.primaryButton,
      fontWeight: '500',
    },
    // Filter dropdown menu styles (similar to HomeScreen header menu)
    filterMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    filterMenuContainer: {
      position: 'absolute',
      top: scale(60),
      right: scale(16),
      backgroundColor: colors.cardBackground,
      borderRadius: scale(12),
      paddingVertical: scale(8),
      minWidth: scale(200),
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    filterMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(16),
      paddingVertical: scale(12),
      gap: scale(12),
    },
    filterMenuText: {
      flex: 1,
      fontSize: scale(14),
      color: colors.primaryText,
      fontWeight: '500',
    },
    filterMenuTextActive: {
      color: colors.primaryButton,
      fontWeight: '600',
    },
    filterMenuDivider: {
      height: 1,
      backgroundColor: colors.secondaryText,
      opacity: 0.2,
      marginHorizontal: scale(12),
      marginVertical: scale(4),
    },
    // Legacy filter styles (kept for reference)
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: scale(14),
      paddingHorizontal: scale(12),
      borderRadius: scale(10),
      marginBottom: scale(8),
      backgroundColor: colors.background,
    },
    filterOptionActive: {
      backgroundColor: colors.primaryButton + '15',
      borderWidth: 1,
      borderColor: colors.primaryButton,
    },
    filterOptionText: {
      flex: 1,
      fontSize: scale(16),
      color: colors.primaryText,
      marginLeft: scale(12),
    },
    filterOptionTextActive: {
      color: colors.primaryButton,
      fontWeight: '600',
    },
  });