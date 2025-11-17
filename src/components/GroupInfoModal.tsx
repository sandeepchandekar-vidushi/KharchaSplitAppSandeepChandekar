import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography } from '../utils/typography';
import { ensureDataUri } from '../utils/imageUtils';

interface Member {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  isAdmin?: boolean;
  isCreator?: boolean;
}

interface Expense {
  id: string;
  amount: number;
}

interface GroupInfoModalProps {
  visible: boolean;
  onClose: () => void;
  currentGroup: any;
  groupMembers: Member[];
  expenses: Expense[];
  currentUserId: string | null;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  visible,
  onClose,
  currentGroup,
  groupMembers,
  expenses,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive scaling
  const baseWidth = 375;
  const scale = (size: number) => (screenWidth / baseWidth) * size;

  // Scaled font sizes
  const scaledFontSize = {
    xs: scale(typography.fontSize.xs),
    sm: scale(typography.fontSize.sm),
    base: scale(typography.fontSize.base),
    lg: scale(typography.fontSize.lg),
    xl: scale(typography.fontSize.xl),
    '2xl': scale(typography.fontSize['2xl']),
    header: scale(typography.text.header.fontSize),
    headerLarge: scale(typography.text.headerLarge.fontSize),
    title: scale(typography.text.title.fontSize),
    subtitle: scale(typography.text.subtitle.fontSize),
    body: scale(typography.text.body.fontSize),
    caption: scale(typography.text.caption.fontSize),
  };

  // Memoize expensive calculations
  const totalExpenses = useMemo(() =>
    expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
    [expenses]
  );

  const formattedDate = useMemo(() =>
    currentGroup?.createdAt
      ? new Date(currentGroup.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : 'N/A',
    [currentGroup?.createdAt]
  );

  const styles = createStyles(colors, scale, scaledFontSize, insets);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Group Information</Text>
            <Text style={styles.subtitle}>{currentGroup?.name}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={scale(32)} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Description Card */}
            {currentGroup?.description && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text-outline" size={scale(20)} color={colors.primaryButton} />
                  <Text style={styles.cardTitle}>Description</Text>
                </View>
                <Text style={styles.cardText}>{currentGroup.description}</Text>
              </View>
            )}

            {/* Stats Cards Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="people" size={scale(24)} color={colors.primaryButton} />
                </View>
                <Text style={styles.statValue}>{groupMembers.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="receipt" size={scale(24)} color="#10B981" />
                </View>
                <Text style={styles.statValue}>{expenses.length}</Text>
                <Text style={styles.statLabel}>Expenses</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="cash" size={scale(24)} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>
                  ₹{(totalExpenses / 1000).toFixed(1)}K
                </Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle-outline" size={scale(20)} color={colors.primaryButton} />
                <Text style={styles.cardTitle}>Details</Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoRowIcon}>
                  <Ionicons name="calendar-outline" size={scale(18)} color={colors.secondaryText} />
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowLabel}>Created On</Text>
                  <Text style={styles.infoRowValue}>
                    {formattedDate}
                  </Text>
                </View>
              </View>

              <View style={[styles.infoRow, styles.infoRowLast]}>
                <View style={styles.infoRowIcon}>
                  <Ionicons name="person-outline" size={scale(18)} color={colors.secondaryText} />
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowLabel}>Created By</Text>
                  <Text style={styles.infoRowValue}>
                    {groupMembers.find(m => m.isCreator)?.name || 'Unknown'}
                    {groupMembers.find(m => m.isCreator)?.userId === currentUserId ? ' (You)' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* Members Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="people-outline" size={scale(20)} color={colors.primaryButton} />
                <Text style={styles.cardTitle}>Members ({groupMembers.length})</Text>
              </View>

              <View style={styles.membersList}>
                {groupMembers.map((member, index) => (
                  <View key={member.userId || index} style={styles.memberItem}>
                    <View style={styles.memberLeftSection}>
                      {(() => {
                        const imageUri = ensureDataUri(member.avatar);
                        return imageUri ? (
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.memberAvatar}
                          />
                        ) : (
                          <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                            <Text style={styles.memberAvatarText}>
                              {member.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        );
                      })()}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {member.name}
                          {member.userId === currentUserId && (
                            <Text style={styles.youBadge}> (You)</Text>
                          )}
                        </Text>
                        {member.email && (
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.roleBadge,
                      member.isCreator ? styles.creatorBadge :
                      member.isAdmin ? styles.adminBadge :
                      styles.memberBadge
                    ]}>
                      <Text style={styles.roleBadgeText}>
                        {member.isCreator ? '👑 Creator' : member.isAdmin ? '⭐ Admin' : '👤 Member'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: scale(20) }} />
          </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (
  colors: any,
  scale: (size: number) => number,
  fonts: any,
  insets: any
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(20),
    paddingBottom: scale(16),
  },
  title: {
    fontSize: fonts.headerLarge,
    fontWeight: '700',
    color: colors.primaryText,
    marginBottom: scale(4),
  },
  subtitle: {
    fontSize: fonts.body,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  closeButton: {
    padding: scale(4),
  },
  scrollView: {
    paddingHorizontal: scale(20),
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  cardTitle: {
    fontSize: fonts.title,
    fontWeight: '700',
    color: colors.primaryText,
    marginLeft: scale(8),
  },
  cardText: {
    fontSize: fonts.body,
    color: colors.secondaryText,
    lineHeight: scale(22),
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(16),
    gap: scale(12),
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: scale(16),
    padding: scale(16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  statValue: {
    fontSize: fonts.xl,
    fontWeight: '700',
    color: colors.primaryText,
    marginBottom: scale(2),
  },
  statLabel: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoRowIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  infoRowContent: {
    flex: 1,
  },
  infoRowLabel: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    marginBottom: scale(4),
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '600',
  },
  membersList: {
    marginTop: scale(8),
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  memberLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    marginRight: scale(12),
  },
  memberAvatarPlaceholder: {
    backgroundColor: colors.primaryButton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: fonts.title,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '600',
    marginBottom: scale(2),
  },
  memberEmail: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
  },
  youBadge: {
    color: colors.primaryButton,
    fontSize: fonts.caption,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    marginLeft: scale(8),
  },
  creatorBadge: {
    backgroundColor: '#FEF3C7',
  },
  adminBadge: {
    backgroundColor: '#DBEAFE',
  },
  memberBadge: {
    backgroundColor: colors.background,
  },
  roleBadgeText: {
    fontSize: fonts.caption,
    fontWeight: '600',
  },
});
