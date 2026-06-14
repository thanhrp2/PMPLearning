/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ThreeWOneL {
  what: string;   // What went wrong (Tôi chọn nhầm cái gì / Nội dung gây nhầm lẫn)
  why: string;    // Why did it go wrong (Tại sao tôi tư duy sai, bị bẫy ở điểm nào)
  action: string; // What should be the standard action (Hành động chuẩn PMP / Tư duy đúng)
  lesson: string; // 1 Lesson learned (1 Bài học cốt lõi ngắn gọn)
}

export interface PMPQuestion {
  id: string;
  stt: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption: 'A' | 'B' | 'C' | 'D' | '';
  userOption: 'A' | 'B' | 'C' | 'D' | '';
  domain: 'People' | 'Process' | 'Business Environment' | string;
  explanation: string;
  threeWOneL: ThreeWOneL;
  extension: string; // Kiến thức mở rộng / Ghi chú/ Gắn link tài liệu tham khảo
  isFlagged?: boolean; // Đánh dấu câu khó / cần xem lại
}

export interface PracticeSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  questions: PMPQuestion[];
  notes?: string;
}

export interface GeminiAdviceResponse {
  advice: string;
  pmpMindsetRules: string[];
  recommendedAction: string;
  customMockQuestion?: {
    question: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctOption: 'A' | 'B' | 'C' | 'D';
    explanation: string;
  };
}
