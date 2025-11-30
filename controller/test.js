const { successResponse, errorResponse } = require('../asset/response');
const authenticateToken = require('../config/authenticateToken');
const sendEmail = require('../config/send_email');

const test = (app) => {
    // Test send email
    app.post('/api/test/send-email', authenticateToken, async (req, res) => {
        try {
            const { device_name } = req.body;

            if (!device_name) {
                return errorResponse(res, 'device name are required', 400);
            }

            await sendEmail(device_name);

            return successResponse(res, null, 'Email sent successfully');
        } catch (error) {
            return errorResponse(res, `Failed to send email: ${error.message}`, 500);
        }
    });
};

module.exports = test;