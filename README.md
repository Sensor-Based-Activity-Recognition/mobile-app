# Activity Recognition App

Our mobile app for activity recognition.

## Why React Native?

React Native is a suitable choice for our Sensor-Based Activity Recognition app due to several advantages:

- Firstly, it offers cross-platform compatibility, allowing the app to run on both iOS and Android devices. 
- Secondly, React Native provides a JavaScript-based development environment, enabling us to write code once and reuse it across platforms, saving time and effort.
- Thirdly, React Native provides access to a wide range of native device functionalities, including sensor data collection, through various community-supported libraries. This allows for efficient sensor integration and accurate activity recognition.

Compared to other cross-platform frameworks, React Native's performance is closer to that of native apps since it uses native components and APIs, resulting in a smoother user experience. Additionally, React Native's large and active community ensures ongoing support, frequent updates, and a wealth of resources for developers.

### Setup
- Install Node.js (https://nodejs.org/en/download/)
- Install this project's dependencies by running `npm install` in the project root directory

## How to run

See this section for how to run the app on your device or emulator.

### Android

**Pre-requisites:**

- Android Studio
- JRE 16/17 (Via Android Studio: Gradle Settings, then open Gradle JRE dropdown and select "Download JDK")

Create ENV Variables in .bashrc or .zshrc (update paths to your own):

- `export JAVA_HOME=/Users/yvokeller/Library/Java/JavaVirtualMachines/openjdk-20.0.1/Contents/Home`
- `export PATH=$PATH:/Users/yvokeller/Library/Android/sdk/platform-tools`

**Run instructions for Android:**

- Have an Android emulator running (quickest way to get started), or a device connected.
- `npx react-native run-android`

### iOS

**Pre-requisites:**

- Install Xcode
- Add your Apple ID to Xcode (Xcode -> Preferences -> Accounts)
- Install CocoaPods: `sudo gem install cocoapods`
- Install pods: `cd ios && pod install`

**Run instructions for iOS:**

- `npx react-native run-ios`
- `npx react-native run-ios --device "itsfrdm"` (run on specific physical device)

or

- Open ActivityRecognitionApp/ios/ActivityRecognitionApp.xcworkspace in Xcode or run `xed -b ios`
- Hit the Run button

**Run instructions for macOS:**

- See [https://aka.ms/ReactNativeGuideMacOS](https://aka.ms/ReactNativeGuideMacOS) for the latest up-to-date instructions.

## XCode

List available devices

iOS:
- `xcrun simctl list devices`

Android:
- `adb devices`
- `npx react-native run-android --deviceId adb-R5CR202SXQE-fMiGjJ._adb-tls-connect._tcp.`