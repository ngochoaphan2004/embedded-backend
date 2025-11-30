/**
 * @swagger
 * tags:
 *   - name: Test
 *     description: API test các chức năng
 */

/**
 * @swagger
 * /api/test/send-email:
 *   post:
 *     summary: Gửi email test
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               device_name:
 *                 type: string
 *                 example: "device1"
 *                 description: Tên thiết bị
 *             required:
 *               - device_name
 *     responses:
 *       200:
 *         description: Gửi email thành công
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
 *                   example: "Email sent successfully"
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       403:
 *         description: Truy cập bị từ chối (token không hợp lệ hoặc hết hạn)
 *       500:
 *         description: Lỗi hệ thống
 */