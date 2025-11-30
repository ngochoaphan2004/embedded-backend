const { successResponse, errorResponse } = require('../asset/response');
const authenticateToken = require('../config/authenticateToken');
const fs = require('fs');
const path = require('path');
const cluster = require('../config/cluster_config');
const { firestore } = require('../firebase/firebase');

const CONTROL_KEYWORDS = ['bat', 'tat', 'turn on', 'turn off', 'mo', 'dong', 'start', 'stop', 'ngat', 'khoi dong', 'shutdown'];
const DEVICE_KEYWORDS = ['thiet bi', 'device', 'den', 'led', 'lamp', 'anh sang', 'bom', 'pump', 'may bom', 'quat', 'fan'];
const SENSOR_KEYWORDS = ['nhiet do', 'temperature', 'do am', 'humidity', 'do am dat', 'soil moisture', 'soil', 'luong mua', 'rainfall', 'mua', 'muc nuoc', 'water level', 'water'];
const INFO_KEYWORDS = [
  'thong tin', 'huong dan', 'tai lieu', 'support', 'lien he', 'bao hanh', 'gioi thieu', 'chinh sach', 'policy', 'faq', 'thong tin he thong', 'contact', 'manual',
  'cap nhat', 'chu ky', 'tan suat', 'update', 'frequency', 'interval', 'how often', 'bao nhieu giay', 'moi lan', 'every', 'seconds', 'cycle', 'refresh', 'system work', 'hoat dong he thong'
];

const VIETNAM_TIMEZONE = 'Asia/Bangkok';

const BUILTIN_ACTUATORS = [
  {
    id: 'light',
    label: 'Hệ thống đèn',
    type: 'actuator',
    actuator: 'light',
    aliases: ['den', 'light', 'lamp', 'led', 'anh sang'],
  },
  {
    id: 'pump',
    label: 'Máy bơm',
    type: 'actuator',
    actuator: 'pump',
    aliases: ['bom', 'pump', 'may bom'],
  },
];

const RELATIVE_TIME_KEYWORDS = {
  phut: { unit: 'minute', label: 'phút', ms: 60 * 1000 },
  minute: { unit: 'minute', label: 'phút', ms: 60 * 1000 },
  min: { unit: 'minute', label: 'phút', ms: 60 * 1000 },
  gio: { unit: 'hour', label: 'giờ', ms: 60 * 60 * 1000 },
  hour: { unit: 'hour', label: 'giờ', ms: 60 * 60 * 1000 },
  ngay: { unit: 'day', label: 'ngày', ms: 24 * 60 * 60 * 1000 },
  day: { unit: 'day', label: 'ngày', ms: 24 * 60 * 60 * 1000 },
};

const RELATIVE_UNIT_PATTERN = Object.keys(RELATIVE_TIME_KEYWORDS).join('|');
const RELATIVE_TIME_TOLERANCE = 0.5;

const NUMBER_WORD_MAP = Object.freeze({
  mot: '1',
  nhat: '1',
  one: '1',
  first: '1',
  hai: '2',
  second: '2',
  two: '2',
  ba: '3',
  third: '3',
  three: '3',
  bon: '4',
  tu: '4',
  fourth: '4',
  four: '4',
  nam: '5',
  five: '5',
  fifth: '5',
  sau: '6',
  six: '6',
  sixth: '6',
  bay: '7',
  seven: '7',
  seventh: '7',
  tam: '8',
  eight: '8',
  eighth: '8',
  chin: '9',
  nine: '9',
  ninth: '9',
  muoi: '10',
  ten: '10',
  tenth: '10',
});

const LANGUAGE_KEYWORDS = Object.freeze({
  vi: ['nhiet', 'thiet', 'thong tin', 'ho tro', 'huong dan', 'lien he', 'bao hanh', 'chu ky', 'tan suat', 'thiet bi', 'den', 'bom', 'may bom', 'do am', 'mua'],
  en: ['temperature', 'humidity', 'device', 'turn on', 'turn off', 'support', 'contact', 'manual', 'policy', 'update', 'frequency', 'cycle', 'sensor', 'water', 'rainfall', 'light', 'pump', 'fan'],
});

let geminiClientCache = null;

async function getGeminiClient() {
  if (geminiClientCache) {
    return geminiClientCache;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình. Thêm GEMINI_API_KEY vào file .env trong thư mục backend hoặc export vào biến môi trường.');
  }

  const mod = await import('@google/genai');
  const GoogleGenAI = mod.GoogleGenAI || mod.default?.GoogleGenAI || mod.default || mod;
  geminiClientCache = new GoogleGenAI({ apiKey: geminiKey });
  return geminiClientCache;
}

