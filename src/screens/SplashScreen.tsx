import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, Animated, Text, Easing } from 'react-native';
import { wp, hp } from '../utils/deviceDimensions';

interface SplashScreenProps {
  onAnimationEnd: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationEnd }) => {
  // Panel animation values
  const leftPanelX = useRef(new Animated.Value(0)).current;
  const rightPanelX = useRef(new Animated.Value(0)).current;
  const leftPanelY = useRef(new Animated.Value(0)).current;
  const rightPanelY = useRef(new Animated.Value(0)).current;

  // Logo and text animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoZoom = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.8)).current;

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Step 1: Light green slides left, dark green slides right (horizontal) - FASTER
    Animated.parallel([
      Animated.timing(leftPanelX, {
        toValue: -screenWidth / 2,
        duration: 300, // Reduced from 500ms to 300ms
        useNativeDriver: true,
      }),
      Animated.timing(rightPanelX, {
        toValue: screenWidth / 2,
        duration: 300, // Reduced from 500ms to 300ms
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Step 2: Light green slides up, dark green slides down (vertical) - FASTER
      Animated.parallel([
        Animated.timing(leftPanelY, {
          toValue: -screenHeight / 2,
          duration: 300, // Reduced from 500ms to 300ms
          useNativeDriver: true,
        }),
        Animated.timing(rightPanelY, {
          toValue: screenHeight / 2,
          duration: 300, // Reduced from 500ms to 300ms
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 3: Show logo with smooth scale animation
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 40,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Step 4: Smooth zoom in and zoom out animation
          Animated.sequence([
            Animated.timing(logoZoom, {
              toValue: 1.15, // Zoom in slightly
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(logoZoom, {
              toValue: 1, // Zoom back to normal
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Step 5: Show app name with scale effect
            Animated.parallel([
              Animated.timing(textOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.spring(textScale, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
              }),
            ]).start();
          });
        });
      });
    });

    // End splash screen after all animations
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onAnimationEnd());
    }, 2800); // Extended to 2.8 seconds for complete animation sequence

    return () => {
      clearTimeout(timer);
    };
  }, [onAnimationEnd]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Left Panel - Light green/mint - animates left then up */}
      <Animated.View
        style={[
          styles.leftPanel,
          {
            transform: [
              { translateX: leftPanelX },
              { translateY: leftPanelY },
            ],
          },
        ]}
      />

      {/* Right Panel - Dark teal - animates right then down */}
      <Animated.View
        style={[
          styles.rightPanel,
          {
            transform: [
              { translateX: rightPanelX },
              { translateY: rightPanelY },
            ],
          },
        ]}
      />

      {/* Logo and Text - centered together */}
      <View style={styles.contentContainer}>
        {/* Logo - appears after panels animate */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: Animated.multiply(logoScale, logoZoom) }
              ],
            },
          ]}
        >
          <Image
            source={require('../../asset/Images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Name - appears after logo */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }],
            },
          ]}
        >
          <View style={styles.appNameContainer}>
            <Text style={styles.appNameKharcha}>Kharcha</Text>
            <Text style={styles.appNameSplit}>Split</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background behind panels
  },
  leftPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth / 2,
    backgroundColor: '#8FD5C2', // Light mint/green color from Figma
  },
  rightPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: screenWidth / 2,
    backgroundColor: '#1A5F5F', // Dark teal color from Figma
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: wp ? wp(35) : 140,
    height: wp ? wp(35) : 140,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 12, // Tight gap between logo and text
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNameKharcha: {
    fontSize: wp ? wp(9) : 36,
    fontWeight: '700',
    color: '#1A5F5F', // Dark teal color
    letterSpacing: 2,
  },
  appNameSplit: {
    fontSize: wp ? wp(9) : 36,
    fontWeight: '700',
    color: '#E89F3C', // Orange/golden color from logo
    letterSpacing: 2,
  },
});