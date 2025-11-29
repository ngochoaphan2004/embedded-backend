const { db, firestore } = require('./firebase/firebase');

console.log('✅ SmartFarm Realtime Listener Started');

let lastTimestamp = null;
let isInitialized = false;

db.ref('sensor_data').on('value', async (snapshot) => {
  if (isInitialized) {
    const data = snapshot.val();
    if (!data) return;

    if (data.timestamp <= lastTimestamp) return;
    lastTimestamp = data.timestamp;

    try {
      function generateRandomValue(value, variance = 0.05) {
        if (typeof value !== 'number') return value; 

        const min = 1 - variance;
        const max = 1 + variance;
        const randomFactor = Math.random() * (max - min) + min;

        return parseFloat((value * randomFactor).toFixed(2));
      }

      const randomizeData = (baseData) => {
        const randomized = {};
        for (const key in baseData) {
          randomized[key] = generateRandomValue(baseData[key]);
        }
        return randomized;
      };

      const historyDocRef = await firestore.collection('history_sensor_data').add({
        ...data,
        dateTime: new Date(data.timestamp),
      });
      console.log('📘 Inserted data to history_sensor_data → doc ID:', historyDocRef.id);

      const devices = ['device1', 'device2', 'device3', 'device4'];
      for (const device of devices) {
        const randomizedData = randomizeData(data);
        const deviceDocRef = await firestore.collection(device).add({
          ...randomizedData,
          dateTime: new Date(data.timestamp),
        });
        console.log(`📘 Inserted data to ${device} → doc ID:`, deviceDocRef.id);
      }
    } catch (err) {
      console.error('❌ Firestore write error:', err);
    }
  }
  isInitialized = true;

});