const chatbot = (app) => {
  // POST /api/chatbot
  // body: { message: string, sensorData?: object, includeSensors?: boolean }
  app.post('/api/chatbot', authenticateToken, async (req, res) => {
    try {
      const { message, sensorData, includeSensors } = req.body || {};

      if (!message || message.trim() === '') {
        return errorResponse(res, 'Thiếu trường `message` trong body', 400);
      }

      const language = detectLanguage(message);

      // 1) Phân loại intent theo ưu tiên: Sensor -> Control -> Info
      const intent = classifyIntent(message, language);

      // 2) Xử lý theo intent
      if (intent.type === 'sensor') {
        const timeCtx = extractTimeContext(message);
        const reply = await handleSensorQuery(sensorData, includeSensors, timeCtx, message, language);
        return successResponse(res, { reply, language });
      }

      if (intent.type === 'control') {
        const commands = await parseControlCommands(message);
        const reply = await handleControlIntent(commands);
        return successResponse(res, { reply, language });
      }

      if (intent.type === 'info') {
        const reply = await handleInfoQuery(message);
        return successResponse(res, { reply, language });
      }

      // 3) Fallback: gọi Gemini khi không phân loại được
      let client;
      try {
        client = await getGeminiClient();
      } catch (error) {
        return errorResponse(res, error.message || 'Không thể khởi tạo Gemini', 500);
      }

      let systemPrompt = `Bạn là trợ lý SmartFarm. Trả lời ngắn gọn, rõ ràng bằng tiếng Việt. Nếu có dữ liệu cảm biến được cung cấp thì hãy sử dụng nó để trả lời vào ngữ cảnh phù hợp.`;

      let contextBlock = '';
      if (includeSensors && sensorData) {
        const sensorLines = SENSOR_DEFINITIONS.map(sensor => {
          const value = sensor.getValue(sensorData);
          if (value === undefined || value === null) {
            return null;
          }
          if (sensor.type === 'status') {
            return `${sensor.label}: ${formatOnOff(value)}`;
          }
          const numeric = normalizeNumber(value);
          const formatted = Number.isFinite(numeric) ? `${numeric.toFixed(1)}${sensor.unit || ''}` : value;
          return `${sensor.label}: ${formatted}`;
        }).filter(Boolean);

        const sensorTimestamp = formatTimestamp(sensorData?.dateTime || sensorData?.timestamp);
        if (sensorLines.length > 0) {
          contextBlock = `\n\nDữ liệu cảm biến hiện tại:\n${sensorLines.join('\n')}`;
          if (sensorTimestamp) {
            contextBlock += `\nThời gian cập nhật: ${sensorTimestamp}`;
          }
        }
      }

      const prompt = `${systemPrompt}${contextBlock}\nNgười dùng (${language || 'unknown'}): ${message}\nTrợ lý:`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response?.text || (response?.outputs && response.outputs[0]?.content) || JSON.stringify(response);

      return successResponse(res, { reply: text, language });
    } catch (error) {
      console.error('chatbot error', error);
      return errorResponse(res, `Lỗi khi gọi Gemini: ${error.message || 'Không xác định'}`, 500);
    }
  });
};

module.exports = chatbot;

// -------------------- Helpers --------------------
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function getLanguageAwareTexts(message, language = 'mixed') {
  const normalized = normalize(message);
  const english = (message || '').toLowerCase().trim();

  if (language === 'vi') {
    return normalized ? [normalized] : [];
  }

  if (language === 'en') {
    return english ? [english] : [];
  }

  const variants = new Set();
  if (normalized) {
    variants.add(normalized);
  }
  if (english) {
    variants.add(english);
  }
  return Array.from(variants);
}

function detectLanguage(message) {
  const normalized = normalize(message);
  const english = (message || '').toLowerCase();

  const viScore = LANGUAGE_KEYWORDS.vi.reduce(
    (score, keyword) => (normalized.includes(keyword) ? score + 1 : score),
    0,
  );
  const enScore = LANGUAGE_KEYWORDS.en.reduce(
    (score, keyword) => (english.includes(keyword) ? score + 1 : score),
    0,
  );

  if (viScore === 0 && enScore === 0) {
    return 'mixed';
  }
  if (viScore >= enScore + 1) {
    return 'vi';
  }
  if (enScore >= viScore + 1) {
    return 'en';
  }
  return 'mixed';
}

function classifyIntent(message, language = 'mixed') {
  const samples = getLanguageAwareTexts(message, language);
  if (!samples.length) {
    return { type: 'unknown' };
  }

  const contains = (keywords) => samples.some(sample => keywords.some(keyword => sample.includes(keyword)));

  if (contains(CONTROL_KEYWORDS) && contains(DEVICE_KEYWORDS)) {
    return { type: 'control' };
  }

  if (contains(SENSOR_KEYWORDS) || contains(DEVICE_KEYWORDS)) {
    return { type: 'sensor' };
  }

  if (contains(INFO_KEYWORDS)) {
    return { type: 'info' };
  }

  return { type: 'unknown' };
}

