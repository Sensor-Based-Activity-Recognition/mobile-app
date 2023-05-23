import RNFS from "react-native-fs";
import { Payload, Reading, SensorData } from './types';
import { Buffer } from 'buffer';
import pako from 'pako';

export function convertToCSV(payload: Payload): string {
  // Define headers
  let csvString = 'timestamp,Accelerometer_x,Accelerometer_y,Accelerometer_z,Gyroscope_x,Gyroscope_y,Gyroscope_z,Magnetometer_x,Magnetometer_y,Magnetometer_z\n';

  // len of each array should be the same
  console.log('payload recordings length', payload.accelerometer.length, payload.gyroscope.length, payload.magnetometer.length)

  // get the smallest length
  const min_len = Math.min(payload.accelerometer.length, payload.gyroscope.length, payload.magnetometer.length)

  // TODO: We assume that all sensor arrays have the same length and the same corresponding timestamps
  for (let i = 0; i < min_len; i++) {
    const accelerometerReading: Reading = payload.accelerometer[i];
    const gyroscopeReading: Reading = payload.gyroscope[i];
    const magnetometerReading: Reading = payload.magnetometer[i];

    // Create CSV entries
    let lineData = [
      accelerometerReading.timestamp,
      accelerometerReading.x.toFixed(3),
      accelerometerReading.y.toFixed(3),
      accelerometerReading.z.toFixed(3),
      gyroscopeReading.x.toFixed(3),
      gyroscopeReading.y.toFixed(3),
      gyroscopeReading.z.toFixed(3),
      magnetometerReading.x.toFixed(3),
      magnetometerReading.y.toFixed(3),
      magnetometerReading.z.toFixed(3),
    ];

    // Join data into CSV line and append to CSV string
    csvString += lineData.join(',') + '\n';
  }

  return csvString;
}

function convertToByteString(csvString: string): Uint8Array {
  return new Buffer(csvString, 'utf-8');
}

function compressData(data: Uint8Array): Uint8Array {
  return pako.gzip(data);
}

export function transformData(payload: Payload): Uint8Array {
  const csvString = convertToCSV(payload);
  const byteString = convertToByteString(csvString);
  const compressedData = compressData(byteString);
  return compressedData;
}