/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side data directory and file paths
const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// Ensure data folder and empty sessions file exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2), "utf-8");
}

// Request parsers
app.use(express.json({ limit: "15mb" }));

// Initialize Google Gemini API securely
// Make sure to lazily check key or fall back gracefully
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI advice features will be unavailable.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

/* ==============================================
   API ENDPOINTS
   ============================================== */

/**
 * GET /api/pmp/sessions
 * Fetch all saved practice sessions
 */
app.get("/api/pmp/sessions", (req, res) => {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const content = fs.readFileSync(SESSIONS_FILE, "utf-8");
      return res.json(JSON.parse(content || "[]"));
    }
    return res.json([]);
  } catch (err: any) {
    console.error("Error reading sessions:", err);
    return res.status(500).json({ error: "Failed to load practice sessions: " + err.message });
  }
});

/**
 * POST /api/pmp/sessions
 * Overwrite/Save practice sessions
 */
app.post("/api/pmp/sessions", (req, res) => {
  try {
    const sessions = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of sessions." });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
    return res.json({ success: true, message: "Practice sessions saved successfully" });
  } catch (err: any) {
    console.error("Error saving sessions:", err);
    return res.status(500).json({ error: "Failed to save practice sessions: " + err.message });
  }
});

/**
 * POST /api/pmp/advice-3w1l
 * Requests personalized PMP advice based on the question and 3W-1L mistake analysis
 */
app.post("/api/pmp/advice-3w1l", async (req, res) => {
  try {
    const { question, options, correctOption, userOption, domain, explanation, threeWOneL, extension, stt } = req.body;

    if (!question || !threeWOneL) {
      return res.status(400).json({ error: "Missing required question or 3W-1L mistake log." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: "Cố vấn PMP AI tạm thời chưa hoạt động vì chưa cấu hình khóa API (GEMINI_API_KEY). Vui lòng thêm khóa trong panel Secrets.",
      });
    }

    const prompt = `
Bạn là Cố vấn luyện thi PMP cao cấp (PMP Master Coach / certified PMI trainer) với hơn 15 năm kinh nghiệm.
Học viên của bạn sắp tham gia kỳ thi PMP và đang xây dựng cuốn sổ tay lỗi sai (Error Log) theo mô hình "3W-1L" (What, Why, Action, Lesson).

Hãy phân tích kỹ lưỡng câu hỏi PMP và lỗi sai của họ dưới đây để đưa ra sự cố vấn sâu sắc, giúp họ thấu hiểu tư duy đúng của PMI (Agile Mindset, Servant Leadership, Stakeholder Engagement, Quy trình kiểm soát thay đổi Thay đổi...).

--- CÂU HỎI PMP ---
[STT/ID]: ${stt || "N/A"}
[Domain - Vùng kiến thức]: ${domain || "Chưa phân loại"}
[Câu hỏi]: ${question}
[Các lựa chọn phương án]:
- A: ${options?.A || "N/A"}
- B: ${options?.B || "N/A"}
- C: ${options?.C || "N/A"}
- D: ${options?.D || "N/A"}
[Đáp án đúng đề bài]: ${correctOption || "N/A"}
[Phương án học viên chọn]: ${userOption || "N/A"}
[Giải thích cơ bản của đề]: ${explanation || "Không có"}

--- NHẬT KÝ LỖI SAI (Error Log 3W-1L) CỦA HỌC VIÊN ---
- WHAT: (Cái gì sai): ${threeWOneL.what || "Không ghi"}
- WHY: (Tại sao chọn sai / tại sao nhầm): ${threeWOneL.why || "Không ghi"}
- ACTION: (Hành động sửa sai): ${threeWOneL.action || "Không ghi"}
- LESSON (1 bài học then chốt): ${threeWOneL.lesson || "Không ghi"}
[Thông tin bổ trợ/Mở rộng]: ${extension || "Không có"}

Hãy phản hồi dưới dạng JSON khắt khe khớp với cấu trúc sau:
{
  "advice": "Viết một lời khuyên sư phạm sâu sắc dài 2-4 đoạn bằng tiếng Việt. Phân tích rõ tại sao sự hiểu lầm của học viên (trong phần WHY/WHAT) xảy ra, tại sao đáp án của đề bài mới là tối ưu nhất theo tiêu chí PMI, và vạch ra bẫy tư duy ở đây. Sử dụng giọng văn nhiệt tình, khuyến khích học viên.",
  "pmpMindsetRules": ["Đưa ra 2 đến 3 nguyên tắc vàng tư duy PMP ngắn gọn liên quan (ví dụ: 'Luôn đánh giá ảnh hưởng trước khi gửi yêu cầu thay đổi', 'Gặp mâu thuẫn cần ưu tiên giải quyết trực tiếp trước khi báo cáo hoặc leo thang')."],
  "recommendedAction": "Hành động thực nghiệm cụ thể học viên nên làm ngay để hiểu sâu (ví dụ: đọc lại chương Stakeholder Engagement trong PMBOK, xem lại Scrum guide...).",
  "customMockQuestion": {
    "question": "Vui lòng tạo 1 câu hỏi giả lập PMP hoàn toàn mới bằng tiếng Việt, có tình huống tương đương để kiểm tra xem học viên đã thực sự khắc phục được lỗi tư duy này chưa.",
    "options": {
      "A": "Một đáp án nhiễu rất giống thật",
      "B": "Một đáp án nhiễu khác",
      "C": "Một đáp án đúng theo tinh thần PMP",
      "D": "Một đáp án phụ trợ"
    },
    "correctOption": "C",
    "explanation": "Giải thích cặn kẽ vì sao đáp án đó là đúng và tại sao các lỗi nhiễu lại sai theo khung lý thuyết PMI."
  }
}

LƯU Ý: Viết tiếng Việt tự nhiên, chuyên môn cao, đúng thuật ngữ PMP (PMI-ACP, PMBOK, Servant Leadership, v.v.). Không chèn bất cứ ký tự nào ngoài JSON thô trong phản hồi.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advice: {
              type: Type.STRING,
              description: "Coaching advice for 3W-1L review.",
            },
            pmpMindsetRules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key PMP gold rules to remember.",
            },
            recommendedAction: {
              type: Type.STRING,
              description: "Next study steps suggested.",
            },
            customMockQuestion: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.OBJECT,
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                    D: { type: Type.STRING },
                  },
                  required: ["A", "B", "C", "D"],
                },
                correctOption: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["question", "options", "correctOption", "explanation"],
            },
          },
          required: ["advice", "pmpMindsetRules", "recommendedAction"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini.");
    }

    try {
      const parsedData = JSON.parse(responseText.trim());
      return res.json(parsedData);
    } catch {
      console.error("Failed to parse Gemini model output as JSON. Output was:", responseText);
      return res.status(500).json({
        error: "Không thể phân tách kết quả trả về từ AI dưới dạng JSON. Hãy thử lại.",
        rawOutput: responseText,
      });
    }
  } catch (err: any) {
    console.error("Gemini Advisor Error:", err);
    return res.status(500).json({ error: "Lỗi kết nối với Cố vấn Gemini PMP: " + err.message });
  }
});

/* ==============================================
   VITE & STATIC FILE SERVING
   ============================================== */

async function start() {
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist/index.html"));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static production build folder served.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PMP App running flawlessly on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Error starting fullstack server:", err);
});
