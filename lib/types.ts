export type Reading = {x: number, y: number, z: number, timestamp: number};

export type SensorData = Reading[];

export type Payload = {
  accelerometer: SensorData,
  gyroscope: SensorData,
  magnetometer: SensorData,
};

export type Activity = {
  id: number,
  activity: string,
  probabilities: {
    [key: string]: number
  }
};

export type Activties = Activity[];