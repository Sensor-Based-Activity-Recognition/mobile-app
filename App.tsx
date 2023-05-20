import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Button, Text, useColorScheme, View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { accelerometer, gyroscope, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";
import { Colors } from 'react-native/Libraries/NewAppScreen';

type SensorData = {x: number, y: number, z: number, timestamp: number}[];

function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const [accelerometerData, setAccelerometerData] = useState<SensorData>([]);
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>([]);
  const [activity, setActivity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Move the subscriptions into a useEffect hook
  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, 100); // 10 Hz
    setUpdateIntervalForType(SensorTypes.gyroscope, 100); // 10 Hz

    const subscriptionAccelerometer = accelerometer.subscribe(({ x, y, z, timestamp }) =>
      setAccelerometerData(oldData => [...oldData, {x, y, z, timestamp}])
    );

    const subscriptionGyroscope = gyroscope.subscribe(({ x, y, z, timestamp }) =>
      setGyroscopeData(oldData => [...oldData, {x, y, z, timestamp}])
    );

    // Cleanup function to unsubscribe when component is unmounted
    return () => {
      subscriptionAccelerometer.unsubscribe();
      subscriptionGyroscope.unsubscribe();
    };
  }, []);

  const sendDataToServer = async () => {
    try {
      setActivity("Fetching result...");

      // TODO: implement API call to send data to server
      // const response = await axios.post('https://your-api-url.com/endpoint', {
      //   accelerometer: accelerometerData,
      //   gyroscope: gyroscopeData
      // });

      // For Now: Simulate API call
      // Simulate network delay
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
  
      // Generate random activity result
      const activities = ['Running', 'Walking', 'Standing'];
      const randomIndex = Math.floor(Math.random() * activities.length);
      const activityResult = activities[randomIndex];

      // Clear sensor data
      setAccelerometerData([]);
      setGyroscopeData([]);

      return activityResult;
      // return response.data;
    } catch (error) {
      console.error(error);
      return "Error";
    }
  };

  const recordAndSendData = async () => {
    setIsLoading(true);
    setActivity("Recording data...");
    setTimeout(async () => {
      const activity = await sendDataToServer();
      setActivity(activity);
      setIsLoading(false);
    }, 10000);

  };

  const formatCoordinate = (coordinate: number): string => {
    return coordinate.toFixed(4);
  };

  const latestAccelerometerData = accelerometerData[accelerometerData.length - 1];
  const latestGyroscopeData = gyroscopeData[gyroscopeData.length - 1];

  return (
    <SafeAreaView style={[backgroundStyle, styles.container]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={backgroundStyle.backgroundColor} />
      <View style={styles.sectionContainer}>
        <Text style={[isDarkMode ? styles.lightTitle : styles.darkTitle]}>Activity Recognition</Text>
        <Button title="Start recording" onPress={recordAndSendData} disabled={isLoading} />
        {isLoading && (
          <ActivityIndicator size="small" color={isDarkMode ? Colors.light : Colors.dark} style={styles.loader} />
        )}
        <Text style={[styles.activityText, { color: isDarkMode ? Colors.light : Colors.dark }]}>{activity}</Text>
        <Text style={[styles.sensorText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
          Accelerometer
        </Text>
        {latestAccelerometerData ? (
          <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
            X: {formatCoordinate(latestAccelerometerData.x)}, Y: {formatCoordinate(latestAccelerometerData.y)}, Z: {formatCoordinate(latestAccelerometerData.z)}
          </Text>
        ) : (
          <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
            No accelerometer data
          </Text>
        )}
        <Text style={[styles.sensorText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
          Gyroscope
        </Text>
        {latestGyroscopeData ? (
          <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
            X: {formatCoordinate(latestGyroscopeData.x)}, Y: {formatCoordinate(latestGyroscopeData.y)}, Z: {formatCoordinate(latestGyroscopeData.z)}
          </Text>
        ) : (
          <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
            No gyroscope data
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

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
  lightTitle: {
    color: Colors.light,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  darkTitle: {
    color: Colors.dark,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  activityText: {
    fontSize: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  sensorText: {
    marginBottom: 10,
    fontWeight: 'bold',
  },
  coordinateText: {
    fontSize: 14,
    marginBottom: 5,
  },
  loader: {
    marginVertical: 20,
  },
});

export default App;
