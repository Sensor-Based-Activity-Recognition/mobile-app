export type Reading = {x: number, y: number, z: number, timestamp: number};

export type SensorData = Reading[];

export type Payload = {
  accelerometer: SensorData,
  gyroscope: SensorData,
  magnetometer: SensorData,
};

export type Predictions = {
  [windowId: string]: Window
};

export type Window = {
  [activity: string]: number
};

export type Activity = {
  id: number,
  activity: string,
  startTime: number,
  endTime: number,
  probabilities: {
    [key: string]: number
  }
};

export type Activities = Activity[];