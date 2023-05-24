import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Button, Text, useColorScheme, View, ActivityIndicator } from 'react-native';
import { accelerometer, gyroscope, magnetometer, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";
import { Colors } from 'react-native/Libraries/NewAppScreen';
import Share from 'react-native-share';
import RNFS from "react-native-fs";
import axios from 'axios';
import { SensorData, Payload, Reading } from './lib/types';
import { convertToCSV, transformData } from './lib/util';
import { Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const [model, setModel] = useState('CNN');
  const [activity, setActivity] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [accelerometerData, setAccelerometerData] = useState<SensorData>([]);
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>([]);
  const [displayAccelerometerData, setDisplayAccelerometerData] = useState<SensorData>([]);
  const [displayGyroscopeData, setDisplayGyroscopeData] = useState<SensorData>([]);
  const [magnetometerData, setMagnetometerData] = useState<SensorData>([]);
  const [displayMagnetometerData, setDisplayMagnetometerData] = useState<SensorData>([]);

  const accelerometerDataRef = useRef<SensorData>([]);
  const gyroscopeDataRef = useRef<SensorData>([]);
  const magnetometerDataRef = useRef<SensorData>([]);

  useEffect(() => {
    if(isLoading) {
      setUpdateIntervalForType(SensorTypes.accelerometer, 20); // 100 Hz (20 ms)
      setUpdateIntervalForType(SensorTypes.gyroscope, 20); // 100 Hz (20 ms)
      setUpdateIntervalForType(SensorTypes.magnetometer, 20); // 100 Hz (20 ms)

      const subscriptionAccelerometer = accelerometer.subscribe(({ x, y, z, timestamp }) => {
        timestamp = timestamp * 1000000
        if (Platform.OS === 'ios') {
          // multiply each value by 9.81 to get m/s^2
          x = x * 9.81;
          y = y * 9.81;
          z = z * 9.81;
        }
        accelerometerDataRef.current = [...accelerometerDataRef.current, {x, y, z, timestamp}];
        setAccelerometerData(accelerometerDataRef.current);
      });

      const subscriptionGyroscope = gyroscope.subscribe(({ x, y, z, timestamp }) => {
        timestamp = timestamp * 1000000
        gyroscopeDataRef.current = [...gyroscopeDataRef.current, {x, y, z, timestamp}];
        setGyroscopeData(gyroscopeDataRef.current);
      });

      const subscriptionMagnetometer = magnetometer.subscribe(({ x, y, z, timestamp }) => {
        timestamp = timestamp * 1000000
        magnetometerDataRef.current = [...magnetometerDataRef.current, {x, y, z, timestamp}];
        setMagnetometerData(magnetometerDataRef.current);
      });

      // Cleanup function to unsubscribe when component is unmounted
      return () => {
        subscriptionAccelerometer.unsubscribe();
        subscriptionGyroscope.unsubscribe();
        subscriptionMagnetometer.unsubscribe();
      };
    }
  }, [isLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayAccelerometerData(accelerometerDataRef.current);
      setDisplayGyroscopeData(gyroscopeDataRef.current);
      setDisplayMagnetometerData(magnetometerDataRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const recordAndSendData = async () => {
    // Clear sensor data
    accelerometerDataRef.current = [];
    gyroscopeDataRef.current = [];
    magnetometerDataRef.current = [];
    setAccelerometerData([]);
    setGyroscopeData([]);
    setMagnetometerData([]);
  
    // Collect sensor data for 10 seconds
    setIsLoading(true);
    setActivity("Recording data...");
    setTimeout(async () => {
      const sensorData: Payload = {
        accelerometer: accelerometerDataRef.current,
        gyroscope: gyroscopeDataRef.current,
        magnetometer: magnetometerDataRef.current,
      };
  
      const compressedData = await transformData(sensorData);

      setActivity("Fetching data...");
      const activity = await sendDataToServer(compressedData);

      setActivity(activity);
      setIsLoading(false);
    }, 16000);
  };

  const sendDataToServer = async (data: Uint8Array) => {
    try {
      // Call API
      console.log('Calling API using model:', model)
      const response = await axios.post(`https://sbar.fuet.ch/${model}`, data, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      // print info on response
      console.log("Response from server:", response.status, response.statusText);
      console.log(response.data)
      return JSON.stringify(response.data);
    } catch (error) {
      console.error(error);
      return "Error";
    }
  };

  const shareSensorData = async () => {
    const sensorData: Payload = {
      accelerometer: accelerometerDataRef.current,
      gyroscope: gyroscopeDataRef.current,
      magnetometer: magnetometerDataRef.current,
    };

    const csvData = await convertToCSV(sensorData);
  
    try {
      // Create a temporary directory for the file
      const tempDirPath = `${RNFS.TemporaryDirectoryPath}/sensor-data`;
      await RNFS.mkdir(tempDirPath);
  
      // Create a temporary file path
      const tempFilePath = `${tempDirPath}/sensor-data.csv`;
  
      // Write the sensor data to the file
      await RNFS.writeFile(tempFilePath, csvData, 'utf8');
  
      // Share the file using the react-native-share library
      await Share.open({ url: `file://${tempFilePath}` }).catch(error => console.log(error));
    } catch (error) {
      console.error(error);
    }
  };

  const latestDisplayAccelerometerData = displayAccelerometerData[displayAccelerometerData.length - 1];
  const latestDisplayGyroscopeData = displayGyroscopeData[displayGyroscopeData.length - 1];
  const latestDisplayMagnetometerData = displayMagnetometerData[displayMagnetometerData.length - 1];

  return (
    <SafeAreaView style={[backgroundStyle, styles.container]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={backgroundStyle.backgroundColor} />
      <Picker
        selectedValue={model}
        onValueChange={(value: string) => setModel(value)}
      >
        <Picker.Item label="CNN" value="CNN" />
        <Picker.Item label="HistGradientBoost" value="HGBC" />
      </Picker>
      <View style={styles.sectionContainer}>
        <Text style={[isDarkMode ? styles.lightTitle : styles.darkTitle]}>Activity Recognition</Text>
        <Button title="Start Recording" onPress={recordAndSendData} disabled={isLoading} />
        {isLoading && (
          <ActivityIndicator size="small" color={isDarkMode ? Colors.light : Colors.dark} style={styles.loader} />
        )}
        <Text style={[styles.activityText, { color: isDarkMode ? Colors.light : Colors.dark }]}>{activity}</Text>
        <SensorDataDisplay sensorName="Accelerometer" sensorReading={latestDisplayAccelerometerData} />
        <SensorDataDisplay sensorName="Gyroscope" sensorReading={latestDisplayGyroscopeData} />
        <SensorDataDisplay sensorName="Magnetometer" sensorReading={latestDisplayMagnetometerData} />
        <Button title="Share Sensor Data" onPress={shareSensorData}  disabled={isLoading} />
      </View>
    </SafeAreaView>
  );
}

interface SensorDataDisplayProps {
  sensorName: string;
  sensorReading: Reading;
}

const SensorDataDisplay: React.FC<SensorDataDisplayProps> = ({ sensorName, sensorReading }) => {
  const isDarkMode = useColorScheme() === 'dark';

  const formatCoordinate = (coordinate: number): string => {
    return coordinate.toFixed(4);
  };

  return (
    <>
      <Text style={[styles.sensorText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
        {sensorName}
      </Text>
      {sensorReading ? (
        <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
          X: {formatCoordinate(sensorReading.x)}, Y: {formatCoordinate(sensorReading.y)}, Z: {formatCoordinate(sensorReading.z)}
        </Text>
      ) : (
        <Text style={[styles.coordinateText, { color: isDarkMode ? Colors.light : Colors.dark }]}>
          No {sensorName.toLowerCase()} data
        </Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionContainer: {
    marginTop: 0,
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