function extractTimeContext(message) {
  const msg = normalize(message);
  if (!msg) {
    return { kind: 'current' };
  }

  const relativeRegex = new RegExp(`(\\d+(?:[\\.,]\\d+)?)\\s*(${RELATIVE_UNIT_PATTERN})\\b(?:\\s*(truoc|ago))?`);
  const relativeMatch = msg.match(relativeRegex);
  if (relativeMatch) {
    const rawValue = relativeMatch[1].replace(',', '.');
    const value = parseFloat(rawValue);
    const unitKey = relativeMatch[2];
    const unitConfig = RELATIVE_TIME_KEYWORDS[unitKey];

    if (unitConfig && Number.isFinite(value) && value > 0) {
      const now = Date.now();
      const windowEnd = now - value * unitConfig.ms;
      const windowStart = now - (value + RELATIVE_TIME_TOLERANCE) * unitConfig.ms;
      const description = `${value} ${unitConfig.label} trước`;

      return {
        kind: 'relative',
        unit: unitConfig.unit,
        value,
        windowStart,
        windowEnd,
        description,
      };
    }
  }

  if (msg.includes('hien tai') || msg.includes('now') || msg.includes('hien tai la') || msg.includes('current')) {
    return { kind: 'current' };
  }

  if (msg.includes('truoc') || msg.includes('ago') || msg.includes('tai thoi diem') || msg.includes('vao luc') || msg.includes('luc')) {
    return { kind: 'unsupportedPast' };
  }

  return { kind: 'current' };
}

async function handleSensorQuery(sensorData, includeSensors, timeCtx, message = '', language = 'mixed') {
  if (timeCtx.kind === 'unsupportedPast') {
    return 'Vui lòng nêu rõ thời gian cụ thể (ví dụ: "nhiệt độ 5 phút trước") để tôi có thể tra cứu dữ liệu lịch sử đúng yêu cầu.';
  }

  const requestedSensors = extractSensorTargets(message, language);
  const restrictToRequest = requestedSensors.length > 0;
  const requestedSet = new Set(requestedSensors);
  const normalizedMessage = normalize(message);

  const genericDeviceName = !restrictToRequest ? extractDeviceNameFromMessage(normalizedMessage) : null;

  if (genericDeviceName) {
    if (timeCtx.kind === 'relative') {
      return 'Hiện tại tôi chỉ hỗ trợ truy vấn trạng thái thiết bị theo thời gian thực, chưa thể xem trạng thái trong quá khứ.';
    }
    return await describeSingleDevice(genericDeviceName);
  }

  if (!restrictToRequest && isDeviceStatusQuestion(normalizedMessage)) {
    if (timeCtx.kind === 'relative') {
      return 'Truy vấn trạng thái thiết bị ở quá khứ chưa được hỗ trợ. Bạn có thể hỏi trạng thái hiện tại.';
    }
    return await describeAllDevices();
  }

  let effectiveData = sensorData;

  if (timeCtx.kind === 'relative') {
    effectiveData = await fetchHistoricalSensorData(timeCtx);
    if (!effectiveData) {
      return `Không tìm thấy dữ liệu trong khoảng ${timeCtx.description}. Vui lòng thử với khoảng thời gian khác.`;
    }
  } else if (!includeSensors || !sensorData) {
    effectiveData = await fetchRealtimeSensorData();
    if (!effectiveData) {
      return 'Hiện không thể lấy dữ liệu cảm biến theo thời gian thực. Vui lòng thử lại sau ít phút.';
    }
  }

  const sensors = SENSOR_DEFINITIONS.filter(sensor => !restrictToRequest || requestedSet.has(sensor.key));
  const addTimeNote = (text) => withTimeContext(text, timeCtx);

  if (restrictToRequest) {
    if (sensors.length === 0) {
      return 'Xin lỗi, tôi chưa hiểu bạn muốn xem cảm biến nào.';
    }

    const formatted = [];
    const missing = [];

    sensors.forEach(sensor => {
      const value = sensor.getValue(effectiveData);
      if (value === undefined || value === null) {
        missing.push(sensor.label);
        return;
      }
      formatted.push(formatSingleSensor(sensor, value, effectiveData));
    });

    if (formatted.length === 0) {
      return 'Không có dữ liệu cho cảm biến mà bạn đã hỏi.';
    }

    if (formatted.length === 1 && missing.length === 0) {
      return addTimeNote(formatted[0]);
    }

    const missingNotice = missing.length ? `\n\n⚠️ Không có dữ liệu cho: ${missing.join(', ')}.` : '';
    const content = formatted.map(text => `• ${text}`).join('\n\n');
    return addTimeNote(`📌 **Thông tin bạn yêu cầu:**\n\n${content}${missingNotice}`);
  }

  return addTimeNote(formatAllSensors(effectiveData));
}

function extractSensorTargets(message = '', language = 'mixed') {
  const haystacks = getLanguageAwareTexts(message, language);
  if (!haystacks.length) {
    return [];
  }

  const has = (phrase) => haystacks.some(text => text.includes(phrase));
  const targets = new Set();

  if (has('nhiet do') || has('temperature') || has('temp')) {
    targets.add('temperature');
  }

  const soilKeywords = ['do am dat', 'dat am', 'soil moisture', 'soil', 'am dat'];
  const mentionsSoil = soilKeywords.some(has);
  if (mentionsSoil) {
    targets.add('soilMoisture');
  }

  if (
    has('do am khong khi') ||
    has('do am moi truong') ||
    has('humidity') ||
    (has('do am') && !mentionsSoil)
  ) {
    targets.add('humidity');
  }

  if (has('luong mua') || has('rainfall') || has('mua') || has('rain')) {
    targets.add('rainfall');
  }

  if (has('muc nuoc') || has('water level') || has('water')) {
    targets.add('waterLevel');
  }

  if (has('den') || has('light') || has('lamp') || has('anh sang') || has('led')) {
    targets.add('lightStatus');
  }

  if (has('bom') || has('pump') || has('may bom')) {
    targets.add('pumpStatus');
  }

  return Array.from(targets);
}

