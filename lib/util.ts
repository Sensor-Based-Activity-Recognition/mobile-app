import { Activities, Activity, Payload, Reading, Window } from './types';
import { Buffer } from 'buffer';
import pako from 'pako';

/**
 * Converts payload data to a CSV string format.
 * @param payload - The payload containing sensor data.
 * @returns A CSV string representation of the payload data.
 */
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

/**
 * Converts a CSV string to a Uint8Array byte string.
 * @param csvString - The CSV string to convert.
 * @returns A Uint8Array byte string representation of the CSV string.
 */
const convertToByteString = (csvString: string): Uint8Array => {
  return new Buffer(csvString, 'utf-8');
}

/**
 * Compresses data using gzip compression algorithm.
 * @param data - The data to compress as a Uint8Array.
 * @returns The compressed data as a Uint8Array.
 */
const compressData = (data: Uint8Array): Uint8Array => {
  return pako.gzip(data);
}

/**
 * Transforms payload data into a compressed Uint8Array representation.
 * @param payload - The payload containing sensor data.
 * @returns A compressed Uint8Array representation of the transformed data.
 */
export const transformData = (payload: Payload): Uint8Array => {
  const csvString = convertToCSV(payload);
  const byteString = convertToByteString(csvString);
  const compressedData = compressData(byteString);
  return compressedData;
}

/**
 * Reduces activities to only include the first activity in a sequence of the same activity.
 * @param activities - An array of activities.
 * @returns An array of activities with only the first activity in a sequence of the same activity.
 */
export const mergeActivitySequence = (activities: Activities): Activity[] => {
  let result: Activity[] = [];
  let lastActivity: Activity | null = null;

  activities.forEach((activity) => {
    if (!lastActivity || lastActivity.activity !== activity.activity) {
      lastActivity = { ...activity };  // make a copy
      result.push(lastActivity);
    } else {
      // if the current activity is the same as the last one, update lastActivity's endTime
      lastActivity.endTime = activity.endTime;
    }
  });

  return result;
};

/**
 * Computes the frequency of each activity and the sum of probabilities for each activity from the predictions.
 * @param predictions - The predictions containing windowed activity data.
 * @returns An object with the activity frequency and sum of probabilities for each activity.
 */
export const computeActivityFrequencyAndSumOfProbabilities = (predictions: {[key: string]: Window}) => {
  let activityFrequency: {[key: string]: number} = {};
  let sumOfProbabilities: {[key: string]: number} = {};

  Object.values(predictions).forEach((window: Window) => {
    const predictionForActivities: [string, number][] = Object.entries(window);
    const highestActivity: [string, number] = predictionForActivities.reduce((maxActivity, currentActivity) => (currentActivity[1] > maxActivity[1]) ? currentActivity : maxActivity);

    const [activity, probability] = highestActivity;
    if (activity in sumOfProbabilities) {
      sumOfProbabilities[activity] += probability;
      activityFrequency[activity] += 1;
    } else {
      sumOfProbabilities[activity] = probability;
      activityFrequency[activity] = 1;
    }
  });

  return { activityFrequency, sumOfProbabilities };
};

/**
 * Calculates the average probabilities for each activity based on the sum of probabilities and activity frequency.
 * @param sumOfProbabilities - The sum of probabilities for each activity.
 * @param activityFrequency - The frequency of each activity.
 * @returns An object with the average probabilities for each activity.
 */
export const calculateAverageProbabilities = (sumOfProbabilities: {[key: string]: number}, activityFrequency: {[key: string]: number}) => {
  let averageProbabilities: {[key: string]: number} = {};
  for (let activity in sumOfProbabilities) {
    averageProbabilities[activity] = sumOfProbabilities[activity] / activityFrequency[activity];
  }
  return averageProbabilities;
};

/**
 * Determines the most common activity based on activity frequency and average probabilities.
 * @param activityFrequency - The frequency of each activity.
 * @param averageProbabilities - The average probabilities for each activity.
 * @returns The most common activity as a [string, number] tuple, where the first element is the activity name and the second element is the frequency.
 */
export const determineMostCommonActivity = (activityFrequency: {[key: string]: number}, averageProbabilities: {[key: string]: number}) => {
  return Object.entries(activityFrequency).reduce((maxActivity, currentActivity) => {
    const [maxActivityName, maxFrequency] = maxActivity;
    const [currentActivityName, currentFrequency] = currentActivity;

    if (currentFrequency > maxFrequency) {
      return currentActivity;
    } else if (currentFrequency === maxFrequency) {
      return (averageProbabilities[currentActivityName] > averageProbabilities[maxActivityName]) ? currentActivity : maxActivity;
    } else {
      return maxActivity;
    }
  });
};