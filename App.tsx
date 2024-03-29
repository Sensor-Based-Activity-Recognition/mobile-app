import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Button, Text, useColorScheme, View, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { accelerometer, gyroscope, magnetometer, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";
import { Colors } from 'react-native/Libraries/NewAppScreen';
import Share from 'react-native-share';
import RNFS from "react-native-fs";
import axios from 'axios';
import { SensorData, Payload, Reading, Activity, Activities, Predictions, Window } from './lib/types';
import { calculateAverageProbabilities, computeActivityFrequencyAndSumOfProbabilities, convertToCSV, determineMostCommonActivity, mergeActivitySequence, transformData } from './lib/util';
import { Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Svg, Line, Circle, Text as SVGText, TSpan } from 'react-native-svg';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const [model, setModel] = useState('CNN');
  const [activity, setActivity] = useState('');
  const [activities, setActivities] = useState<Activities>([]);
  const [isLoading, setIsLoading] = useState(false);

  const modelRef = useRef('CNN');
  const activitiesRef = useRef<Activities>([]);
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

  const CLASSIFICATION_INTERVAL = 25; // in seconds

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
      const now: number = new Date().getTime() * 1_000_000;
      // 20% overlap to make sure we have enough data
      const keepLastSeconds = (reading: Reading): boolean => reading.timestamp > now - (CLASSIFICATION_INTERVAL * 1.2) * 1_000_000_000;
      const sensorData: Payload = {
        accelerometer: accelerometerDataRef.current.filter(keepLastSeconds),
        gyroscope: gyroscopeDataRef.current.filter(keepLastSeconds),
        magnetometer: magnetometerDataRef.current.filter(keepLastSeconds),
      };

      // get the minimum timestamp of accelerometer data
      const timestamps: number[] = sensorData.accelerometer.map((reading) => reading.timestamp);
      const deltaSeconds: number = (Math.max(...timestamps) - Math.min(...timestamps)) / 1_000_000_000;
      console.log("Number of seconds of data", deltaSeconds);
      if (deltaSeconds < CLASSIFICATION_INTERVAL) {
        console.log("Not enough data");
        return;
      }

      // transform the data & request the prediction
      const transformedData: Uint8Array = transformData(sensorData);
      const predictions: Predictions = await sendDataToServer(transformedData);

      const { activityFrequency, sumOfProbabilities } = computeActivityFrequencyAndSumOfProbabilities(predictions);
      console.log("activityFrequency", activityFrequency);

      const averageProbabilities = calculateAverageProbabilities(sumOfProbabilities, activityFrequency);
      console.log("averageProbabilities", averageProbabilities);

      const mostCommonActivity = determineMostCommonActivity(activityFrequency, averageProbabilities);
      console.log("mostCommonActivity", mostCommonActivity);

      // create the activity object for the timeline
      const nextActivityId: number = activitiesRef.current.length + 1;
      const activity: Activity = {
        id: nextActivityId,
        activity: mostCommonActivity[0],
        probabilities: averageProbabilities,
        startTime: Math.min(...timestamps),
        endTime: Math.max(...timestamps),
      };
      console.log("Activity defined as", activity)

      // append the activity to the list of activities
      activitiesRef.current = [...activitiesRef.current, activity];
      setActivities(activitiesRef.current);

      // set activity to current length and most common activity
      setActivity(activitiesRef.current.length.toString() + " " + activity.activity);

      deleteDataOlderThan(CLASSIFICATION_INTERVAL);
    };
    const interval = setInterval(() => {
      if (isLoadingRef.current) {
        classifyAndAppendActivity();
      }
    }, CLASSIFICATION_INTERVAL * 1000);

    return () => clearInterval(interval);
  }, []);

  const deleteDataOlderThan = (seconds: number = 5) => {
    console.log('deleting data older than', seconds)
    const now = new Date().getTime() * 1_000_000;
    const keepLastSeconds = (reading: Reading): boolean => reading.timestamp > now - seconds * 1_000_000_000;
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
      <View style={styles.titleContainer}>
        <Text style={[isDarkMode ? styles.lightTitle : styles.darkTitle]}>Activity Recognition</Text>
      </View>
      <Picker
        itemStyle={{ color: isDarkMode ? 'white' : 'black', height: 60 }}
        selectedValue={model}
        onValueChange={(value: string) => {
          modelRef.current = value;
          setModel(modelRef.current);
        }}
      >
        <Picker.Item label="CNN" value="CNN" />
        <Picker.Item label="HistGradientBoost" value="HGBC" />
      </Picker>
      <View style={styles.titleContainer}>
        <Button title={isLoading ? "Stop recording" : "Start Recording"} onPress={toggleRecording} />
        {isLoading && (
            <ActivityIndicator size="small" color={isDarkMode ? Colors.light : Colors.dark} style={styles.loader} />
        )}
      </View>
      <ScrollView>
        <View style={styles.sectionContainer}>
          <ActivityTimeline activities={activities} />
          <Text style={[styles.activityText, { color: isDarkMode ? Colors.light : Colors.dark }]}>{activity}</Text>
          <SensorDataDisplay sensorName="Accelerometer" sensorReading={latestDisplayAccelerometerData} />
          <SensorDataDisplay sensorName="Gyroscope" sensorReading={latestDisplayGyroscopeData} />
          <SensorDataDisplay sensorName="Magnetometer" sensorReading={latestDisplayMagnetometerData} />
          <Button title="Share Sensor Data" onPress={shareSensorData}  disabled={isLoading} />
        </View>
      </ScrollView>
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

interface ActivityTimelineEntryProps {
  activity: Activity;
  index: number;
  isDarkMode: boolean;
  distanceBetweenEntries: number;
}

const ActivityTimelineEntry = memo(({ activity, index, isDarkMode, distanceBetweenEntries }: ActivityTimelineEntryProps) => {
  const startDate = new Date(activity.startTime / 1000000);
  const startHours = startDate.getHours().toString().padStart(2, '0');
  const startMinutes = startDate.getMinutes().toString().padStart(2, '0');
  const startSeconds = startDate.getSeconds().toString().padStart(2, '0');

  const endDate = new Date(activity.endTime / 1000000);
  const endHours = endDate.getHours().toString().padStart(2, '0');
  const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
  const endSeconds = endDate.getSeconds().toString().padStart(2, '0');

  const getActivityIconName = (activity: string) => {
    switch (activity) {
      case 'Sitzen': return 'couch'
      case 'Stehen': return 'male';
      case 'Laufen': return 'walking';
      case 'Rennen': return 'running';
      case 'Treppenlaufen': return 'hiking';
      case 'Velofahren': return 'biking';
      default: return 'question';
    }
  };

  return (
    <React.Fragment key={activity.id}>
      <SVGText
        x="0"
        y={55 - 10 + index * distanceBetweenEntries}
        fill={isDarkMode ? Colors.light : Colors.dark}
      >
        {`${startHours}:${startMinutes}:`}
        <TSpan fontWeight="bold">{startSeconds}</TSpan>
      </SVGText>
      <SVGText
        x="0"
        y={55 + index * distanceBetweenEntries}
        fill={isDarkMode ? Colors.light : Colors.dark}
      >
        -
      </SVGText>
      <SVGText
        x="0"
        y={55 + 10 + index * distanceBetweenEntries}
        fill={isDarkMode ? Colors.light : Colors.dark}
      >
        {`${endHours}:${endMinutes}:`}
        <TSpan fontWeight="bold">{endSeconds}</TSpan>
      </SVGText>
      <Circle
        cx="65"
        cy={50 + index * distanceBetweenEntries}
        r="8"
        fill={isDarkMode ? Colors.light : Colors.dark}
      />
      <FontAwesome5
        name={getActivityIconName(activity.activity)}
        size={30} // size of the icon
        color={isDarkMode ? Colors.light : Colors.dark}
        style={{
          position: 'absolute',
          left: 80,
          top: 35 + index * distanceBetweenEntries
        }}
      />
      <SVGText
        x="130"
        y={45 + index * distanceBetweenEntries}
        fill={isDarkMode ? Colors.light : Colors.dark}
        fontSize="20"
      >
        {activity.activity}
      </SVGText>
      <SVGText
        x="130"
        y={65 + index * distanceBetweenEntries}
        fill={isDarkMode ? Colors.light : Colors.dark}
        fontSize="15"
      >
        {(activity.probabilities[activity.activity] * 100).toFixed(1)}%
      </SVGText>
    </React.Fragment>
  );
});

interface ActivityTimelineProps {
  activities: Activities;
}

const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  const isDarkMode = useColorScheme() === 'dark';

  // Preprocess activities to consolidate consecutive same activities & latest activity is at the top
  activities = useMemo(() => mergeActivitySequence([...activities]), [activities]);

  // Calculate dynamic SVG height based on number of timepoints and distance between them
  const screenWidth = Dimensions.get('window').width;
  const distanceBetweenEntries = 100; // Adjust this as needed
  const svgHeight = useMemo(() => activities.length * distanceBetweenEntries, [activities, distanceBetweenEntries]);
  const svgWidth = screenWidth * 0.8;

  return (
    <ScrollView>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Svg height={svgHeight} width={svgWidth}>
          <Line
            x1="65"
            y1="50"
            x2="65"
            y2={svgHeight - 50}
            stroke={isDarkMode ? Colors.light : Colors.dark}
            strokeWidth="2"
          />
          {activities.map((activity, index) => (
            <ActivityTimelineEntry
              key={activity.id}
              activity={activity}
              index={index}
              isDarkMode={isDarkMode}
              distanceBetweenEntries={distanceBetweenEntries}
            />
          ))}
        </Svg>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    marginTop: 4,
    alignItems: 'center',
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
