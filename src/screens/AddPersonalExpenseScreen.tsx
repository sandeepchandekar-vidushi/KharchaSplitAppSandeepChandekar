import React, { useState, useEffect } from "react";
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
  UIManager,
  LayoutAnimation,
  Platform,
} from "react-native";

import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from "react-native-safe-area-context";
import { typography } from '../utils/typography';
// import { firebaseService, PersonalExpense } from '../services/firebaseService'; // MIGRATED to PostgreSQL
import { useAuth } from '../context/AuthContext';
import { pickReceiptImage, formatFileSize, validateReceiptImage } from '../utils/imageUtils';
import { PhotoLibraryPermissionHelper } from '../utils/PhotoLibraryPermissionHelper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from "react-native-vector-icons/Ionicons";
import { personalExpenseApi } from '../services/api/personalExpenseApi';
import { activityApi } from '../services/api/activityApi';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AddPersonalExpenseScreenProps {
  route?: {
    params?: {
      onReturn?: () => void;
    }
  };
  navigation: any;
}

export const AddPersonalExpenseScreen: React.FC<AddPersonalExpenseScreenProps> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();

  // Responsive setup
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
    headerLarge: scale(typography.text.headerLarge.fontSize),
    title: scale(typography.text.title.fontSize),
    subtitle: scale(typography.text.subtitle.fontSize),
    body: scale(typography.text.body.fontSize),
    caption: scale(typography.text.caption.fontSize),
    button: scale(typography.text.button.fontSize),
  };

  // State declarations
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState({ code: "INR", symbol: "₹" });
  const [loading, setLoading] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptSize, setReceiptSize] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [otherCategoryName, setOtherCategoryName] = useState("");

  const categories = [
    { id: 1, name: "Food", emoji: "🍽️", color: "#FEF3C7" },
    { id: 2, name: "Transportation", emoji: "🚗", color: "#FECACA" },
    { id: 3, name: "Shopping", emoji: "🛍️", color: "#E0E7FF" },
    { id: 4, name: "Drinks", emoji: "🍺", color: "#FED7AA" },
    { id: 5, name: "Entertainment", emoji: "🎬", color: "#F3E8FF" },
    { id: 6, name: "Health", emoji: "🏥", color: "#FECACA" },
    { id: 7, name: "Other", emoji: "📝", color: "#F3F4F6" },
  ];

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

  // Set default currency from user's preferred currency
  useEffect(() => {
    if (user?.preferredCurrency) {
      const userCurrency = currencies.find(c => c.code === user.preferredCurrency);
      if (userCurrency) {
        setSelectedCurrency({ code: userCurrency.code, symbol: userCurrency.symbol });
      }
    }
  }, [user?.preferredCurrency]);

  const handleUploadReceipt = () => {
    PhotoLibraryPermissionHelper.handlePhotoLibraryPermission(
      () => {
        pickReceiptImage(
          (image) => {
            setReceiptImage(image.base64);
            setReceiptSize(image.size);
          },
          (error) => {
            Alert.alert('Error', error);
          }
        );
      },
      () => {
        // Permission denied - do nothing
      }
    );
  };

  const handleRemoveReceipt = () => {
    Alert.alert(
      'Remove Receipt',
      'Are you sure you want to remove the receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setReceiptImage(null);
            setReceiptSize(0);
          }
        },
      ]
    );
  };

  const handleSave = async () => {
    // Validations
    if (!description.trim()) return Alert.alert("Error", "Please enter a description");
    if (!amount.trim() || parseFloat(amount) <= 0) return Alert.alert("Error", "Please enter a valid amount");
    if (!selectedCategory) return Alert.alert("Error", "Please select a category");

    if (selectedCategory?.name === 'Other' && !otherCategoryName.trim()) {
      return Alert.alert("Error", "Please specify a name for the 'Other' category");
    }

    if (!user?.id) {
      return Alert.alert("Error", "User information is missing");
    }

    // Validate receipt if present
    if (receiptImage) {
      const validation = validateReceiptImage(receiptImage);
      if (!validation.valid) {
        return Alert.alert('Error', validation.error || 'Invalid receipt image');
      }
    }

    setLoading(true);
    try {
      const totalAmount = parseFloat(amount);
      const categoryName = selectedCategory.name === 'Other' ? (otherCategoryName || 'Other') : selectedCategory.name;

      // Try PostgreSQL backend first
      let createdExpenseId: string | null = null;
      try {
        console.log('Creating personal expense in PostgreSQL backend...');

        const response = await personalExpenseApi.createPersonalExpense({
          description: description.trim(),
          amount: totalAmount,
          currency: selectedCurrency.code,
          category: categoryName,
          receiptBase64: receiptImage?.startsWith('data:') ? receiptImage : undefined,
          notes: notes.trim() || undefined,
          expenseDate: expenseDate.toISOString(),
        });

        if (response.success) {
          createdExpenseId = response.data.id;
          console.log('Personal expense created successfully in PostgreSQL:', createdExpenseId);

          // Create activity record for this personal expense
          try {
            await activityApi.createActivity({
              userId: user.id,
              activityType: 'personal_expense_added',
              entityType: 'personal_expense',
              entityId: createdExpenseId,
              title: `Personal: ${description.trim()}`,
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
        console.error('PostgreSQL backend error:', backendError.message);
        throw backendError; // Re-throw to be caught by outer catch
      }

      Alert.alert("Success", "Personal expense saved successfully", [
        {
          text: "OK",
          onPress: () => {
            // Call onReturn callback if provided
            if (route?.params?.onReturn) {
              route.params.onReturn();
            }
            navigation.goBack();
          }
        },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save expense");
    } finally {
      setLoading(false);
    }
  };

  const handleSetCategory = (category: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(category);
    setShowCategoryModal(false);

    if (category.name !== 'Other') {
      setOtherCategoryName("");
    }
  };

  const styles = createStyles(colors, scale, scaledFontSize);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={scaledFontSize.xl} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Personal Expense</Text>
        <View style={{ width: scaledFontSize.xl }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: scale(100) }}>

        {/* Description/Category Row */}
        <View style={styles.rowInputContainer}>
          <View style={styles.descriptionInputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter description"
              placeholderTextColor={colors.secondaryText}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.categoryInputContainer}>
            <Text style={styles.inputLabel}>Category</Text>
            <TouchableOpacity
              style={styles.categoryDropdown}
              onPress={() => setShowCategoryModal(true)}
            >
              <View style={styles.dropdownContent}>
                {selectedCategory ? (
                  <Text style={styles.categoryDropdownText} numberOfLines={1}>
                    {selectedCategory.emoji} {selectedCategory.name}
                  </Text>
                ) : (
                  <Text style={styles.categoryDropdownPlaceholder}>Select...</Text>
                )}
                <Ionicons name="chevron-down" size={scaledFontSize.lg} style={styles.dropdownIcon} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conditional "Specify Other" TextInput */}
        {selectedCategory?.name === 'Other' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Specify "Other"</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Utilities, Rent, etc."
              placeholderTextColor={colors.secondaryText}
              value={otherCategoryName}
              onChangeText={setOtherCategoryName}
              autoFocus={true}
            />
          </View>
        )}

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

        {/* Date Picker */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Date</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={scaledFontSize.lg} color={colors.primaryText} />
            <Text style={styles.datePickerText}>
              {expenseDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </Text>
            <Ionicons name="chevron-down" size={scaledFontSize.lg} style={styles.dropdownIcon} />
          </TouchableOpacity>
        </View>

        {/* Date Picker - Modal for iOS, inline for Android */}
        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModalBackdrop}>
              <View style={styles.datePickerModalContainer}>
                <View style={styles.datePickerModalHeader}>
                  <Text style={styles.datePickerModalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Ionicons name="close" size={scaledFontSize.xl} color={colors.primaryText} />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={expenseDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setExpenseDate(selectedDate);
                    }
                  }}
                  maximumDate={new Date()}
                  style={styles.datePickerIOS}
                />
                <TouchableOpacity
                  style={styles.datePickerDoneButton}
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
                if (selectedDate) {
                  setExpenseDate(selectedDate);
                }
              }}
              maximumDate={new Date()}
            />
          )
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

        {/* Receipt Upload Section */}
        <View style={styles.receiptContainer}>
          {!receiptImage ? (
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadReceipt}>
              <Ionicons name="receipt-outline" size={scaledFontSize.lg} color={colors.primaryText} />
              <Text style={styles.uploadText}>Upload Receipt</Text>
              <Text style={styles.uploadHint}>Max 3MB • JPEG, PNG</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.receiptPreview}>
              <View style={styles.receiptInfo}>
                <Ionicons name="receipt" size={scaledFontSize.lg} color={colors.primaryButton} />
                <View style={styles.receiptDetails}>
                  <Text style={styles.receiptText}>Receipt Uploaded</Text>
                  <Text style={styles.receiptSize}>{formatFileSize(receiptSize)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleRemoveReceipt}>
                <Ionicons name="close-circle" size={scaledFontSize.xl} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.primaryButtonText} /> : <Text style={styles.buttonText}>Save Expense</Text>}
        </TouchableOpacity>
      </ScrollView>

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
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSetCategory(item)}>
                  <Text style={styles.modalItemText}>
                    {item.emoji}  {item.name}
                  </Text>
                  {selectedCategory?.id === item.id && (
                    <Ionicons name="checkmark" size={scaledFontSize.xl} color={colors.primaryButton} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCategoryModal(false)}>
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
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCurrencyModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 0,
  },
  headerTitle: { fontSize: fonts.header, fontWeight: "600", color: colors.primaryText },
  scrollView: { padding: scale(16) },
  inputContainer: { marginBottom: scale(16) },
  inputLabel: { fontSize: fonts.caption, fontWeight: "500", color: colors.secondaryText, marginBottom: scale(8) },
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
  button: {
    backgroundColor: colors.primaryButton,
    paddingVertical: scale(14),
    borderRadius: scale(8),
    alignItems: "center",
    marginVertical: scale(12),
  },
  buttonText: { color: colors.primaryButtonText, fontSize: fonts.button, fontWeight: "600" },
  uploadButton: {
    flexDirection: 'row',
    gap: scale(10),
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    paddingVertical: scale(12),
    alignItems: "center",
    justifyContent: 'center',
    marginTop: scale(8),
    backgroundColor: colors.cardBackground,
  },
  uploadText: { fontSize: fonts.caption, color: colors.primaryText, fontWeight: '500' },

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
  currencyCode: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
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

  rowInputContainer: {
    flexDirection: 'row',
  },
  descriptionInputContainer: {
    flex: 2,
    marginRight: scale(8),
    marginBottom: scale(16),
  },
  categoryInputContainer: {
    flex: 1,
    marginBottom: scale(16),
  },
  categoryDropdown: {
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
  categoryDropdownText: {
    fontSize: fonts.body,
    color: colors.primaryText,
    flex: 1,
  },
  categoryDropdownPlaceholder: {
    fontSize: fonts.body,
    color: colors.secondaryText,
    flex: 1,
  },
  dropdownIcon: {
    color: colors.secondaryText,
    marginLeft: scale(4),
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBackground,
    borderRadius: scale(8),
    backgroundColor: colors.cardBackground,
    paddingHorizontal: scale(12),
    paddingVertical: scale(12),
    height: scale(48),
    gap: scale(8),
  },
  datePickerText: {
    flex: 1,
    fontSize: fonts.body,
    color: colors.primaryText,
  },
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
  receiptContainer: {
    marginTop: scale(8),
    marginBottom: scale(12),
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: scale(8),
    padding: scale(12),
    borderWidth: 1,
    borderColor: colors.primaryButton + '30',
  },
  receiptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptDetails: {
    marginLeft: scale(10),
  },
  receiptText: {
    fontSize: fonts.body,
    color: colors.primaryText,
    fontWeight: '500',
  },
  receiptSize: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    marginTop: scale(2),
  },
  uploadHint: {
    fontSize: fonts.caption,
    color: colors.secondaryText,
    marginTop: scale(4),
  },
  // Date Picker Modal Styles
  datePickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContainer: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(16),
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  datePickerModalTitle: {
    fontSize: fonts.header,
    fontWeight: '600',
    color: colors.primaryText,
  },
  datePickerIOS: {
    height: scale(200),
  },
  datePickerDoneButton: {
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
  // Currency Item Styles
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
});
