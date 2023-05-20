import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Button, Text, useColorScheme, View, ScrollView } from 'react-native';
import axios from 'axios';
import { accelerometer, gyroscope, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";
import { Colors } from 'react-native/Libraries/NewAppScreen';

function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  type SensorData = {x: number, y: number, z: number, timestamp: number}[];

  const [accelerometerData, setAccelerometerData] = useState<SensorData>([]);
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>([]);
  const [activity, setActivity] = useState("");

  // Set interval for data updates
  setUpdateIntervalForType(SensorTypes.accelerometer, 100); // 10 Hz
  setUpdateIntervalForType(SensorTypes.gyroscope, 100); // 10 Hz

  const subscriptionAccelerometer = accelerometer.subscribe(({ x, y, z, timestamp }) =>
    setAccelerometerData(oldData => [...oldData, {x, y, z, timestamp}])
  );

  const subscriptionGyroscope = gyroscope.subscribe(({ x, y, z, timestamp }) =>
    setGyroscopeData(oldData => [...oldData, {x, y, z, timestamp}])
  );

  const sendDataToServer = async () => {
    subscriptionAccelerometer.unsubscribe();
    subscriptionGyroscope.unsubscribe();

    try {
      const response = await axios.post('https://your-api-url.com/endpoint', {
        accelerometer: accelerometerData,
        gyroscope: gyroscopeData
      });

      // Clear sensor data
      setAccelerometerData([]);
      setGyroscopeData([]);

      return response.data;
    } catch (error) {
      console.error(error);
    }
  };

  const recordAndSendData = async () => {
    setActivity("Recording data...");
    await new Promise<void>(resolve => setTimeout(() => resolve(), 10000));
    const activity = await sendDataToServer();
    setActivity(activity);
  };

  return (
    <SafeAreaView style={[backgroundStyle, styles.container]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={backgroundStyle.backgroundColor} />
      <View style={styles.sectionContainer}>
        <Button title="Start recording" onPress={recordAndSendData} />
        <Text style={isDarkMode ? styles.lightText : styles.darkText}>{activity}</Text>
      </View>
    </SafeAreaView>
  );
}

// Replace the styles object with the following
const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  lightText: {
    color: Colors.light,
  },
  darkText: {
    color: Colors.dark,
  },
});

export default App;