const SENSOR_DEFINITIONS = [
  {
    key: 'temperature',
    label: 'Nhiệt độ',
    unit: '°C',
    icon: '🌡️',
    getValue: (data) => data?.temperature,
  },
  {
    key: 'humidity',
    label: 'Độ ẩm',
    unit: '%',
    icon: '💧',
    getValue: (data) => data?.humidity,
  },
  {
    key: 'soilMoisture',
    label: 'Độ ẩm đất',
    unit: '%',
    icon: '🌱',
    getValue: (data) => data?.soilMoisture,
  },
  {
    key: 'rainfall',
    label: 'Lượng mưa',
    unit: 'mm',
    icon: '🌧️',
    getValue: (data) => data?.rainfall,
  },
  {
    key: 'waterLevel',
    label: 'Mực nước',
    unit: 'cm',
    icon: '💦',
    getValue: (data) => data?.waterLevel,
  },
  {
    key: 'lightStatus',
    label: 'Trạng thái đèn',
    icon: '💡',
    type: 'status',
    getValue: (data) => data?.lightStatus,
  },
  {
    key: 'pumpStatus',
    label: 'Trạng thái máy bơm',
    icon: '🔧',
    type: 'status',
    getValue: (data) => data?.pumpStatus,
  },
];

function formatAllSensors(sensorData) {
  if (!sensorData) {
    return 'Xin lỗi, tôi chưa thể lấy dữ liệu cảm biến. Vui lòng thử lại sau.';
  }

  const lines = SENSOR_DEFINITIONS.map(sensor => {
    const value = sensor.getValue(sensorData);
    if (value === undefined || value === null) {
      return `${sensor.icon} ${sensor.label}: N/A`;
    }
    if (sensor.type === 'status') {
      return `${sensor.icon} ${sensor.label}: ${formatOnOff(value)}`;
    }
    const numeric = normalizeNumber(value);
    const formatted = Number.isFinite(numeric) ? numeric.toFixed(1) : value;
    return `${sensor.icon} ${sensor.label}: ${formatted}${sensor.unit || ''}`;
  });

  const timestamp = formatTimestamp(sensorData?.dateTime || sensorData?.timestamp);
  const timestampLine = timestamp ? `\n\n⏰ Cập nhật lúc: ${timestamp}` : '';
  return `📊 **Tất cả thông số cảm biến hiện tại:**\n\n${lines.join('\n')}${timestampLine}`;
}

function formatSingleSensor(sensor, rawValue, sensorData) {
  if (sensor.type === 'status') {
    const state = formatOnOff(rawValue);
    return `${sensor.label} hiện tại đang: **${state.toUpperCase()}**${appendTimestamp(sensorData)}`;
  }

  const numeric = normalizeNumber(rawValue);
  if (!Number.isFinite(numeric)) {
    return `Xin lỗi, tôi không tìm thấy dữ liệu cho ${sensor.label}.`;
  }

  let response = `${sensor.label} hiện tại là: **${numeric.toFixed(1)}${sensor.unit || ''}**`;

  if (sensor.key === 'temperature') {
    if (numeric < 20) response += ' (Thấp)';
    else if (numeric <= 30) response += ' (Bình thường)';
    else response += ' (Cao)';
  } else if (sensor.key === 'humidity') {
    if (numeric < 40) response += ' (Thấp)';
    else if (numeric <= 70) response += ' (Bình thường)';
    else response += ' (Cao)';
  } else if (sensor.key === 'soilMoisture') {
    if (numeric < 30) response += ' (Thấp - Cần tưới nước)';
    else if (numeric <= 60) response += ' (Bình thường)';
    else response += ' (Cao)';
  }

  return `${response}${appendTimestamp(sensorData)}`;
}

function appendTimestamp(sensorData) {
  const timestamp = formatTimestamp(sensorData?.dateTime || sensorData?.timestamp);
  return timestamp ? `\n⏰ Cập nhật lúc: ${timestamp}` : '';
}

function formatTimestamp(value) {
  if (!value) return null;

  const formatVietnamTime = (date) => date?.toLocaleString('vi-VN', { timeZone: VIETNAM_TIMEZONE });

  try {
    if (value instanceof Date) {
      return formatVietnamTime(value);
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : formatVietnamTime(parsed);
    }
    if (typeof value === 'number') {
      return formatVietnamTime(new Date(value));
    }
    if (typeof value.toDate === 'function') {
      return formatVietnamTime(value.toDate());
    }

    const seconds = value.seconds ?? value._seconds;
    if (typeof seconds === 'number') {
      const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
      const date = new Date(seconds * 1000 + nanos / 1e6);
      return formatVietnamTime(date);
    }
  } catch (error) {
    console.warn('Không thể định dạng timestamp chatbot:', error);
  }

  return null;
}

function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseNumericToken(token) {
  if (!token) {
    return null;
  }
  const sanitized = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sanitized) {
    return null;
  }
  if (/^\d+$/.test(sanitized)) {
    return sanitized;
  }
  return NUMBER_WORD_MAP[sanitized] || null;
}

