import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Button, Text, useColorScheme, View, ActivityIndicator } from 'react-native';
import { accelerometer, gyroscope, magnetometer, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";
import { Colors } from 'react-native/Libraries/NewAppScreen';
import Share from 'react-native-share';
import RNFS from "react-native-fs";
import axios from 'axios';
import { SensorData, Payload, Reading, Activity, Activties } from './lib/types';
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
  const [activities, setActivities] = useState<Activties>([]);
  const [isLoading, setIsLoading] = useState(false);

  const modelRef = useRef('CNN');
  const activitiesRef = useRef<Activties>([]);
  const isLoadingRef = useRef(false);

  const [accelerometerData, setAccelerometerData] = useState<SensorData>([]);
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>([]);
  const [magnetometerData, setMagnetometerData] = useState<SensorData>([]);
  const [displayAccelerometerData, setDisplayAccelerometerData] = useState<SensorData>([]);
  const [displayGyroscopeData, setDisplayGyroscopeData] = useState<SensorData>([]);
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


  useEffect(() => {
    const classifyAndAppendActivity = async () => {
      const now: number = new Date().getTime() * 1000000;
      const keepLastSeconds = (reading: Reading): boolean => reading.timestamp > now - 6000000000;
      const sensorData: Payload = {
        accelerometer: accelerometerDataRef.current.filter(keepLastSeconds),
        gyroscope: gyroscopeDataRef.current.filter(keepLastSeconds),
        magnetometer: magnetometerDataRef.current.filter(keepLastSeconds),
      };

      // get the minimum timestamp of accelerometer data
      const timestamps: number[] = sensorData.accelerometer.map((reading) => reading.timestamp);
      const deltaSeconds: number = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000000000;
      console.log("deltaSeconds", deltaSeconds);
      if (deltaSeconds < 5) {
        console.log("Not enough data");
        return;
      }

      // transform the data
      const transformedData: Uint8Array = transformData(sensorData);
      const response: any = await sendDataToServer(transformedData);

      // get the activity with the highest probability
      const activities: [string, number][] = Object.entries(response["0"]);
      const highestActivity: [string, number] = activities.reduce((maxActivity, currentActivity) => (currentActivity[1] > maxActivity[1]) ? currentActivity : maxActivity);
      console.log("highestActivity", highestActivity);

      const nextActivityId: number = activitiesRef.current.length + 1;
      const activity: Activity = {
        id: nextActivityId,
        activity: highestActivity[0],
        probabilities: response["0"],
      };

      activitiesRef.current = [...activitiesRef.current, activity];
      setActivities(activitiesRef.current);
      setActivity(activitiesRef.current.length.toString());

      deleteDataOlderThan(10);
    };
    const interval = setInterval(() => {
      if (isLoadingRef.current) {
        console.log("Loading");
        classifyAndAppendActivity();
      } else {
        console.log("Not loading");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  function deleteDataOlderThan(seconds: number = 5) {
    const now = new Date().getTime() * 1000000;
    const keepLastSeconds = (reading: Reading): boolean => reading.timestamp > now - seconds * 1000000000;
    accelerometerDataRef.current = accelerometerDataRef.current.filter(keepLastSeconds);
    gyroscopeDataRef.current = gyroscopeDataRef.current.filter(keepLastSeconds);
    magnetometerDataRef.current = magnetometerDataRef.current.filter(keepLastSeconds);
    setAccelerometerData(accelerometerDataRef.current);
    setGyroscopeData(gyroscopeDataRef.current);
    setMagnetometerData(magnetometerDataRef.current);
  }

  const toggleRecording = () => {
    if (isLoading) {
      isLoadingRef.current = false;
      setIsLoading(isLoadingRef.current);
    } else {
      accelerometerDataRef.current = [];
      gyroscopeDataRef.current = [];
      magnetometerDataRef.current = [];
      setAccelerometerData([]);
      setGyroscopeData([]);
      setMagnetometerData([]);
      isLoadingRef.current = true;
      setIsLoading(isLoadingRef.current);
    }
  };

  const sendDataToServer = async (data: Uint8Array) => {
    try {
      // Call API
      console.log('Calling API using model:', modelRef.current);
      const response = await axios.post(`https://sbar.fuet.ch/${modelRef.current}`, data, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      // print info on response
      console.log("Response from server:", response.status, response.statusText);
      console.log(response.data)
      // convert strings that look like numbers to numbers
      return response.data;
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
        itemStyle={{ color: isDarkMode ? 'white' : 'black' }}
        selectedValue={model}
        onValueChange={(value: string) => {
          modelRef.current = value;
          setModel(modelRef.current);
        }}
      >
        <Picker.Item label="CNN" value="CNN" />
        <Picker.Item label="HistGradientBoost" value="HGBC" />
      </Picker>
      <View style={styles.sectionContainer}>
        <Text style={[isDarkMode ? styles.lightTitle : styles.darkTitle]}>Activity Recognition</Text>
        <Button title={isLoading ? "Stop recording" : "Start Recording"} onPress={toggleRecording} />
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
