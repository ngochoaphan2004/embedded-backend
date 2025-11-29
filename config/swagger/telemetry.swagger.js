/**
 * @swagger
 * tags:
 *   name: Telemetry
 *   description: API lấy dữ liệu cảm biến từ Firebase và Firestore
 */

/**
 * @swagger
 * /api/data/realtime:
 *   get:
 *     summary: Lấy dữ liệu cảm biến realtime
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: getBy
 *         schema:
 *           type: string
 *           example: "temperature,humidity"
 *         description: >
 *           Các field cần lấy, phân tách bằng dấu phẩy.  
 *           Nếu bỏ trống sẽ trả về toàn bộ dữ liệu.  
 *           Bao gồm các thuộc tính: temperature, humidity, ledState, pumpState, rainfall, soilMoisture, waterLevel.
 *     responses:
 *       200:
 *         description: Lấy dữ liệu cảm biến thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy dữ liệu theo field: temperature, humidity"
 *                 data:
 *                   type: object
 *                   properties:
 *                     temperature:
 *                       type: number
 *                       example: 26.5
 *                     humidity:
 *                       type: number
 *                       example: 78
 *                     soilMoisture:
 *                       type: number
 *                       example: 45
 *                     waterLevel:
 *                       type: number
 *                       example: 18
 *                     rainfall:
 *                       type: number
 *                       example: 12
 *                     dateTime:
 *                       type: string
 *                       example: "2025-11-08 20:00:00"
 *                     timestamp:
 *                       type: number
 *                       example: 1762506684597
 *                     latestData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           temperature:
 *                             type: number
 *                             example: 25.3
 *                           humidity:
 *                             type: number
 *                             example: 82
 *                           soilMoisture:
 *                             type: number
 *                             example: 45
 *                           waterLevel:
 *                             type: number
 *                             example: 18
 *                           rainfall:
 *                             type: number
 *                             example: 12
 *                           dateTime:
 *                             type: string
 *                             example: "2025-11-08 20:00:00.000"
 *                           timestamp:
 *                             type: number
 *                             example: 1762506684597
 *       400:
 *         description: Lỗi khi lấy dữ liệu
 *       404:
 *         description: Không tìm thấy field hợp lệ
 *       500:
 *         description: Lỗi hệ thống
 */

/**
 * @swagger
 * /api/data/history:
 *   get:
 *     summary: Lấy lịch sử dữ liệu cảm biến (hỗ trợ lọc theo thời gian)
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageNum
 *         schema:
 *           type: integer
 *           example: 0
 *         description: Số thứ tự trang (bắt đầu từ 0)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Số lượng bản ghi mỗi trang
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *           example: newest
 *         description: Cách sắp xếp dữ liệu theo thời gian (mới nhất hoặc cũ nhất)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2025-11-01T00:00:00Z"
 *         description: >
 *           Thời gian bắt đầu lọc dữ liệu (ISO 8601).
 *           Nếu chỉ có `from`, hệ thống sẽ lấy tất cả dữ liệu **từ thời điểm này trở về sau**.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2025-11-10T23:59:59Z"
 *         description: >
 *           Thời gian kết thúc lọc dữ liệu (ISO 8601).
 *           Nếu chỉ có `to`, hệ thống sẽ lấy tất cả dữ liệu **đến thời điểm này trở về trước**.
 *     responses:
 *       200:
 *         description: Lấy lịch sử dữ liệu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "ab23cd45"
 *                       temperature:
 *                         type: number
 *                         example: 25.3
 *                       humidity:
 *                         type: number
 *                         example: 82
 *                       soilMoisture:
 *                         type: number
 *                         example: 45
 *                       waterLevel:
 *                         type: number
 *                         example: 18
 *                       rainfall:
 *                         type: number
 *                         example: 12
 *                       dateTime:
 *                         type: string
 *                         example: "2025-11-08 20:00:00.000"
 *                       timestamp:
 *                         type: number
 *                         example: 1762506684597
 *       400:
 *         description: Thiếu tham số bắt buộc hoặc định dạng thời gian không hợp lệ
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống
 */

/**
 * @swagger
 * /api/control/pump:
 *   post:
 *     summary: Điều khiển máy bơm (bật/tắt)
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [on, off]
 *                 example: "on"
 *                 description: Hành động điều khiển máy bơm
 *     responses:
 *       200:
 *         description: Điều khiển máy bơm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Pump turned on successfully"
 *       400:
 *         description: Tham số action không hợp lệ
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống hoặc lỗi kết nối MQTT
 */

/**
 * @swagger
 * /api/control/led:
 *   post:
 *     summary: Điều khiển LED (bật/tắt)
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [on, off]
 *                 example: "on"
 *                 description: Hành động điều khiển LED
 *     responses:
 *       200:
 *         description: Điều khiển LED thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "LED turned on successfully"
 *       400:
 *         description: Tham số action không hợp lệ
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống hoặc lỗi kết nối MQTT
 */
