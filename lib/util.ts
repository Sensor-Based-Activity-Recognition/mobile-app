import RNFS from "react-native-fs";
import { Activities, Payload, Predictions, Reading, SensorData, Window } from './types';
import { Buffer } from 'buffer';
import pako from 'pako';

export const convertToCSV = (payload: Payload): string  => {
  // Define headers
  let csvString = 'timestamp,Accelerometer_x,Accelerometer_y,Accelerometer_z,Gyroscope_x,Gyroscope_y,Gyroscope_z,Magnetometer_x,Magnetometer_y,Magnetometer_z\n';

  // Create an array of unique timestamps
  let timestamps: number[] = [];
  timestamps = timestamps.concat(payload.accelerometer.map(({ timestamp }) => timestamp));
  timestamps = timestamps.concat(payload.gyroscope.map(({ timestamp }) => timestamp));
  timestamps = timestamps.concat(payload.magnetometer.map(({ timestamp }) => timestamp));
  timestamps = [...new Set(timestamps)].sort();

  // Map sensor data to their timestamps
  const sensorDataMap: { [timestamp: number]: { [sensor in keyof Payload]?: Reading } } = {};

  (['accelerometer', 'gyroscope', 'magnetometer'] as const).forEach(sensor => {
    payload[sensor].forEach(reading => {
      if (!sensorDataMap[reading.timestamp]) {
        sensorDataMap[reading.timestamp] = {};
      }
      sensorDataMap[reading.timestamp][sensor] = reading;
    });
  });

  // Create CSV rows
  timestamps.forEach(timestamp => {
    const dataAtTimestamp = sensorDataMap[timestamp];
    let lineData = [
      timestamp,
      dataAtTimestamp.accelerometer ? dataAtTimestamp.accelerometer.x.toFixed(3) : 'null',
      dataAtTimestamp.accelerometer ? dataAtTimestamp.accelerometer.y.toFixed(3) : 'null',
      dataAtTimestamp.accelerometer ? dataAtTimestamp.accelerometer.z.toFixed(3) : 'null',
      dataAtTimestamp.gyroscope ? dataAtTimestamp.gyroscope.x.toFixed(3) : 'null',
      dataAtTimestamp.gyroscope ? dataAtTimestamp.gyroscope.y.toFixed(3) : 'null',
      dataAtTimestamp.gyroscope ? dataAtTimestamp.gyroscope.z.toFixed(3) : 'null',
      dataAtTimestamp.magnetometer ? dataAtTimestamp.magnetometer.x.toFixed(3) : 'null',
      dataAtTimestamp.magnetometer ? dataAtTimestamp.magnetometer.y.toFixed(3) : 'null',
      dataAtTimestamp.magnetometer ? dataAtTimestamp.magnetometer.z.toFixed(3) : 'null',
    ];
    // Join data into CSV line and append to CSV string
    csvString += lineData.join(',') + '\n';
  });

  return csvString;
}

const convertToByteString = (csvString: string): Uint8Array => {
  return new Buffer(csvString, 'utf-8');
}

const compressData = (data: Uint8Array): Uint8Array => {
  return pako.gzip(data);
}

export const transformData = (payload: Payload): Uint8Array => {
  const csvString = convertToCSV(payload);
  const byteString = convertToByteString(csvString);
  const compressedData = compressData(byteString);
  return compressedData;
}

// Reduce activities to only include the first activity in a sequence of the same activity
export const mergeActivitySequence = (activities: Activities) => {
  const result = [];
  let prevActivity = null;
  for (const activity of activities) {
    if (prevActivity == null || prevActivity.activity !== activity.activity) {
      result.push(activity);
      prevActivity = activity;
    }
  }
  return result;
};
