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
 *         description: "Các field cần lấy, phân tách bằng dấu phẩy. Nếu bỏ trống sẽ trả về toàn bộ dữ liệu. Bao gồm các thuộc tính :temperature, humidity, ledState, pumpState, rainfall, soilMoisture, temperature, waterLevel" 
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
 *                     dateTime:
 *                       type: string
 *                       example: "2025-11-08 20:00:00"
 *                     timestamp:
 *                       type: number
 *                       example: 1762506684597
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
 *     summary: Lấy lịch sử dữ liệu cảm biến
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
 *         description: Cách sắp xếp dữ liệu theo thời gian
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
 *                       timestamp:
 *                         type: number
 *                         example: 1762506684597
 *                       dateTime:
 *                         type: string
 *                         example: "2025-11-08 20:00:00.000"
 *       400:
 *         description: Thiếu tham số bắt buộc
 *       500:
 *         description: Lỗi hệ thống
 */

