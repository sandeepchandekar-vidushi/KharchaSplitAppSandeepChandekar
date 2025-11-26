import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { typography } from '../utils/typography';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { PhotoLibraryPermissionHelper } from '../utils/PhotoLibraryPermissionHelper';
import { ocrApi, OCRResult } from '../services/api/ocrApi';

// ML Kit Text Recognition - optional, gracefully handle if not available
let TextRecognition: any = null;
let TextRecognitionScript: any = null;
try {
  const mlKit = require('@react-native-ml-kit/text-recognition');
  TextRecognition = mlKit.default;
  TextRecognitionScript = mlKit.TextRecognitionScript;
} catch (e) {
  console.log('[ScanScreen] ML Kit Text Recognition not available, will use backend OCR only');
}

interface ScanScreenProps {
  navigation: any;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
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
  };

  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleImageResponse = useCallback(async (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    if (response.assets && response.assets[0]) {
      const asset = response.assets[0];
      try {
        const imageUri = asset.uri;

        if (asset.base64) {
          const imageBase64 = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
          setCapturedImage(imageBase64);
          // Pass both base64 and URI for ML Kit
          await processImage(imageBase64, imageUri);
        } else if (imageUri) {
          // Convert URI to base64 for display and storage
          const base64Image = await convertImageToBase64(imageUri);
          setCapturedImage(base64Image);
          // Pass both base64 and URI for ML Kit
          await processImage(base64Image, imageUri);
        }
      } catch (error: any) {
        Alert.alert('Error', 'Failed to process image. Please try again.');
        console.error('Image processing error:', error);
      }
    }
  }, [navigation]);

  const convertImageToBase64 = (imageUri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      fetch(imageUri)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    });
  };

  const processImage = async (imageBase64: string, imageUri?: string) => {
    setScanning(true);
    try {
      let ocrResult: OCRResult = {
        lineItems: [],
        confidence: 0,
        suggestedCategory: 'Other',
        currency: 'INR',
      };
      let useOnDeviceOCR = true;

      // First try backend OCR with timeout
      try {
        console.log('[ScanScreen] Trying backend OCR...');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Backend OCR timeout')), 10000)
        );
        const backendResult = await Promise.race([
          ocrApi.scanBill(imageBase64),
          timeoutPromise,
        ]) as any;

        if (backendResult?.data?.confidence > 0) {
          // Backend OCR succeeded
          ocrResult = backendResult.data;
          useOnDeviceOCR = false;
          console.log('[ScanScreen] Backend OCR result:', ocrResult);
        }
      } catch (backendError: any) {
        console.log('[ScanScreen] Backend OCR failed or timed out:', backendError?.message);
      }

      if (useOnDeviceOCR) {
        // Backend unavailable, try ML Kit on-device OCR if available
        console.log('[ScanScreen] Using on-device OCR...');

        if (TextRecognition && imageUri) {
          try {
            // Use ML Kit Text Recognition - try Latin first (for English text)
            console.log('[ScanScreen] Using ML Kit on-device OCR...');
            let mlKitResult = await TextRecognition.recognize(imageUri, TextRecognitionScript?.LATIN || 0);
            let extractedText = mlKitResult?.text || '';

            // Also try Devanagari script for Hindi text on Indian bills
            if (TextRecognitionScript?.DEVANAGARI) {
              try {
                console.log('[ScanScreen] Also trying Devanagari script for Hindi text...');
                const devanagariResult = await TextRecognition.recognize(imageUri, TextRecognitionScript.DEVANAGARI);
                if (devanagariResult?.text) {
                  // Combine both results
                  extractedText = extractedText + '\n' + devanagariResult.text;
                }
              } catch (devErr) {
                console.log('[ScanScreen] Devanagari recognition not available');
              }
            }

            if (extractedText && extractedText.trim().length > 0) {
              console.log('[ScanScreen] ML Kit extracted text:', extractedText.substring(0, 300));

              // Parse the extracted text to get bill details
              ocrResult = ocrApi.parseOCRText(extractedText);
              console.log('[ScanScreen] Parsed OCR result:', JSON.stringify(ocrResult, null, 2));
            } else {
              console.log('[ScanScreen] ML Kit returned no text');
              ocrResult = {
                lineItems: [],
                confidence: 0,
                suggestedCategory: 'Other',
                currency: 'INR',
              };
            }
          } catch (mlKitError: any) {
            console.error('[ScanScreen] ML Kit error:', mlKitError);
            ocrResult = {
              lineItems: [],
              confidence: 0,
              suggestedCategory: 'Other',
              currency: 'INR',
            };
          }
        } else {
          // ML Kit not available - inform user to enter manually
          console.log('[ScanScreen] No OCR available, manual entry required');
          ocrResult = {
            lineItems: [],
            confidence: 0,
            suggestedCategory: 'Other',
            currency: 'INR',
          };
        }
      }

      // Navigate to review screen with extracted data
      navigation.navigate('ScanReview', {
        ocrResult: ocrResult,
        imageBase64: imageBase64,
      });

    } catch (error: any) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'Processing Error',
        'Failed to process the bill. Would you like to enter the details manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enter Manually',
            onPress: () => {
              navigation.navigate('ScanReview', {
                ocrResult: { lineItems: [], confidence: 0, suggestedCategory: 'Other', currency: 'INR' },
                imageBase64: imageBase64,
              });
            },
          },
        ]
      );
    } finally {
      setScanning(false);
      setCapturedImage(null);
    }
  };

  const handleScanBill = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as any,
      maxWidth: 1500,
      maxHeight: 2000,
      includeBase64: true,
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            PhotoLibraryPermissionHelper.handleCameraPermission(
              () => launchCamera(options, handleImageResponse),
              () => {
                // Permission denied
              }
            );
          } else if (buttonIndex === 2) {
            PhotoLibraryPermissionHelper.handlePhotoLibraryPermission(
              () => launchImageLibrary(options, handleImageResponse),
              () => {
                // Permission denied
              }
            );
          }
        }
      );
    } else {
      Alert.alert(
        'Scan Bill',
        'Choose how you want to capture the bill',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Camera',
            onPress: () => {
              PhotoLibraryPermissionHelper.handleCameraPermission(
                () => launchCamera(options, handleImageResponse),
                () => {
                  // Permission denied
                }
              );
            },
          },
          {
            text: 'Gallery',
            onPress: () => {
              PhotoLibraryPermissionHelper.handlePhotoLibraryPermission(
                () => launchImageLibrary(options, handleImageResponse),
                () => {
                  // Permission denied
                }
              );
            },
          },
        ]
      );
    }
  };

  const styles = createStyles(colors, scale, scaledFontSize);

  // Show scanning overlay
  if (scanning) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scanningOverlay}>
          {capturedImage && (
            <Image
              source={{ uri: capturedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.scanningContent}>
            <ActivityIndicator size="large" color={colors.primaryButton} />
            <Text style={styles.scanningText}>Analyzing bill...</Text>
            <Text style={styles.scanningSubtext}>
              Extracting invoice details, amounts, and items
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan Bill and Expense</Text>
        <View style={{ width: scaledFontSize.xl }} />
      </View>

      <View style={styles.content}>
        {/* Main Scan Button */}
        <View style={styles.scanSection}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScanBill}
            activeOpacity={0.8}
          >
            <View style={styles.scanIconContainer}>
              <MaterialIcons name="document-scanner" size={scale(64)} color="#FFFFFF" />
            </View>
            <Text style={styles.scanButtonText}>Tap to Scan Bill and Expense</Text>
            <Text style={styles.scanButtonSubtext}>
              Take a photo or select from gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Info */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>What we'll extract:</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="receipt-outline" size={scale(20)} color={colors.primaryButton} />
              </View>
              <Text style={styles.featureText}>Invoice Date</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="cash-outline" size={scale(20)} color={colors.primaryButton} />
              </View>
              <Text style={styles.featureText}>Total Amount</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="pricetag-outline" size={scale(20)} color={colors.primaryButton} />
              </View>
              <Text style={styles.featureText}>Auto-detect Category</Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Tips for best results:</Text>
          <Text style={styles.tipText}>• Ensure good lighting</Text>
          <Text style={styles.tipText}>• Keep the bill flat and in focus</Text>
          <Text style={styles.tipText}>• Include all edges of the receipt</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (
  colors: ReturnType<typeof useTheme>['colors'],
  scale: (size: number) => number,
  fonts: { [key: string]: number }
) => StyleSheet.create({
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
  content: {
    flex: 1,
    padding: scale(20),
  },
  scanSection: {
    alignItems: 'center',
    marginBottom: scale(24),
  },
  scanButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: scale(32),
    backgroundColor: colors.cardBackground,
    borderRadius: scale(20),
    borderWidth: 2,
    borderColor: colors.primaryButton + '40',
    borderStyle: 'dashed',
  },
  scanIconContainer: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: colors.primaryButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
    shadowColor: colors.primaryButton,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: scale(8),
    elevation: 8,
  },
  scanButtonText: {
    fontSize: fonts.lg,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: scale(4),
  },
  scanButtonSubtext: {
    fontSize: fonts.sm,
    color: colors.secondaryText,
  },
  featuresSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(16),
  },
  featuresTitle: {
    fontSize: fonts.base,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: scale(12),
  },
  featuresList: {
    gap: scale(12),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: colors.primaryButton + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  featureText: {
    fontSize: fonts.sm,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  tipsSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: scale(12),
    padding: scale(16),
  },
  tipsTitle: {
    fontSize: fonts.sm,
    fontWeight: '600',
    color: colors.secondaryText,
    marginBottom: scale(8),
  },
  tipText: {
    fontSize: fonts.xs,
    color: colors.secondaryText,
    marginBottom: scale(4),
  },
  // Scanning overlay styles
  scanningOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  scanningContent: {
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    padding: scale(32),
    borderRadius: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  scanningText: {
    fontSize: fonts.lg,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: scale(16),
  },
  scanningSubtext: {
    fontSize: fonts.sm,
    color: colors.secondaryText,
    marginTop: scale(8),
    textAlign: 'center',
  },
});

export default ScanScreen;
