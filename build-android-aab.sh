#!/bin/bash

# Build Android AAB (App Bundle) for KharchaSplit
# Version: 1.2.0

echo "🚀 Building Android App Bundle (AAB) for KharchaSplit..."
echo ""

# Set Java Home
export JAVA_HOME=/Users/schandekar/Library/Java/JavaVirtualMachines/openjdk-22.0.1/Contents/Home

# Navigate to android directory
cd "$(dirname "$0")/android"

# Clean previous build
echo "🧹 Cleaning previous build..."
./gradlew clean

# Build release AAB
echo "📦 Building release AAB..."
./gradlew bundleRelease

# Check if build was successful
if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📍 AAB Location:"
    echo "   $(pwd)/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "📊 File Size: $(du -h app/build/outputs/bundle/release/app-release.aab | cut -f1)"
    echo ""
    echo "🎯 Next Steps:"
    echo "   1. Upload to Google Play Console"
    echo "   2. App Version: 1.2.0 (versionCode: 4)"
    echo ""
else
    echo ""
    echo "❌ Build failed! Check the error messages above."
    echo ""
    exit 1
fi
