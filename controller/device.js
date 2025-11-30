const { successResponse, errorResponse } = require('../asset/response')
const authenticateToken = require('../config/authenticateToken')
const { firestore } = require('../firebase/firebase')

const device = (app) => {
    // Turn on device
    app.post('/api/device/:deviceName/on', authenticateToken, async (req, res) => {
        try {
            const { deviceName } = req.params;
            const deviceRef = firestore.collection('active_device').where('name', '==', deviceName);
            const snapshot = await deviceRef.get();

            if (snapshot.empty) {
                return errorResponse(res, `Device ${deviceName} not found`, 404);
            }

            const docRef = snapshot.docs[0].ref;
            await docRef.update({ status: true });

            return successResponse(res, null, `Device ${deviceName} turned on successfully`);
        } catch (error) {
            return errorResponse(res, `Failed to turn on device: ${error.message}`, 500);
        }
    });

    // Turn off device
    app.post('/api/device/:deviceName/off', authenticateToken, async (req, res) => {
        try {
            const { deviceName } = req.params;
            const deviceRef = firestore.collection('active_device').where('name', '==', deviceName);
            const snapshot = await deviceRef.get();

            if (snapshot.empty) {
                return errorResponse(res, `Device ${deviceName} not found`, 404);
            }

            const docRef = snapshot.docs[0].ref;
            await docRef.update({ status: false });

            return successResponse(res, null, `Device ${deviceName} turned off successfully`);
        } catch (error) {
            return errorResponse(res, `Failed to turn off device: ${error.message}`, 500);
        }
    });

    // Get all devices status
    app.get('/api/devices', authenticateToken, async (req, res) => {
        try {
            const deviceRef = firestore.collection('active_device');
            const snapshot = await deviceRef.get();
            const devices = [];
            snapshot.forEach(doc => {
                devices.push({ id: doc.id, ...doc.data() });
            });
            return successResponse(res, devices, 'Devices retrieved successfully');
        } catch (error) {
            return errorResponse(res, `Failed to retrieve devices: ${error.message}`, 500);
        }
    });
}
module.exports = device;