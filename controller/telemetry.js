const moment = require('moment');
const axios = require('axios');
const authenticateToken = require('../config/authenticateToken');
const { db, firestore } = require('../firebase/firebase');
const { successResponse, errorResponse } = require('../asset/response');
const serviceAccount = require('../firebase/serviceAccountKey.json');
const cluster = require('../config/cluster_config');


const isValidField = (field) => {
    if (!field || field.trim() == "")
        return false
    return true
}

const getActiveCollections = async () => {
    const activeDevices = await firestore.collection('active_device').where('status', '==', true).get();
    const activeCollections = [];
    activeDevices.docs.forEach(doc => {
        const data = doc.data();
        if(Boolean(data.status))
            activeCollections.push(data.collection);
    });
    return activeCollections;
}

const telemetry = (app) => {
    const real_time_api = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/sensor_data.json`

    // Lấy dữ liệu mới nhất của thiết bị (trung bình từ device1-4 và history_sensor_data)
    app.get('/api/data/realtime', authenticateToken, async (req, res) => {
        try {
            const { getBy } = req.query

            // Get active collections
            const activeCollections = await getActiveCollections();

            const latestDocs = [];

            for (const coll of activeCollections) {
                const querySnapshot = await firestore.collection(coll).orderBy('dateTime', 'desc').limit(1).get();
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    latestDocs.push({ ...doc.data(), collection: coll });
                }
            }

            if (latestDocs.length === 0) {
                return errorResponse(res, 'Không có dữ liệu realtime từ các collection');
            }

            // Calculate average for numeric fields
            const averagedData = {};
            const fieldCounts = {};

            latestDocs.forEach(doc => {
                for (const key in doc) {
                    if (typeof doc[key] === 'number') {
                        if (!averagedData[key]) {
                            averagedData[key] = 0;
                            fieldCounts[key] = 0;
                        }
                        averagedData[key] += doc[key];
                        fieldCounts[key]++;
                    } else if (!averagedData[key]) {
                        averagedData[key] = doc[key];
                    }
                }
            });

            // Average the numeric fields
            for (const key in averagedData) {
                if (fieldCounts[key]) {
                    averagedData[key] = parseFloat((averagedData[key] / fieldCounts[key]).toFixed(2));
                }
            }

            // Include latest data from all collections
            averagedData.latestData = latestDocs;

            if (!getBy || getBy.trim() === "") {
                return successResponse(res, averagedData);
            }

            const fields = getBy.split(',').map(f => f.trim()).filter(f => f !== "");

            const result = {};
            fields.forEach(field => {
                if (averagedData.hasOwnProperty(field)) {
                    result[field] = averagedData[field];
                }
            });

            if (Object.keys(result).length === 0) {
                return errorResponse(res, `Không tìm thấy field nào hợp lệ trong: ${fields.join(', ')}`, 404);
            }

            return successResponse(res, result, `Lấy dữ liệu trung bình theo field: ${fields.join(', ')}`);
        } catch (error) {
            return errorResponse(
                res,
                `Lỗi hệ thống: ${error.message || 'Không xác định'}`,
                500
            );
        }
    });

    // Lấy lịch sử dữ liệu của thiết bị
    // sortBy = {"newest", "oldest"}
    app.get('/api/data/history', authenticateToken, async (req, res) => {
        try {
            const { pageNum, pageSize, sortBy, from, to, device } = req.query

            const validDevices = ['device1', 'device2', 'device3', 'device4', 'history_sensor_data'];
            const targetDevice = device && validDevices.includes(device) ? device : 'history_sensor_data';

            // Check if device is active
            if (device) {
                const activeCollections = await getActiveCollections();
                if (!activeCollections.includes(targetDevice)) {
                    return errorResponse(res, `Thiết bị ${device} không hoạt động`, 403);
                }
            }

            let history_collection = firestore.collection(targetDevice)

            if(sortBy)
                history_collection = history_collection.orderBy("dateTime", sortBy.trim() == "oldest" ? "asc" : "desc")
            else
                history_collection = history_collection.orderBy("dateTime", "desc")


                if (from && to) {
                history_collection = history_collection.where("dateTime", ">=", new Date(from))
                    .where("dateTime", "<=", new Date(to));
                } else if (from && !to) {
                history_collection = history_collection.where("dateTime", ">=", new Date(from));
                } else if (!from && to) {
                history_collection = history_collection.where("dateTime", "<=", new Date(to));
                }

            const collection_firestore = await history_collection.get()

            let history_data = collection_firestore.docs.map(row => {
                const data = row.data()
                const Date = moment(data.timestamp).add(data.dateTime._nanoseconds / 1000000, 'milliseconds');
                    return ({
                    id: row.id,
                    ...data,
                        dateTime: Date.format('YYYY-MM-DD HH:mm:ss.SSS'),
                        device: targetDevice
                })
            })


            if (isValidField(pageNum) && isValidField(pageSize)) {
                var pn = Number(pageNum)
                var ps = Number(pageSize)
                var start = pn * ps
                history_data = history_data.slice(start, start + ps)
            }
            else if ((isValidField(pageNum) && !isValidField(pageSize)) || (!isValidField(pageNum) && isValidField(pageSize))) {
                return errorResponse(res, "Thiếu hai thuộc tính 'pageSize' hoặc 'pageNum'")
            }

            return successResponse(res, history_data)
        } catch (error) {
            return errorResponse(
                res,
                `Lỗi hệ thống: ${error.message || 'Không xác định'}`,
                500
            );
        }
    });

    // Control pump
    app.post('/api/control/pump', authenticateToken, (req, res) => {
        console.log(`[${new Date().toISOString()}] API /api/control/pump called with action: ${req.body.action}`);
        try {
            const { action } = req.body;
            if (action === 'on') {
                cluster.turnOnPump();
                return successResponse(res, null, 'Pump turned on successfully');
            } else if (action === 'off') {
                cluster.turnOffPump();
                return successResponse(res, null, 'Pump turned off successfully');
            } else {
                return errorResponse(res, 'Invalid action. Use "on" or "off"', 400);
            }
        } catch (error) {
            return errorResponse(res, `Failed to control pump: ${error.message}`, 500);
        }
    });

    // Control LED
    app.post('/api/control/led', authenticateToken, (req, res) => {
        console.log(`[${new Date().toISOString()}] API /api/control/led called with action: ${req.body.action}`);
        try {
            const { action } = req.body;
            if (action === 'on') {
                cluster.turnOnLed();
                return successResponse(res, null, 'LED turned on successfully');
            } else if (action === 'off') {
                cluster.turnOffLed();
                return successResponse(res, null, 'LED turned off successfully');
            } else {
                return errorResponse(res, 'Invalid action. Use "on" or "off"', 400);
            }
        } catch (error) {
            return errorResponse(res, `Failed to control LED: ${error.message}`, 500);
        }
    });
}

module.exports = telemetry;