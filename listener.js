const { db, firestore } = require('./firebase/firebase');
const sendEmail = require('./config/send_email');

const MAX_DATA_POINTS = 10;

const SENSOR_LIMITS = {
  temperature: {
    min: -20,
    max: 80
  },
  humidity: {
    min: 0,
    max: 100
  },
  soilMoisture: {
    min: 0,
    max: 100
  },
  waterLevel: {
    min: 0,
    max: 300
  },
  rainfall: {
    min: 0,
    max: 100
  }
};

console.log('✅ SmartFarm Realtime Listener Started');

let lastTimestamp = null;
let isInitialized = false;
let lastData = {
  'history_sensor_data': [],
  'device1': [],
  'device2': [],
  'device3': [],
  'device4': []
}; // Store last data for each collection for anomaly detection

const detectAnomaly = async (newData, lastDataArray, collection) => {
  let anomalyDetected = false;

  // Check for out of range values
  for (const key in SENSOR_LIMITS) {
    const value = newData[key];
    if (value !== undefined) {
      const limits = SENSOR_LIMITS[key];
      if (value < limits.min || value > limits.max) {
        console.log(`🚫 Out of range value in ${collection} for ${key}: ${value} (min: ${limits.min}, max: ${limits.max})`);
        anomalyDetected = true;
      }
    }
  }

  if (lastDataArray.length > 0) {
    const lastData = lastDataArray[lastDataArray.length - 1];
    const thresholds = {
      temperature: 10, // Max change per reading
      humidity: 20,
      soilMoisture: 10,
      waterLevel: 30,
      rainfall: 20
    };

    // Check for stuck sensor (no change in values)
    const keys = Object.keys(thresholds);
    const isStuck = keys.every(key => newData[key] !== undefined && lastData[key] !== undefined && newData[key] === lastData[key]);
    if (isStuck) {
      console.log(`❄️ Stuck sensor detected in ${collection}: values unchanged`);
      anomalyDetected = true;
    } else {
      // Check for rapid changes
      for (const key of keys) {
        if (newData[key] !== undefined && lastData[key] !== undefined) {
          const change = Math.abs(newData[key] - lastData[key]);
          if (change > thresholds[key]) {
            console.log(`⚠️ Anomaly detected in ${collection} for ${key}: change ${change} (last: ${lastData[key]}, new: ${newData[key]})`);
            anomalyDetected = true;
          }
        }
      }
    }
  }

  if (anomalyDetected) {
    // Update active_device status to false
    const deviceName = collection === 'history_sensor_data' ? 'device0' : collection;
    try {
      const deviceRef = firestore.collection('active_device').where('name', '==', deviceName);
      const snapshot = await deviceRef.get();
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await docRef.update({ status: false });
        console.log(`🚨 Updated ${deviceName} status to inactive due to anomaly`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${deviceName} status:`, err);
    }

    // Send email notification
    try {
      await sendEmail(deviceName);
      console.log(`📧 Email sent for anomaly in ${deviceName}`);
    } catch (emailErr) {
      console.error(`❌ Failed to send email for ${deviceName}:`, emailErr);
    }
  }

  return anomalyDetected;
};

const initializeLastData = async () => {
  const collections = Object.keys(lastData);
  for (const collection of collections) {
    try {
      const querySnapshot = await firestore.collection(collection).orderBy('dateTime', 'desc').limit(MAX_DATA_POINTS).get();
      lastData[collection] = querySnapshot.docs.map(doc => doc.data());
      console.log(`📚 Loaded ${lastData[collection].length} latest data for ${collection}`);
    } catch (err) {
      console.error(`❌ Error loading data for ${collection}:`, err);
    }
  }
};


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

      // Insert to history_sensor_data
      const historyData = { ...data, dateTime: new Date(data.timestamp) };

      // Anomaly detection for history_sensor_data
      const historyAnomaly = await detectAnomaly(historyData, lastData['history_sensor_data'], 'history_sensor_data');

      if (!historyAnomaly) {
        const historyDocRef = await firestore.collection('history_sensor_data').add(historyData);
        console.log('📘 Inserted data to history_sensor_data → doc ID:', historyDocRef.id);

        lastData['history_sensor_data'].push(historyData);
        if (lastData['history_sensor_data'].length > MAX_DATA_POINTS) {
          lastData['history_sensor_data'].shift();
        }

        const devices = ['device1', 'device2', 'device3', 'device4'];
        for (const device of devices) {
          const randomizedData = randomizeData(data);
          const deviceData = { ...randomizedData, dateTime: new Date(data.timestamp) };

          // Anomaly detection
          const deviceAnomaly = await detectAnomaly(deviceData, lastData[device], device);

          if (!deviceAnomaly) {
            const deviceDocRef = await firestore.collection(device).add(deviceData);
            console.log(`📘 Inserted data to ${device} → doc ID:`, deviceDocRef.id);

            lastData[device].push(deviceData);
            if (lastData[device].length > MAX_DATA_POINTS) {
              lastData[device].shift();
            }
          } else {
            console.log(`🚫 Skipped inserting anomalous data to ${device}`);
          }
        }
      } else {
        console.log('🚫 Skipped inserting anomalous data to history_sensor_data');
      }

    } catch (err) {
      console.error('❌ Firestore write error:', err);
    }
  }
  else {
    await initializeLastData();
  }
  isInitialized = true;
});