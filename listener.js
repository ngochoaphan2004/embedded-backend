const { db, firestore } = require('./firebase/firebase');

console.log('✅ SmartFarm Realtime Listener Started');

let lastTimestamp = null;
let is_state = false;

db.ref('sensor_data').on('value', async (snapshot) => {
  if (is_state) return;
  is_state = true;

  const data = snapshot.val();
  if (!data) return;

  if (data.timestamp <= lastTimestamp) return;
  lastTimestamp = data.timestamp;

  try {
    const docRef = await firestore.collection('history_sensor_data').add({
      ...data,
      dateTime: new Date(data.timestamp),
    });
    console.log('📘 Inserted data → doc ID:', docRef.id);
  } catch (err) {
    console.error('❌ Firestore write error:', err);
  }
});