function resolveDeviceIdentifierFromToken(token) {
  const numeric = parseNumericToken(token);
  if (numeric) {
    return `device${numeric}`;
  }
  if (token && token.startsWith('device')) {
    return token;
  }
  return null;
}

function isDeviceStatusQuestion(normalizedMessage) {
  if (!normalizedMessage) {
    return false;
  }
  return DEVICE_KEYWORDS.some(keyword => normalizedMessage.includes(keyword));
}

function formatOnOff(v) {
  if (typeof v === 'boolean') return v ? 'Bật' : 'Tắt';
  if (typeof v === 'string') {
    const s = normalize(v);
    if (s.includes('on') || s.includes('bat')) return 'Bật';
    if (s.includes('off') || s.includes('tat')) return 'Tắt';
  }
  if (typeof v === 'number') return v ? 'Bật' : 'Tắt';
  return String(v);
}

async function parseControlCommands(message) {
  const basicCommand = extractControlAction(message);
  const normalizedMessage = normalize(message);
  const mentions = extractDeviceMentions(normalizedMessage);
  const useAi = shouldUseAiForControl(normalizedMessage, mentions, basicCommand);

  if (!useAi) {
    return basicCommand ? [basicCommand] : [];
  }

  let commands = [];
  try {
    const deviceCatalog = await listControllableDevices();
    if (!deviceCatalog.length) {
      return basicCommand ? [basicCommand] : [];
    }

    const client = await getGeminiClient();
    const prompt = buildControlPrompt(message, deviceCatalog);
    const responseText = await generateGeminiText(client, prompt);
    const parsed = parseJsonFromText(responseText);
    const parsedCommands = Array.isArray(parsed?.commands) ? parsed.commands : [];

    commands = parsedCommands
      .map(cmd => {
        const action = normalize(cmd?.action);
        if (!action || (action !== 'on' && action !== 'off')) {
          return null;
        }

        const targetId = normalizeIdentifier(cmd?.target || cmd?.device || cmd?.name);
        if (!targetId) {
          return null;
        }

        const matched = deviceCatalog.find(device => {
          const normalizedId = normalizeIdentifier(device.id);
          if (normalizedId === targetId) {
            return true;
          }
          const aliasMatched = (device.aliases || []).some(alias => normalizeIdentifier(alias) === targetId);
          return aliasMatched;
        });

        if (!matched) {
          return null;
        }

        if (matched.type === 'actuator') {
          return { type: 'actuator', device: matched.actuator, action };
        }

        return { type: 'generic-device', deviceName: matched.id, action };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('parse control commands error', error);
  }

  if (commands.length) {
    return commands;
  }

  return basicCommand ? [basicCommand] : [];
}

function extractDeviceMentions(normalizedMessage) {
  if (!normalizedMessage) {
    return [];
  }

  const mentions = new Set();

  const deviceWordPattern = /(device|thiet\s*bi)(?:\s*(?:number|so))?\s*([a-z0-9]+)/g;
  let match;
  while ((match = deviceWordPattern.exec(normalizedMessage)) !== null) {
    const token = (match[2] || '').trim();
    const numeric = parseNumericToken(token);
    if (numeric) {
      mentions.add(`device${numeric}`);
    }
  }

  BUILTIN_ACTUATORS.forEach(actuator => {
    if (actuator.aliases.some(alias => normalizedMessage.includes(alias))) {
      mentions.add(actuator.id);
    }
  });

  return Array.from(mentions);
}

function shouldUseAiForControl(normalizedMessage, mentions, basicCommand) {
  if (!normalizedMessage) {
    return false;
  }

  if (mentions.length > 1) {
    return true;
  }

  const hasMultipleActions = normalizedMessage.includes('bat') && normalizedMessage.includes('tat');
  if (hasMultipleActions && mentions.length) {
    return true;
  }

  const hasConnector = /(\bva\b|\band\b|,)/.test(normalizedMessage);
  if (hasConnector && mentions.length) {
    return true;
  }

  if (!basicCommand && mentions.length) {
    return true;
  }

  return false;
}

function withTimeContext(text, timeCtx) {
  if (!text || !timeCtx || timeCtx.kind !== 'relative' || !timeCtx.description) {
    return text;
  }
  return `${text}\n\n🕒 Dữ liệu tương ứng khoảng ${timeCtx.description}.`;
}

async function fetchRealtimeSensorData() {
  const collections = await getActiveCollections();
  if (!collections.length) {
    return null;
  }

  const latestDocs = [];
  for (const coll of collections) {
    const snapshot = await firestore.collection(coll).orderBy('dateTime', 'desc').limit(1).get();
    if (!snapshot.empty) {
      latestDocs.push({ ...snapshot.docs[0].data(), collection: coll });
    }
  }

  if (!latestDocs.length) {
    return null;
  }

  const aggregated = {};
  const fieldCounts = {};

  latestDocs.forEach(doc => {
    Object.keys(doc).forEach(key => {
      const value = doc[key];
      if (typeof value === 'number') {
        aggregated[key] = (aggregated[key] || 0) + value;
        fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      } else if (aggregated[key] === undefined) {
        aggregated[key] = value;
      }
    });
  });

  Object.keys(fieldCounts).forEach(key => {
    aggregated[key] = Number((aggregated[key] / fieldCounts[key]).toFixed(2));
  });

  const newest = latestDocs.reduce((acc, doc) => {
    const millis = getMillis(doc.dateTime || doc.timestamp);
    if (millis && millis > acc) {
      return millis;
    }
    return acc;
  }, 0);

  if (newest) {
    aggregated.timestamp = newest;
    aggregated.dateTime = new Date(newest);
  }

  return aggregated;
}

async function fetchHistoricalSensorData(timeCtx) {
  const windowStart = new Date(timeCtx.windowStart);
  const windowEnd = new Date(timeCtx.windowEnd);

  const snapshot = await firestore
    .collection('history_sensor_data')
    .where('dateTime', '>=', windowStart)
    .where('dateTime', '<=', windowEnd)
    .orderBy('dateTime', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const data = snapshot.docs[0].data() || {};
  if (!data.timestamp) {
    const millis = getMillis(data.dateTime);
    if (millis) {
      data.timestamp = millis;
    }
  }
  return data;
}

async function getActiveCollections() {
  try {
    const snapshot = await firestore.collection('active_device').where('status', '==', true).get();
    if (snapshot.empty) {
      return ['history_sensor_data'];
    }
    const collections = snapshot.docs
      .map(doc => (doc.data() && doc.data().collection) || null)
      .filter(Boolean);
    return collections.length ? collections : ['history_sensor_data'];
  } catch (error) {
    console.error('getActiveCollections error', error);
    return ['history_sensor_data'];
  }
}

function getMillis(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value.seconds === 'number') {
    const nanos = value.nanoseconds || 0;
    return value.seconds * 1000 + nanos / 1e6;
  }
  return null;
}

function extractControlAction(message) {
  const msg = normalize(message);

  const onKeywords = ['bat', 'turn on', 'mo', 'start'];
  const offKeywords = ['tat', 'turn off', 'dung', 'stop', 'ngat'];
  const wantsOn = onKeywords.some(k => msg.includes(k));
  const wantsOff = offKeywords.some(k => msg.includes(k));
  const action = wantsOn && !wantsOff ? 'on' : wantsOff && !wantsOn ? 'off' : null;

  const isLight = ['den', 'light', 'lamp', 'led'].some(k => msg.includes(k));
  const isPump = ['bom', 'pump', 'may bom'].some(k => msg.includes(k));

  if ((isLight || isPump) && action) {
    return {
      type: 'actuator',
      device: isLight ? 'light' : 'pump',
      action,
    };
  }

  const targetName = action ? extractDeviceNameFromMessage(msg) : null;

  if (targetName && action) {
    return {
      type: 'generic-device',
      action,
      deviceName: targetName,
    };
  }

  return null;
}

async function listControllableDevices() {
  const catalog = BUILTIN_ACTUATORS.map(device => ({ ...device }));
  try {
    const snapshot = await firestore.collection('active_device').get();
    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const name = data.name || doc.id;
      const normalizedId = normalizeIdentifier(name);
      const exists = catalog.some(device => normalizeIdentifier(device.id) === normalizedId);
      if (!exists) {
        catalog.push({
          id: name,
          label: data.displayName || humanizeDeviceName(name),
          type: 'generic-device',
        });
      }
    });
  } catch (error) {
    console.error('list controllable devices error', error);
  }
  return catalog;
}

