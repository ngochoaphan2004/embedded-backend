/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API xác thực người dùng bằng JWT
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Đăng nhập và lấy token JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "user1"
 *               password:
 *                 type: string
 *                 example: "password1"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về token JWT
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
 *                   example: "Đăng nhập thành công"
 *                 data:
 *                   type: string
 *                   description: JWT token hợp lệ
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Thiếu hoặc sai thông tin đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Tên người dùng hoặc mật khẩu không đúng"
 *       500:
 *         description: Lỗi hệ thống
 */
