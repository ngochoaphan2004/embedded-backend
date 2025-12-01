const { db, firestore } = require('./firebase/firebase');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const withNoise = (value, spread) => value + (Math.random() - 0.5) * spread;

let snapshot = {
  temperature: 27,
  humidity: 75,
  soilMoisture: 45,
  waterLevel: 20,
  rainfall: 2,
  lightStatus: true,
  pumpStatus: false,
};

async function hydrateSnapshotFromHistory() {
  try {
    const snapshotDocs = await firestore
      .collection('history_sensor_data')
      .orderBy('dateTime', 'desc')
      .limit(1)
      .get();

    if (snapshotDocs.empty) {
      console.log('Không tìm thấy dữ liệu lịch sử để khởi tạo, dùng giá trị mặc định.');
      return;
    }

    const data = snapshotDocs.docs[0].data() || {};
    const numericKeys = ['temperature', 'humidity', 'soilMoisture', 'waterLevel', 'rainfall'];
    numericKeys.forEach(key => {
      if (typeof data[key] === 'number') {
        snapshot[key] = data[key];
      }
    });
    if (typeof data.lightStatus === 'boolean') {
      snapshot.lightStatus = data.lightStatus;
    }
    if (typeof data.pumpStatus === 'boolean') {
      snapshot.pumpStatus = data.pumpStatus;
    }
    console.log('Đã khởi tạo dữ liệu mô phỏng từ history_sensor_data.');
  } catch (error) {
    console.error('Không thể lấy dữ liệu lịch sử, dùng giá trị mặc định:', error);
  }
}

async function pushMockReading() {
  try {
    snapshot = {
      ...snapshot,
      temperature: clamp(withNoise(snapshot.temperature, 0.8), 22, 32),
      humidity: clamp(withNoise(snapshot.humidity, 4), 60, 90),
      soilMoisture: clamp(withNoise(snapshot.soilMoisture, 3), 30, 60),
      waterLevel: clamp(withNoise(snapshot.waterLevel, 2), 15, 30),
      rainfall: clamp(withNoise(snapshot.rainfall, 1.5), 0, 10),
      lightStatus: Math.random() > 0.15 ? snapshot.lightStatus : !snapshot.lightStatus,
      pumpStatus: Math.random() > 0.1 ? snapshot.pumpStatus : !snapshot.pumpStatus,
    };

    const timestamp = Date.now();
    const payload = {
      ...snapshot,
      timestamp,
      dateTime: new Date(timestamp),
    };

    await db.ref('sensor_data').set(payload);
    console.log('Pushed mock reading at', new Date(timestamp).toISOString());
  } catch (error) {
    console.error('Failed to push mock reading:', error);
  }
}

async function startMockStream() {
  await hydrateSnapshotFromHistory();
  await pushMockReading();
  setInterval(pushMockReading, 10000);
}

startMockStream();