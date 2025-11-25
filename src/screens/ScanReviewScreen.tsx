import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { typography } from '../utils/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OCRResult, LineItem } from '../services/api/ocrApi';
import { personalExpenseApi } from '../services/api/personalExpenseApi';
import { activityApi } from '../services/api/activityApi';
import { firebaseService, PersonalExpense } from '../services/firebaseService';
import { formatFileSize, validateReceiptImage } from '../utils/imageUtils';

interface ScanReviewScreenProps {
  route: {
    params: {
      ocrResult: OCRResult;
      imageBase64: string | null;
    };
  };
  navigation: any;
}

export const ScanReviewScreen: React.FC<ScanReviewScreenProps> = ({ route, navigation }) => {
  const { ocrResult, imageBase64 } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();

  const { width: screenWidth } = useWindowDimensions();
  const baseWidth = 375;
  const scale = (size: number) => (screenWidth / baseWidth) * size;

  const scaledFontSize = {
    xs: scale(typography.fontSize.xs),
    sm: scale(typography.fontSize.sm),
    base: scale(typography.fontSize.base),
    lg: scale(typography.fontSize.lg),
    xl: scale(typography.fontSize.xl),
    '2xl': scale(typography.fontSize['2xl']),
    header: scale(typography.text.header.fontSize),
    caption: scale(typography.text.caption.fontSize),
    body: scale(typography.text.body.fontSize),
    button: scale(typography.text.button.fontSize),
  };

  // Categories matching PersonalExpenses
  const categories = [
    { id: 1, name: 'Food', emoji: '🍽️', color: '#FEF3C7' },
    { id: 2, name: 'Transportation', emoji: '🚗', color: '#FECACA' },
    { id: 3, name: 'Shopping', emoji: '🛍️', color: '#E0E7FF' },
    { id: 4, name: 'Drinks', emoji: '🍺', color: '#FED7AA' },
    { id: 5, name: 'Entertainment', emoji: '🎬', color: '#F3E8FF' },
    { id: 6, name: 'Health', emoji: '🏥', color: '#FECACA' },
    { id: 7, name: 'Other', emoji: '📝', color: '#F3F4F6' },
  ];

  const currencies = [
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

  // State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(ocrResult.totalAmount?.toString() || '');
  // Default to Food category (id: 1)
  const [selectedCategory, setSelectedCategory] = useState<any>(categories[0]);
  const [selectedCurrency, setSelectedCurrency] = useState({ code: 'INR', symbol: '₹' });
  const [expenseDate, setExpenseDate] = useState(() => {
    if (ocrResult.dateOfIssue) {
      const parsedDate = new Date(ocrResult.dateOfIssue);
      // Validate the parsed date
      if (!isNaN(parsedDate.getTime())) {
        console.log('[ScanReview] Using OCR date:', ocrResult.dateOfIssue, '-> Parsed:', parsedDate.toISOString());
        return parsedDate;
      }
      console.log('[ScanReview] Invalid OCR date:', ocrResult.dateOfIssue);
    }
    console.log('[ScanReview] Using current date as fallback');
    return new Date();
  });
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>(ocrResult.lineItems || []);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [otherCategoryName, setOtherCategoryName] = useState('');

  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLineItemsModal, setShowLineItemsModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Set default category from OCR result
  useEffect(() => {
    if (ocrResult.suggestedCategory) {
      const matchedCategory = categories.find(
        c => c.name.toLowerCase() === ocrResult.suggestedCategory?.toLowerCase()
      );
      if (matchedCategory) {
        setSelectedCategory(matchedCategory);
      }
    }
  }, [ocrResult.suggestedCategory]);

  // Set currency from OCR result or user preference
  useEffect(() => {
    if (ocrResult.currency) {
      const matchedCurrency = currencies.find(c => c.code === ocrResult.currency);
      if (matchedCurrency) {
        setSelectedCurrency(matchedCurrency);
      }
    } else if (user?.preferredCurrency) {
      const userCurrency = currencies.find(c => c.code === user.preferredCurrency);
      if (userCurrency) {
        setSelectedCurrency(userCurrency);
      }
    }
  }, [ocrResult.currency, user?.preferredCurrency]);

  // Build notes from line items
  useEffect(() => {
    if (lineItems.length > 0) {
      const itemsText = lineItems
        .map(item => `${item.description}: ${item.quantity}x ${selectedCurrency.symbol}${item.unitPrice.toFixed(2)}`)
        .join('\n');
      setNotes(itemsText);
    }
  }, [lineItems, selectedCurrency.symbol]);

  // Load user's groups for the destination modal
  const loadUserGroups = async () => {
    if (!user?.id) return;
    setLoadingGroups(true);
    try {
      const groups = await firebaseService.getUserGroups(user.id);
      setUserGroups(groups.filter((g: any) => g.isActive !== false));
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSave = async () => {
    // Validations
    if (!amount.trim() || parseFloat(amount) <= 0) {
      return Alert.alert('Error', 'Please enter a valid amount');
    }
    if (!selectedCategory) {
      return Alert.alert('Error', 'Please select a category');
    }
    // Note: For 'Other' category, we allow saving without specifying a custom name
    // The description field can be used to provide more context
    if (!user?.id) {
      return Alert.alert('Error', 'User information is missing');
    }

    // Validate receipt if present
    if (imageBase64) {
      const validation = validateReceiptImage(imageBase64);
      if (!validation.valid) {
        return Alert.alert('Error', validation.error || 'Invalid receipt image');
      }
    }

    // Show destination selection modal
    await loadUserGroups();
    setShowDestinationModal(true);
  };

  const handleSaveToPersonal = async () => {
    setShowDestinationModal(false);
    setLoading(true);
    try {
      const totalAmount = parseFloat(amount);
      const categoryName = selectedCategory.name === 'Other'
        ? (otherCategoryName || 'Other')
        : selectedCategory.name;

      // Use user-entered description or fall back to category name
      const expenseDescription = description.trim() || categoryName;

      const finalNotes = notes;

      // Try PostgreSQL backend first
      let createdExpenseId: string | null = null;
      try {
        console.log('[ScanReview] Creating scanned expense in PostgreSQL backend...');
        console.log('[ScanReview] Expense date being saved:', expenseDate.toISOString());

        const response = await personalExpenseApi.createPersonalExpense({
          description: expenseDescription,
          amount: totalAmount,
          currency: selectedCurrency.code,
          category: categoryName,
          receiptBase64: imageBase64?.startsWith('data:') ? imageBase64 : undefined,
          notes: finalNotes.trim() || undefined,
          expenseDate: expenseDate.toISOString(),
        });

        if (response.success) {
          createdExpenseId = response.data.id;
          console.log('Scanned expense created successfully in PostgreSQL:', createdExpenseId);

          // Create activity record for this personal expense
          try {
            await activityApi.createActivity({
              userId: user!.id,
              activityType: 'personal_expense_added',
              entityType: 'personal_expense',
              entityId: createdExpenseId,
              title: `Personal: ${expenseDescription}`,
              description: categoryName ? `Category: ${categoryName}` : undefined,
              metadata: {
                amount: totalAmount,
                currency: selectedCurrency.code,
                category: categoryName,
                expenseDate: expenseDate.toISOString(),
              },
            });
            console.log('Activity created for personal expense');
          } catch (activityError) {
            console.log('Failed to create activity record:', activityError);
            // Don't fail the expense creation if activity creation fails
          }
        }
      } catch (backendError: any) {
        console.log('PostgreSQL backend error, falling back to Firebase:', backendError.message);

        // Fallback to Firebase
        const expense: Omit<PersonalExpense, 'id'> = {
          userId: user!.id,
          description: expenseDescription,
          amount: totalAmount,
          category: {
            ...selectedCategory,
            name: categoryName,
          },
          ...(imageBase64?.startsWith('data:') && { receiptBase64: imageBase64 }),
          date: expenseDate.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          ...(finalNotes.trim() && { notes: finalNotes.trim() }),
        };

        await firebaseService.createPersonalExpense(expense);
        console.log('Scanned expense created successfully in Firebase');
      }

      Alert.alert('Success', 'Expense saved to Personal Expenses!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to Scan tab root
            navigation.navigate('ScanMain');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewGroup = () => {
    setShowDestinationModal(false);
    const categoryName = selectedCategory?.name === 'Other'
      ? (otherCategoryName.trim() || 'Other')
      : selectedCategory?.name || 'Expense';
    const expenseDescription = description.trim() || categoryName;

    // Navigate to Home tab and trigger create group modal with prefilled expense data
    navigation.navigate('Home', {
      screen: 'HomeMain',
      params: {
        openCreateGroup: true,
        prefillExpense: {
          description: expenseDescription,
          amount: parseFloat(amount) || 0,
          currency: selectedCurrency.code,
          category: categoryName,
          date: expenseDate.toISOString(),
          notes: notes.trim() || undefined,
          receiptBase64: imageBase64?.startsWith('data:') ? imageBase64 : undefined,
        },
      },
    });
  };

  const handleAddToExistingGroup = () => {
    setShowDestinationModal(false);
    setShowGroupsModal(true);
  };

  const handleSelectGroup = (group: any) => {
    setShowGroupsModal(false);
    const categoryName = selectedCategory?.name === 'Other'
      ? (otherCategoryName || 'Other')
      : selectedCategory?.name || 'Expense';

    // Navigate to add expense screen with the selected group and pre-filled data
    navigation.navigate('AddExpense', {
      groupId: group.id,
      groupName: group.name,
      prefillData: {
        description: categoryName,
        amount: parseFloat(amount),
        currency: selectedCurrency.code,
        category: categoryName,
        date: expenseDate.toISOString(),
        notes: notes.trim() || undefined,
        receiptBase64: imageBase64?.startsWith('data:') ? imageBase64 : undefined,
      },
    });
  };

  const confidencePercentage = Math.round((ocrResult.confidence || 0) * 100);

  const styles = createStyles(colors, scale, scaledFontSize);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={scaledFontSize.xl} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Scanned Bill</Text>
        <View style={{ width: scaledFontSize.xl }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: scale(100) }}>
        {/* Confidence Indicator */}
        {ocrResult.confidence > 0 && (
          <View style={styles.confidenceCard}>
            <View style={styles.confidenceHeader}>
              <MaterialIcons
                name={confidencePercentage >= 70 ? 'check-circle' : 'info'}
                size={scale(20)}
                color={confidencePercentage >= 70 ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.confidenceTitle}>
                {confidencePercentage >= 70 ? 'High Confidence' : 'Review Recommended'}
              </Text>
            </View>
            <Text style={styles.confidenceText}>
              {confidencePercentage}% confidence in extracted data. Please verify the details below.
            </Text>
          </View>
        )}

        {/* Receipt Image Preview */}
        {imageBase64 && (
          <TouchableOpacity
            style={styles.receiptPreview}
            onPress={() => setShowReceiptImage(true)}
          >
            <Ionicons name="receipt" size={scale(20)} color={colors.primaryButton} />
            <Text style={styles.receiptPreviewText}>Receipt captured - Tap to view</Text>
            <Ionicons name="chevron-forward" size={scale(18)} color={colors.secondaryText} />
          </TouchableOpacity>
        )}

        {/* Description */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter description"
            placeholderTextColor={colors.secondaryText}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Category */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Category</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <View style={styles.dropdownContent}>
              {selectedCategory ? (
                <Text style={styles.dropdownText}>
                  {selectedCategory.emoji} {selectedCategory.name}
                </Text>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Select category</Text>
              )}
              <Ionicons name="chevron-down" size={scaledFontSize.lg} color={colors.secondaryText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Amount + Currency */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
            <TextInput
              style={[styles.textInput, styles.amountInput]}
              placeholder="0.00"
              placeholderTextColor={colors.secondaryText}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.currencyButton}
              onPress={() => setShowCurrencyModal(true)}
            >
              <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
              <Ionicons name="chevron-down" size={scaledFontSize.sm} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={scale(18)} color={colors.primaryText} />
            <Text style={styles.dateText}>
              {expenseDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <Ionicons name="chevron-down" size={scaledFontSize.lg} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <View style={styles.inputContainer}>
            <View style={styles.lineItemsHeader}>
              <Text style={styles.inputLabel}>Line Items ({lineItems.length})</Text>
              <TouchableOpacity onPress={() => setShowLineItemsModal(true)}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.lineItemsPreview}>
              {lineItems.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.lineItemRow}>
                  <Text style={styles.lineItemDesc} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.lineItemAmount}>
                    {selectedCurrency.symbol}{item.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}
              {lineItems.length > 3 && (
                <Text style={styles.moreItemsText}>+{lineItems.length - 3} more items</Text>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Add any additional notes..."
            placeholderTextColor={colors.secondaryText}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryButtonText} />
          ) : (
            <Text style={styles.saveButtonText}>Save Expense</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Modal (iOS) */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={scaledFontSize.xl} color={colors.primaryText} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={expenseDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setExpenseDate(selectedDate);
                }}
                maximumDate={new Date()}
                style={styles.datePicker}
              />
              <TouchableOpacity
                style={styles.datePickerDone}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={expenseDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setExpenseDate(selectedDate);
            }}
            maximumDate={new Date()}
          />
        )
      )}

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCategory(item);
                    setShowCategoryModal(false);
                    if (item.name !== 'Other') setOtherCategoryName('');
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {item.emoji}  {item.name}
                  </Text>
                  {selectedCategory?.id === item.id && (
                    <Ionicons name="checkmark" size={scaledFontSize.xl} color={colors.primaryButton} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCurrency(item);
                    setShowCurrencyModal(false);
                  }}
                >
                  <View style={styles.currencyItemContent}>
                    <Text style={styles.currencyItemSymbol}>{item.symbol}</Text>
                    <View style={styles.currencyItemDetails}>
                      <Text style={styles.currencyItemCode}>{item.code}</Text>
                      <Text style={styles.currencyItemName}>{item.name}</Text>
                    </View>
                  </View>
                  {selectedCurrency.code === item.code && (
                    <Ionicons name="checkmark" size={scaledFontSize.xl} color={colors.primaryButton} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCurrencyModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Line Items Modal */}
      <Modal
        visible={showLineItemsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLineItemsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Line Items</Text>
            <FlatList
              data={lineItems}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.lineItemModalRow}>
                  <View style={styles.lineItemModalLeft}>
                    <Text style={styles.lineItemModalDesc}>{item.description}</Text>
                    <Text style={styles.lineItemModalQty}>
                      Qty: {item.quantity} × {selectedCurrency.symbol}{item.unitPrice.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.lineItemModalTotal}>
                    {selectedCurrency.symbol}{item.totalPrice.toFixed(2)}
                  </Text>
                </View>
              )}
              ListFooterComponent={() => (
                <View style={styles.lineItemsTotal}>
                  <Text style={styles.lineItemsTotalLabel}>Total</Text>
                  <Text style={styles.lineItemsTotalValue}>
                    {selectedCurrency.symbol}
                    {lineItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
                  </Text>
                </View>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowLineItemsModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Receipt Image Modal */}
      <Modal
        visible={showReceiptImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReceiptImage(false)}
      >
        <View style={styles.imageModalBackdrop}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setShowReceiptImage(false)}
          >
            <Ionicons name="close-circle" size={scale(40)} color="#FFFFFF" />
          </TouchableOpacity>
          {imageBase64 && (
            <Image
              source={{ uri: imageBase64 }}
              style={styles.fullReceiptImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Destination Selection Modal */}
      <Modal
        visible={showDestinationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDestinationModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.destinationModalContainer}>
            <Text style={styles.modalTitle}>Where to save this expense?</Text>

            <TouchableOpacity
              style={styles.destinationOption}
              onPress={handleSaveToPersonal}
            >
              <View style={[styles.destinationIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="person" size={scale(24)} color="#4CAF50" />
              </View>
              <View style={styles.destinationTextContainer}>
                <Text style={styles.destinationTitle}>Personal Expense</Text>
                <Text style={styles.destinationSubtitle}>Save to your personal expenses</Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(20)} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.destinationOption}
              onPress={handleCreateNewGroup}
            >
              <View style={[styles.destinationIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="add-circle" size={scale(24)} color="#2196F3" />
              </View>
              <View style={styles.destinationTextContainer}>
                <Text style={styles.destinationTitle}>Create New Group</Text>
                <Text style={styles.destinationSubtitle}>Start a new group with this expense</Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(20)} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.destinationOption}
              onPress={handleAddToExistingGroup}
              disabled={userGroups.length === 0}
            >
              <View style={[styles.destinationIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="people" size={scale(24)} color="#FF9800" />
              </View>
              <View style={styles.destinationTextContainer}>
                <Text style={[styles.destinationTitle, userGroups.length === 0 && styles.disabledText]}>
                  Add to Existing Group
                </Text>
                <Text style={styles.destinationSubtitle}>
                  {loadingGroups ? 'Loading groups...' :
                   userGroups.length === 0 ? 'No groups available' :
                   `${userGroups.length} group${userGroups.length > 1 ? 's' : ''} available`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(20)} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDestinationModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Groups Selection Modal */}
      <Modal
        visible={showGroupsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Group</Text>
            <FlatList
              data={userGroups}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.groupOption}
                  onPress={() => handleSelectGroup(item)}
                >
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{item.name}</Text>
                    <Text style={styles.groupMembers}>
                      {item.members?.length || 0} member{(item.members?.length || 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={scale(20)} color={colors.secondaryText} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyGroupsText}>No groups found</Text>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowGroupsModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (
  colors: ReturnType<typeof useTheme>['colors'],
  scale: (size: number) => number,
  fonts: { [key: string]: number }
) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    backgroundColor: colors.cardBackground,
  },
  headerTitle: { fontSize: fonts.header, fontWeight: '600', color: colors.primaryText },
  scrollView: { padding: scale(16) },
  confidenceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(16),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(4),
    gap: scale(6),
  },
  confidenceTitle: {
    fontSize: fonts.sm,
    fontWeight: '600',
    color: colors.primaryText,
  },
  confidenceText: {
    fontSize: fonts.xs,
    color: colors.secondaryText,
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(16),
    gap: scale(10),
  },
  receiptPreviewText: {
    flex: 1,
    fontSize: fonts.sm,
    color: colors.primaryText,
    fontWeight: '500',
  },
  inputContainer: { marginBottom: scale(16) },
  inputLabel: {
    fontSize: fonts.caption,
    fontWeight: '500',
    color: colors.secondaryText,
    marginBottom: scale(8),
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    fontSize: fonts.body,
    color: colors.primaryText,
    backgroundColor: colors.cardBackground,
    height: scale(48),
  },
  notesInput: {
    height: scale(80),
    textAlignVertical: 'top',
    paddingTop: scale(10),
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    backgroundColor: colors.cardBackground,
    height: scale(48),
    justifyContent: 'center',
  },
  dropdownContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: fonts.body,
    color: colors.primaryText,
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: fonts.body,
    color: colors.secondaryText,
    flex: 1,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    backgroundColor: colors.cardBackground,
    paddingHorizontal: scale(12),
    height: scale(48),
  },
  currencySymbol: {
    fontSize: fonts.body,
    color: colors.secondaryText,
    marginRight: scale(8),
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
    height: '100%',
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scale(8),
    paddingVertical: scale(4),
    paddingHorizontal: scale(8),
    backgroundColor: colors.background,
    borderRadius: scale(4),
    gap: scale(4),
  },
  currencyCode: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    backgroundColor: colors.cardBackground,
    paddingHorizontal: scale(12),
    height: scale(48),
    gap: scale(8),
  },
  dateText: {
    flex: 1,
    fontSize: fonts.body,
    color: colors.primaryText,
  },
  lineItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  viewAllText: {
    fontSize: fonts.caption,
    color: colors.primaryButton,
    fontWeight: '500',
  },
  lineItemsPreview: {
    backgroundColor: colors.cardBackground,
    borderRadius: scale(8),
    padding: scale(12),
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(6),
  },
  lineItemDesc: {
    flex: 1,
    fontSize: fonts.caption,
    color: colors.primaryText,
    marginRight: scale(8),
  },
  lineItemAmount: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  moreItemsText: {
    fontSize: fonts.xs,
    color: colors.secondaryText,
    marginTop: scale(4),
  },
  saveButton: {
    backgroundColor: colors.primaryButton,
    paddingVertical: scale(14),
    borderRadius: scale(8),
    alignItems: 'center',
    marginTop: scale(12),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.primaryButtonText,
    fontSize: fonts.button,
    fontWeight: '600',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(16),
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: fonts.header,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: scale(16),
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  modalItemText: {
    fontSize: fonts.body,
    color: colors.primaryText,
  },
  modalCloseButton: {
    backgroundColor: colors.primaryButton,
    padding: scale(14),
    borderRadius: scale(8),
    alignItems: 'center',
    marginTop: scale(16),
  },
  modalCloseText: {
    color: colors.primaryButtonText,
    fontSize: fonts.button,
    fontWeight: '600',
  },
  // Currency item styles
  currencyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyItemSymbol: {
    fontSize: fonts.xl,
    fontWeight: '600',
    color: colors.primaryText,
    width: scale(30),
  },
  currencyItemDetails: {
    marginLeft: scale(12),
  },
  currencyItemCode: {
    fontSize: fonts.body,
    fontWeight: '600',
    color: colors.primaryText,
  },
  currencyItemName: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    marginTop: scale(2),
  },
  // Date picker styles
  datePickerModal: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(16),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  datePicker: {
    height: scale(200),
  },
  datePickerDone: {
    backgroundColor: colors.primaryButton,
    padding: scale(14),
    borderRadius: scale(8),
    alignItems: 'center',
    marginTop: scale(8),
  },
  datePickerDoneText: {
    color: colors.primaryButtonText,
    fontSize: fonts.button,
    fontWeight: '600',
  },
  // Line items modal styles
  lineItemModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  lineItemModalLeft: {
    flex: 1,
    marginRight: scale(12),
  },
  lineItemModalDesc: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '500',
  },
  lineItemModalQty: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    marginTop: scale(2),
  },
  lineItemModalTotal: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '600',
  },
  lineItemsTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(16),
    borderTopWidth: 2,
    borderTopColor: colors.primaryButton,
    marginTop: scale(8),
  },
  lineItemsTotalLabel: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '700',
  },
  lineItemsTotalValue: {
    fontSize: fonts.body,
    color: colors.primaryButton,
    fontWeight: '700',
  },
  // Image modal styles
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: scale(50),
    right: scale(20),
    zIndex: 1,
  },
  fullReceiptImage: {
    width: '90%',
    height: '80%',
  },
  // Destination modal styles
  destinationModalContainer: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(16),
    paddingBottom: scale(32),
  },
  destinationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(12),
    backgroundColor: colors.background,
    borderRadius: scale(12),
    marginBottom: scale(10),
  },
  destinationIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationTextContainer: {
    flex: 1,
    marginLeft: scale(12),
  },
  destinationTitle: {
    fontSize: fonts.body,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: scale(2),
  },
  destinationSubtitle: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
  },
  disabledText: {
    color: colors.secondaryText,
    opacity: 0.5,
  },
  // Groups modal styles
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: fonts.body,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: scale(2),
  },
  groupMembers: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
  },
  emptyGroupsText: {
    textAlign: 'center',
    fontSize: fonts.body,
    color: colors.secondaryText,
    paddingVertical: scale(20),
  },
});

export default ScanReviewScreen;
