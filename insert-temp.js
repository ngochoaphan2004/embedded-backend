const { firestore } = require('./firebase/firebase');

async function clearCollections() {
    const collections = ['device1', 'device2', 'device3', 'device4', 'history_sensor_data'];

    for (const collection of collections) {
        const querySnapshot = await firestore.collection(collection).get();
        const batch = firestore.batch();

        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleared collection: ${collection}`);
    }
}

async function insertSampleData() {
    const now = Date.now();
    const entries = 50; // Number of entries to insert
    let currentTime = now;

    // Initial base values (normal conditions)
    let baseTemperature = 27.0;
    let baseHumidity = 75;
    let baseSoilMoisture = 40;
    let baseWaterLevel = 18;
    let baseRainfall = 2;

    const collections = ['device1', 'device2', 'device3', 'device4', 'history_sensor_data'];

    for (let i = 0; i < entries; i++) {
        // Random interval between 10-15 minutes (600000 - 900000 ms)
        const interval = Math.random() * (900000 - 600000) + 600000;
        currentTime -= interval;

        // Gradual changes for base values
        baseTemperature += (Math.random() - 0.5) * 1.0; // Change by -0.5 to +0.5
        baseTemperature = Math.max(20, Math.min(30, baseTemperature)); // Keep within 20-30

        baseHumidity += (Math.random() - 0.5) * 10; // Change by -5 to +5
        baseHumidity = Math.max(60, Math.min(90, baseHumidity)); // Keep within 60-90

        baseSoilMoisture += (Math.random() - 0.5) * 6; // Change by -3 to +3
        baseSoilMoisture = Math.max(30, Math.min(60, baseSoilMoisture)); // Keep within 30-60

        baseWaterLevel += (Math.random() - 0.5) * 4; // Change by -2 to +2
        baseWaterLevel = Math.max(10, Math.min(30, baseWaterLevel)); // Keep within 10-30

        baseRainfall += (Math.random() - 0.5) * 4; // Change by -2 to +2
        baseRainfall = Math.max(0, Math.min(20, baseRainfall)); // Keep within 0-20

        // Insert into each collection with slight variations
        for (const collection of collections) {
            let temperature = baseTemperature + (Math.random() - 0.5) * 2; // Variation -1 to +1
            temperature = Math.max(20, Math.min(30, temperature));

            let humidity = baseHumidity + (Math.random() - 0.5) * 6; // Variation -3 to +3
            humidity = Math.max(60, Math.min(90, humidity));

            let soilMoisture = baseSoilMoisture + (Math.random() - 0.5) * 4; // Variation -2 to +2
            soilMoisture = Math.max(30, Math.min(60, soilMoisture));

            let waterLevel = baseWaterLevel + (Math.random() - 0.5) * 4; // Variation -2 to +2
            waterLevel = Math.max(10, Math.min(30, waterLevel));

            let rainfall = baseRainfall + (Math.random() - 0.5) * 4; // Variation -2 to +2
            rainfall = Math.max(0, Math.min(20, rainfall));

            const data = {
                temperature: parseFloat(temperature.toFixed(1)),
                humidity: parseFloat(humidity.toFixed(1)),
                soilMoisture: parseFloat(soilMoisture.toFixed(1)),
                waterLevel: parseFloat(waterLevel.toFixed(1)),
                rainfall: parseFloat(rainfall.toFixed(1)),
                dateTime: new Date(currentTime),
                timestamp: currentTime
            };

            try {
                await firestore.collection(collection).add(data);
                console.log(`\n--- Inserted into ${collection} ---`);
                console.log(`Entry ${i + 1} | Timestamp: ${new Date(currentTime).toISOString()}`);
                console.log(`Temperature: ${data.temperature}°C | Humidity: ${data.humidity}% | Soil Moisture: ${data.soilMoisture}%`);
                console.log(`Water Level: ${data.waterLevel}cm | Rainfall: ${data.rainfall}mm`);
            } catch (error) {
                console.error(`\nError inserting into ${collection} entry ${i + 1}:`, error);
            }
        }
    }
}

async function main() {
    try {
        console.log('Clearing existing data...');
        await clearCollections();
        console.log('Inserting sample data...');
        await insertSampleData();
        console.log('All sample data inserted successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();