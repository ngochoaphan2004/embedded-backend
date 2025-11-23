const { successResponse, errorResponse } = require('../asset/response');
const authenticateToken = require('../config/authenticateToken');

const chatbot = (app) => {
  // POST /api/chatbot
  // body: { message: string, sensorData?: object, includeSensors?: boolean }
  app.post('/api/chatbot', authenticateToken, async (req, res) => {
    try {
      const { message, sensorData, includeSensors } = req.body || {};

      if (!message || message.trim() === '') {
        return errorResponse(res, 'Thiếu trường `message` trong body', 400);
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return errorResponse(res, 'GEMINI_API_KEY chưa được cấu hình. Thêm GEMINI_API_KEY vào file .env trong thư mục backend hoặc export vào biến môi trường.', 500);
      }

      const mod = await import('@google/genai');
      const GoogleGenAI = mod.GoogleGenAI || mod.default?.GoogleGenAI || mod.default || mod;

      const client = new GoogleGenAI({ apiKey: geminiKey });

      let systemPrompt = `Bạn là trợ lý SmartFarm. Trả lời ngắn gọn, rõ ràng bằng tiếng Việt. Nếu có dữ liệu cảm biến được cung cấp thì hãy sử dụng nó để trả lời vào ngữ cảnh phù hợp.`;

      let contextBlock = '';
      if (includeSensors && sensorData) {
        contextBlock = `\nDữ liệu cảm biến hiện tại: ${JSON.stringify(sensorData)}\n`;
      }

      const prompt = `${systemPrompt}${contextBlock}\nNgười dùng: ${message}\nTrợ lý:`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response?.text || (response?.outputs && response.outputs[0]?.content) || JSON.stringify(response);

      return successResponse(res, { reply: text });
    } catch (error) {
      console.error('chatbot error', error);
      return errorResponse(res, `Lỗi khi gọi Gemini: ${error.message || 'Không xác định'}`, 500);
    }
  });
};

module.exports = chatbot;