function buildControlPrompt(message, deviceCatalog) {
  const deviceLines = deviceCatalog
    .map(device => {
      const aliasText = device.aliases && device.aliases.length ? ` | aliases: ${device.aliases.join(', ')}` : '';
      return `- id: ${device.id} | name: ${device.label}${aliasText}`;
    })
    .join('\n');

  return `Bạn là bộ phân tích lệnh điều khiển thiết bị thông minh.\nDanh sách thiết bị có thể điều khiển:\n${deviceLines}\n\nYêu cầu:\n- Chuyển câu của người dùng thành JSON hợp lệ theo dạng {"commands":[{"target":"<id>","action":"on|off"}]}\n- target phải là một trong các id trong danh sách.\n- Nếu người dùng muốn bật/tắt nhiều thiết bị, tạo nhiều phần tử trong mảng commands.\n- Nếu người dùng không yêu cầu điều khiển cụ thể, trả về {"commands":[]}\n- Không thêm lời giải thích khác.\n\nCâu người dùng: "${message}"`;
}

function normalizeIdentifier(value) {
  if (!value) {
    return null;
  }
  return normalize(String(value)).replace(/\s+/g, '');
}

async function handleControlIntent(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return 'Bạn muốn điều khiển thiết bị nào? Vui lòng nêu rõ bật/tắt đèn, máy bơm hoặc thiết bị cụ thể.';
  }

  const uniqueCommands = [];
  const seen = new Set();
  commands.forEach(command => {
    if (!command || !command.action) {
      return;
    }
    const key = `${command.type}:${command.device || command.deviceName}:${command.action}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCommands.push(command);
    }
  });

  if (!uniqueCommands.length) {
    return 'Xin lỗi, tôi chưa hiểu thiết bị bạn muốn điều khiển.';
  }

  const results = [];
  for (const command of uniqueCommands) {
    results.push(await executeControlCommand(command));
  }

  if (results.length === 1) {
    return results[0];
  }

  return `🔧 Kết quả điều khiển:\n\n${results.map(res => `• ${res}`).join('\n')}`;
}

async function executeControlCommand(command) {
  if (!command || !command.action) {
    return 'Không thể xác định yêu cầu điều khiển.';
  }

  if (command.type === 'actuator') {
    const actionLabel = command.action === 'on' ? 'Bật' : 'Tắt';
    const deviceLabel = command.device === 'light' ? 'đèn' : command.device === 'pump' ? 'máy bơm' : 'thiết bị';
    try {
      if (command.device === 'light') {
        command.action === 'on' ? cluster.turnOnLed() : cluster.turnOffLed();
      } else if (command.device === 'pump') {
        command.action === 'on' ? cluster.turnOnPump() : cluster.turnOffPump();
      } else {
        return 'Xin lỗi, tôi chưa hỗ trợ điều khiển thiết bị này.';
      }
    } catch (error) {
      console.error('control actuator error', error);
      return `Không thể gửi lệnh ${actionLabel.toLowerCase()} ${deviceLabel}: ${error.message || 'Lỗi không xác định.'}`;
    }
    return `Đã gửi lệnh ${actionLabel} ${deviceLabel}. Vui lòng kiểm tra trạng thái sau vài giây.`;
  }

  if (command.type === 'generic-device') {
    return await toggleGenericDevice(command.deviceName, command.action === 'on');
  }

  return 'Xin lỗi, tôi chưa hỗ trợ thiết bị này.';
}

async function toggleGenericDevice(deviceName, shouldTurnOn) {
  const deviceLabel = humanizeDeviceName(deviceName);
  try {
    const docSnap = await findDeviceDocument(deviceName);

    if (!docSnap) {
      return `Không tìm thấy thông tin cho ${deviceLabel}.`;
    }

    await docSnap.ref.update({ status: shouldTurnOn });
    const stateLabel = shouldTurnOn ? 'BẬT' : 'TẮT';
    return `Đã cập nhật trạng thái ${deviceLabel} sang ${stateLabel}.`;
  } catch (error) {
    console.error('toggle device error', error);
    return `Không thể cập nhật ${deviceLabel}: ${error.message || 'Lỗi không xác định.'}`;
  }
}

async function describeAllDevices() {
  try {
    const snapshot = await firestore.collection('active_device').get();
    if (snapshot.empty) {
      return 'Hiện chưa có thiết bị nào được cấu hình trong hệ thống.';
    }

    const devices = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      const name = data.name || doc.id;
      return {
        name,
        displayName: data.displayName || humanizeDeviceName(name),
        status: Boolean(data.status),
      };
    });

    const lines = devices.map(device => {
      const stateLabel = device.status ? '**BẬT**' : '**TẮT**';
      return `• ${device.displayName}: ${stateLabel}`;
    });

    const activeDevices = devices.filter(device => device.status).map(device => device.displayName);
    const activeSummary = activeDevices.length
      ? `\n\n🔋 Đang bật: ${activeDevices.join(', ')}`
      : '\n\n🔌 Tất cả thiết bị đang tắt.';

    return `⚙️ **Trạng thái thiết bị hiện tại:**\n\n${lines.join('\n')}${activeSummary}`;
  } catch (error) {
    console.error('describe devices error', error);
    return 'Không thể truy vấn trạng thái thiết bị ngay lúc này. Vui lòng thử lại sau ít phút.';
  }
}

async function describeSingleDevice(deviceName) {
  try {
    const docSnap = await findDeviceDocument(deviceName);
    if (!docSnap) {
      return `Không tìm thấy thông tin cho ${humanizeDeviceName(deviceName)}.`;
    }

    const data = docSnap.data() || {};
    const displayName = data.displayName || humanizeDeviceName(data.name || deviceName);
    const stateLabel = data.status ? '**BẬT**' : '**TẮT**';
    return `${displayName} hiện đang: ${stateLabel}.`;
  } catch (error) {
    console.error('describe single device error', error);
    return 'Không thể truy vấn trạng thái thiết bị ngay lúc này. Vui lòng thử lại sau ít phút.';
  }
}

async function findDeviceDocument(deviceName) {
  try {
    const snapshot = await firestore
      .collection('active_device')
      .where('name', '==', deviceName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0];
  } catch (error) {
    console.error('find device doc error', error);
    return null;
  }
}

function humanizeDeviceName(name) {
  if (!name) return 'thiết bị không tên';
  const lower = String(name).toLowerCase();
  if (lower.startsWith('device') && lower.length > 'device'.length) {
    const suffix = lower.replace('device', '').trim();
    if (suffix) {
      return `Thiết bị ${suffix}`;
    }
  }
  if (/^\d+$/.test(lower)) {
    return `Thiết bị ${lower}`;
  }
  return name;
}

function extractDeviceNameFromMessage(msg) {
  if (!msg) {
    return null;
  }

  const generalMatch = msg.match(/(device|thiet\s*bi)(?:\s*(?:number|so))?\s*([a-z0-9]+)/);
  if (generalMatch) {
    const resolved = resolveDeviceIdentifierFromToken(generalMatch[2]);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function handleInfoQuery(message) {
  const docPath = path.join(__dirname, '..', 'documents.txt');

  let documentsRaw;
  try {
    documentsRaw = fs.readFileSync(docPath, 'utf8');
  } catch (error) {
    console.error('info query read error', error);
    return 'Không tìm thấy tài liệu hệ thống để tra cứu. Vui lòng cung cấp file documents.txt.';
  }

  let documents;
  try {
    documents = JSON.parse(documentsRaw);
  } catch (error) {
    console.error('info query parse error', error);
    return 'Tài liệu thông tin không hợp lệ. Vui lòng kiểm tra lại nội dung documents.txt.';
  }

  const topics = Object.entries(documents).filter(([key, value]) => Array.isArray(value) && value.length > 0);
  if (topics.length === 0) {
    return 'Tài liệu chưa có nội dung để tham chiếu.';
  }

  // Tăng khả năng nhận diện chủ đề liên quan đến chu kỳ cập nhật
  const systemWorkKeywords = [
    'cap nhat', 'chu ky', 'tan suat', 'update', 'frequency', 'interval', 'how often', 'bao nhieu giay', 'moi lan', 'every', 'seconds', 'cycle', 'refresh', 'system work', 'hoat dong he thong'
  ];
  const msgNorm = normalize(message);
  const isSystemWorkQuestion = systemWorkKeywords.some(k => msgNorm.includes(k));

  let client;
  try {
    client = await getGeminiClient();
  } catch (error) {
    return error.message || 'Không thể khởi tạo Gemini.';
  }

  const topicGuides = topics
    .map(([key, value]) => {
      const summary = value.join(' ');
      return `- ${key}: ${summary}`;
    })
    .join('\n');

  const classificationPrompt = `Bạn là bộ phân loại câu hỏi. Dựa trên danh sách chủ đề dưới đây, hãy chọn chủ đề phù hợp nhất với câu hỏi của người dùng.
Danh sách chủ đề:
${topicGuides}

Yêu cầu:
- Chỉ trả về JSON hợp lệ theo dạng {"category":"<tên chủ đề hoặc unknown>","confidence":<0-1>,"reason":"<giải thích ngắn gọn>"}.
- Nếu không có chủ đề phù hợp, đặt category là "unknown".

Câu hỏi người dùng: "${message}"`;

  let classificationText;
  try {
    classificationText = await generateGeminiText(client, classificationPrompt);
  } catch (error) {
    console.error('info classification error', error);
    return 'Không thể phân loại câu hỏi ngay lúc này. Vui lòng thử lại sau.';
  }

  const classification = parseJsonFromText(classificationText);
  let categoryKey = classification?.category?.toString().trim();
  const confidence = typeof classification?.confidence === 'number' ? classification.confidence : null;

  // Nếu là câu hỏi về chu kỳ cập nhật, ép trả về system_work nếu có
  if (isSystemWorkQuestion && documents['system_work']) {
    categoryKey = 'system_work';
  }

  if (!categoryKey || categoryKey === 'unknown' || !documents[categoryKey] || (confidence !== null && confidence < 0.4)) {
    // Nếu là câu hỏi về chu kỳ cập nhật, vẫn trả về thông tin system_work
    if (isSystemWorkQuestion && documents['system_work']) {
      const infoBlock = Array.isArray(documents['system_work']) ? documents['system_work'].join('\n') : String(documents['system_work']);
      return infoBlock;
    }
    return 'Xin lỗi, tôi chưa có thông tin phù hợp trong tài liệu để trả lời câu hỏi này.';
  }

  const topicContent = Array.isArray(documents[categoryKey]) ? documents[categoryKey] : [String(documents[categoryKey])];
  const infoBlock = topicContent.join('\n');

  const answerPrompt = `Bạn là trợ lý SmartFarm. Trả lời câu hỏi bằng tiếng Việt dựa hoàn toàn trên thông tin được cung cấp.
Thông tin tham khảo:
${infoBlock}

Lưu ý:
- Nếu thông tin không đủ để trả lời đầy đủ, hãy nói rõ những gì bạn biết.
- Không thêm dữ liệu bên ngoài nguồn.

Câu hỏi: "${message}"`;

  try {
    const answerText = await generateGeminiText(client, answerPrompt);
    return answerText?.trim() || infoBlock || 'Xin lỗi, tôi chưa thể tạo câu trả lời ở thời điểm này.';
  } catch (error) {
    console.error('info answer error', error);
    return infoBlock || 'Không thể tạo câu trả lời ngay lúc này. Vui lòng thử lại sau.';
  }
}

async function generateGeminiText(client, prompt) {
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  if (response?.text) {
    return response.text;
  }

  const candidate = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(candidate)) {
    return candidate.map(part => part?.text || '').join('').trim();
  }

  if (response?.outputs && response.outputs[0]?.content) {
    return response.outputs[0].content;
  }

  return response ? JSON.stringify(response) : '';
}

function parseJsonFromText(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {
        console.warn('parseJsonFromText fallback failed', err);
      }
    }
  }

  return null;
}
