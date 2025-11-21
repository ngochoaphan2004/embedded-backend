const moment = require('moment');
const axios = require('axios');
const authenticateToken = require('../config/authenticateToken');
const { db, firestore } = require('../firebase/firebase');
const { successResponse, errorResponse } = require('../asset/response');
const serviceAccount = require('../firebase/serviceAccountKey.json');


const isValidField = (field) => {
    if (!field || field.trim() == "")
        return false
    return true
}

const telemetry = (app) => {
    const real_time_api = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/sensor_data.json`

    // Lấy dữ liệu mới nhất của thiết bị
    app.get('/api/data/realtime', authenticateToken, async (req, res) => {
        try {
            const { getBy } = req.query

            const rt_res = await axios.get(real_time_api)
                .catch((e) => {
                    return errorResponse(res, 'Lấy dữ liệu realtime từ firebase không thành công')
                })
            const rt_data = rt_res.data


            if (!getBy || getBy.trim() === "") {
                return successResponse(res, rt_data);
            }

            const fields = getBy.split(',').map(f => f.trim()).filter(f => f !== "");

            const result = {};
            fields.forEach(field => {
                if (rt_data.hasOwnProperty(field)) {
                    result[field] = rt_data[field];
                }
            });

            result["dateTime"] = rt_data["dateTime"]
            result["timestamp"] = rt_data["timestamp"]

            if (Object.keys(result).length === 0) {
                return errorResponse(res, `Không tìm thấy field nào hợp lệ trong: ${fields.join(', ')}`, 404);
            }

            return successResponse(res, result, `Lấy dữ liệu theo field: ${fields.join(', ')}`);
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
            const { pageNum, pageSize, sortBy, from, to } = req.query

            let history_collection = firestore.collection("history_sensor_data")

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
                    dateTime: Date.format('YYYY-MM-DD HH:mm:ss.SSS')
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
}

module.exports = telemetry;