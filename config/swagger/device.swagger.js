/**
 * @swagger
 * tags:
 *   - name: Device
 *     description: API điều khiển trạng thái thiết bị
 */


/**
 * @swagger
 * /api/device/{deviceName}/on:
 *   post:
 *     summary: Bật thiết bị
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *           example: "device1"
 *         description: Tên thiết bị cần bật
 *     responses:
 *       200:
 *         description: Bật thiết bị thành công
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
 *                   example: "Device device1 turned on successfully"
 *       404:
 *         description: Thiết bị không tìm thấy
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống
 */

/**
 * @swagger
 * /api/device/{deviceName}/off:
 *   post:
 *     summary: Tắt thiết bị
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *           example: "device1"
 *         description: Tên thiết bị cần tắt
 *     responses:
 *       200:
 *         description: Tắt thiết bị thành công
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
 *                   example: "Device device1 turned off successfully"
 *       404:
 *         description: Thiết bị không tìm thấy
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống
 */
