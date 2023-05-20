# Activity Recognition App

Our mobile app for activity recognition.

## How to run

See this section for how to run the app on your device or emulator.

### Android

**Pre-requisites:**

- Android Studio
- A JRE (Via Android Studio: Gradle Settings, then open Gradle JRE dropdown and select "Download JDK")

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

or

- Open ActivityRecognitionApp/ios/ActivityRecognitionApp.xcworkspace in Xcode or run `xed -b ios`
- Hit the Run button

**Run instructions for macOS:**

- See [https://aka.ms/ReactNativeGuideMacOS](https://aka.ms/ReactNativeGuideMacOS) for the latest up-to-date instructions.

## XCode

List available devices: `xcrun simctl list devices`
