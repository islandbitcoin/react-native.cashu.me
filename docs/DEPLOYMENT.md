# Deployment Guide - Cashu Wallet

This document covers building, testing, and deploying the Cashu Wallet to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Native Module Compilation](#native-module-compilation)
- [Build Configuration](#build-configuration)
- [iOS Deployment](#ios-deployment)
- [Android Deployment](#android-deployment)
- [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Development Environment

**macOS (for iOS development)**:
- Xcode 14.3 or later
- CocoaPods 1.12 or later
- Ruby 2.7 or later

**All platforms**:
- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- React Native CLI 2.0.1+
- Java Development Kit (JDK) 17 (for Android)

**Android Development**:
- Android Studio Electric Eel or later
- Android SDK 33
- Android NDK 25.1.8937393 (for native modules)

### Verify Installation

```bash
# Node and npm
node --version  # v18.0.0+
npm --version   # v9.0.0+

# React Native CLI
npx react-native --version

# iOS (macOS only)
xcodebuild -version
pod --version

# Android
java --version  # 17.0.0+
echo $ANDROID_HOME  # Should point to Android SDK
```

---

## Environment Setup

### 1. Install Dependencies

```bash
# Install JavaScript dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios
pod install
cd ..
```

### 2. Environment Variables

Create `.env` files for each environment:

**.env.development**:
```bash
# Development environment
ENV=development
API_TIMEOUT=10000
ENABLE_LOGGING=true
ENABLE_CRASHLYTICS=false

# Default mint (for testing)
DEFAULT_MINT_URL=https://testnut.cashu.space
```

**.env.staging**:
```bash
# Staging environment
ENV=staging
API_TIMEOUT=15000
ENABLE_LOGGING=true
ENABLE_CRASHLYTICS=true

# Staging mint
DEFAULT_MINT_URL=https://staging.cashu.space
```

**.env.production**:
```bash
# Production environment
ENV=production
API_TIMEOUT=30000
ENABLE_LOGGING=false
ENABLE_CRASHLYTICS=true

# Users will configure their own mints
DEFAULT_MINT_URL=
```

### 3. Configure react-native-config

```bash
# Install config package
npm install react-native-config
npx pod-install
```

**Usage in code**:
```typescript
import Config from 'react-native-config';

const timeout = Config.API_TIMEOUT;
const mintUrl = Config.DEFAULT_MINT_URL;
```

---

## Native Module Compilation

Several modules require native compilation: SQLite, crypto, NFC, Bluetooth.

### iOS Native Setup

1. **Update Podfile** (`ios/Podfile`):
```ruby
platform :ios, '13.4'

target 'CashuWallet' do
  # React Native core
  use_react_native!

  # Native modules
  pod 'react-native-quick-sqlite', :path => '../node_modules/react-native-quick-sqlite'
  pod 'react-native-quick-crypto', :path => '../node_modules/react-native-quick-crypto'
  pod 'react-native-ble-plx', :path => '../node_modules/react-native-ble-plx'

  # NFC capability
  pod 'react-native-nfc-manager', :path => '../node_modules/react-native-nfc-manager'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
    end
  end
end
```

2. **Enable Capabilities** in Xcode:
   - Open `ios/CashuWallet.xcworkspace`
   - Select project → Signing & Capabilities
   - Add: Near Field Communication Tag Reading
   - Add: Background Modes (Bluetooth accessories, Background fetch)

3. **Update Info.plist** (`ios/CashuWallet/Info.plist`):
```xml
<key>NFCReaderUsageDescription</key>
<string>We need NFC access to receive offline payments</string>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to send/receive offline payments</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to send/receive offline payments</string>

<key>NSCameraUsageDescription</key>
<string>We need camera access to scan QR codes</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to save payment QR codes</string>
```

4. **Install and Build**:
```bash
cd ios
pod install
cd ..
npx react-native run-ios --configuration Release
```

### Android Native Setup

1. **Update build.gradle** (`android/app/build.gradle`):
```gradle
android {
    compileSdkVersion 33
    buildToolsVersion "33.0.0"
    ndkVersion "25.1.8937393"

    defaultConfig {
        applicationId "com.cashuwallet"
        minSdkVersion 24
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"

        // Enable native crypto
        packagingOptions {
            pickFirst 'lib/x86/libc++_shared.so'
            pickFirst 'lib/x86_64/libc++_shared.so'
            pickFirst 'lib/armeabi-v7a/libc++_shared.so'
            pickFirst 'lib/arm64-v8a/libc++_shared.so'
        }
    }

    splits {
        abi {
            reset()
            enable true
            universalApk false
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
}

dependencies {
    // React Native
    implementation "com.facebook.react:react-native:+"

    // Native modules
    implementation project(':react-native-quick-sqlite')
    implementation project(':react-native-quick-crypto')
    implementation project(':react-native-ble-plx')
    implementation project(':react-native-nfc-manager')
}
```

2. **Update AndroidManifest.xml** (`android/app/src/main/AndroidManifest.xml`):
```xml
<manifest>
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.NFC" />

    <!-- NFC feature -->
    <uses-feature
        android:name="android.hardware.nfc"
        android:required="false" />

    <!-- Bluetooth feature -->
    <uses-feature
        android:name="android.hardware.bluetooth_le"
        android:required="false" />

    <application
        android:name=".MainApplication"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme">

        <activity android:name=".MainActivity"
            android:configChanges="keyboard|keyboardHidden|orientation|screenSize"
            android:windowSoftInputMode="adjustResize"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

3. **Build**:
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

---

## Build Configuration

### iOS Build Types

**Debug Build** (for development):
```bash
npx react-native run-ios --configuration Debug
```

**Release Build** (for testing production):
```bash
npx react-native run-ios --configuration Release
```

**Archive for App Store**:
1. Open Xcode → Product → Archive
2. Validate → Distribute App
3. App Store Connect → Upload

### Android Build Types

**Debug Build**:
```bash
npx react-native run-android --variant=debug
```

**Release Build**:
```bash
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

**Bundle for Play Store**:
```bash
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## iOS Deployment

### 1. Configure Signing

In Xcode:
1. Select project → Signing & Capabilities
2. Team: Select your Apple Developer account
3. Bundle Identifier: `com.cashuwallet` (or your ID)
4. Provisioning Profile: Automatic (recommended) or Manual

### 2. Update Version Numbers

**ios/CashuWallet/Info.plist**:
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

Version format: `MAJOR.MINOR.PATCH` (e.g., 1.0.0, 1.1.0, 2.0.0)
Build number: Increment for each build (1, 2, 3, ...)

### 3. Build for TestFlight

```bash
# 1. Clean build folder
cd ios
xcodebuild clean -workspace CashuWallet.xcworkspace -scheme CashuWallet

# 2. Archive
xcodebuild archive \
  -workspace CashuWallet.xcworkspace \
  -scheme CashuWallet \
  -configuration Release \
  -archivePath ./build/CashuWallet.xcarchive

# 3. Export IPA
xcodebuild -exportArchive \
  -archivePath ./build/CashuWallet.xcarchive \
  -exportPath ./build \
  -exportOptionsPlist ExportOptions.plist
```

**ExportOptions.plist**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
```

### 4. Upload to App Store Connect

```bash
# Using Transporter app (GUI)
# or xcrun altool (CLI):

xcrun altool --upload-app \
  --type ios \
  --file ./build/CashuWallet.ipa \
  --username "your@email.com" \
  --password "app-specific-password"
```

### 5. Submit for Review

1. Log in to App Store Connect
2. Select your app → TestFlight or App Store
3. Add metadata (screenshots, description, keywords)
4. Submit for review

**App Store Guidelines to Note**:
- Cryptocurrency apps must have appropriate disclaimers
- Privacy policy required (handle user funds)
- Export compliance (cryptography usage)

---

## Android Deployment

### 1. Generate Signing Key

```bash
# Generate keystore (one time)
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore cashu-wallet.keystore \
  -alias cashu-wallet-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Store credentials securely
# NEVER commit keystore to git
```

### 2. Configure Signing

**android/gradle.properties**:
```properties
CASHU_UPLOAD_STORE_FILE=cashu-wallet.keystore
CASHU_UPLOAD_KEY_ALIAS=cashu-wallet-key
CASHU_UPLOAD_STORE_PASSWORD=your_store_password
CASHU_UPLOAD_KEY_PASSWORD=your_key_password
```

**android/app/build.gradle**:
```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('CASHU_UPLOAD_STORE_FILE')) {
                storeFile file(CASHU_UPLOAD_STORE_FILE)
                storePassword CASHU_UPLOAD_STORE_PASSWORD
                keyAlias CASHU_UPLOAD_KEY_ALIAS
                keyPassword CASHU_UPLOAD_KEY_PASSWORD
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. ProGuard Configuration

**android/app/proguard-rules.pro**:
```proguard
# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Cashu
-keep class com.cashuwallet.** { *; }

# SQLite
-keep class com.reactnativequicksqlite.** { *; }

# Crypto
-keep class com.margelo.** { *; }

# BLE
-keep class com.polidea.reactnativeble.** { *; }

# NFC
-keep class community.revteltech.nfc.** { *; }

# Hermes
-keep class com.facebook.jni.** { *; }
```

### 4. Build Release APK/AAB

```bash
cd android

# Clean build
./gradlew clean

# Build release APK
./gradlew assembleRelease

# Build release bundle (for Play Store)
./gradlew bundleRelease
```

**Output files**:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### 5. Upload to Play Store

1. **Play Console** → All apps → Create app
2. **App content**:
   - Privacy policy URL
   - Data safety (financial app, handles user funds)
   - Target audience (18+)
   - Cryptocurrency disclaimer

3. **Production** → Create new release:
   - Upload AAB file
   - Release notes
   - Version name: 1.0.0

4. **Review and rollout**:
   - Send for review
   - Monitor rollout percentage
   - Full rollout once stable

---

## Release Process

### Version Bumping

Use semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

```bash
# Update package.json
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0

# Update native versions
# iOS: Xcode → General → Version & Build
# Android: android/app/build.gradle → versionCode & versionName
```

### Release Checklist

- [ ] All tests passing (`npm test`)
- [ ] No console errors or warnings
- [ ] Updated version numbers (package.json, iOS, Android)
- [ ] Updated CHANGELOG.md
- [ ] Code review completed
- [ ] Security audit completed
- [ ] Performance tested
- [ ] Offline mode tested
- [ ] Multi-mint tested
- [ ] All transports tested (NFC, BLE, QR)
- [ ] Test builds working (iOS + Android)
- [ ] Privacy policy updated
- [ ] App Store screenshots current
- [ ] Release notes written

### Hotfix Process

For critical bugs in production:

1. **Create hotfix branch**:
```bash
git checkout -b hotfix/1.0.1 v1.0.0
```

2. **Fix the issue**:
```bash
# Make minimal changes
git commit -m "fix: critical security issue"
```

3. **Test thoroughly**:
```bash
npm test
# Manual testing in production-like environment
```

4. **Bump version**:
```bash
npm version patch
```

5. **Build and deploy**:
```bash
# iOS
npx react-native run-ios --configuration Release

# Android
cd android && ./gradlew bundleRelease
```

6. **Submit expedited review**:
   - App Store: Request expedited review (critical fixes only)
   - Play Store: Staged rollout (5% → 20% → 50% → 100%)

7. **Merge back**:
```bash
git checkout main
git merge hotfix/1.0.1
git push origin main
git push origin v1.0.1
```

---

## Troubleshooting

### Common Build Issues

**Issue: "Command PhaseScriptExecution failed with a nonzero exit code"**
```bash
# Solution: Clean build folder
cd ios
rm -rf build
pod deintegrate && pod install
cd ..
npx react-native run-ios
```

**Issue: "Unable to resolve module"**
```bash
# Solution: Clear Metro cache
npm start -- --reset-cache
```

**Issue: "Execution failed for task ':app:mergeReleaseResources'"**
```bash
# Solution: Clean Android build
cd android
./gradlew clean
rm -rf app/build
./gradlew assembleRelease
```

**Issue: Native module not found**
```bash
# Solution: Reinstall and rebuild
rm -rf node_modules
npm install
cd ios && pod install && cd ..
npx react-native run-ios
```

### Performance Issues

**Slow app startup**:
- Enable Hermes (should be default)
- Check bundle size: `npx react-native bundle --platform ios --dev false`
- Profile startup with Xcode Instruments

**High memory usage**:
- Profile with Android Studio Profiler
- Check for memory leaks in components
- Optimize large lists with FlatList

**Network latency**:
- Check mint connection timeout
- Test with network throttling
- Verify offline mode is working

### Crash Debugging

**iOS crashes**:
```bash
# View crash logs in Xcode
Window → Devices and Simulators → View Device Logs

# Symbolicate crash logs
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
./ios/build/Release-iphoneos/CashuWallet.app.dSYM
```

**Android crashes**:
```bash
# View crash logs
adb logcat | grep "AndroidRuntime"

# Generate crash report
adb bugreport crash-report.zip
```

### Security Audit

Before production release:

1. **Static analysis**:
```bash
npm audit
npm audit fix
```

2. **Dependency check**:
```bash
npx snyk test
```

3. **Code review**:
   - No hardcoded secrets
   - Secure storage used for keys
   - Input validation present
   - No sensitive data in logs

4. **Penetration testing**:
   - Test mint communication
   - Test proof handling
   - Test offline mode edge cases
   - Test state reconciliation attacks

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-repo/cashu-wallet/issues
- Discord: https://discord.gg/cashu
- Email: support@cashuwallet.com

## Additional Resources

- [React Native Deployment Docs](https://reactnative.dev/docs/signed-apk-android)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Cashu Protocol](https://github.com/cashubtc/nuts)
