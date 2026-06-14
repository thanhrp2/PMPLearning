/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PMPQuestion, ThreeWOneL } from "../types";
import { Plus, Check, Info, HelpCircle } from "lucide-react";

interface AddQuestionFormProps {
  onAddQuestion: (question: Omit<PMPQuestion, "id">) => void;
  nextStt: number;
  initialQuestionValues?: PMPQuestion | null;
  onCancelEdit?: () => void;
}

const DOMAINS = [
  "Process (Quy trình)",
  "People (Con người)",
  "Business Environment (Môi trường kinh doanh)",
  "Agile Mindset / Scrum",
  "Hybrid Methodologies (Lai ghép)",
  "Khác",
];

export default function AddQuestionForm({
  onAddQuestion,
  nextStt,
  initialQuestionValues,
  onCancelEdit,
}: AddQuestionFormProps) {
  const [stt, setStt] = useState<number>(nextStt);
  const [questionText, setQuestionText] = useState("");
  const [domain, setDomain] = useState("Process (Quy trình)");
  const [customDomain, setCustomDomain] = useState("");
  
  // Options
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");

  // Answers
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D' | ''>("");
  const [userOption, setUserOption] = useState<'A' | 'B' | 'C' | 'D' | ''>("");

  // Explanation and Extension
  const [explanation, setExplanation] = useState("");
  const [extension, setExtension] = useState("");

  // 3W - 1L Mistake Log Details
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [action, setAction] = useState("");
  const [lesson, setLesson] = useState("");

  // For warnings/helper messages
  const [errorMsg, setErrorMsg] = useState("");

  // Load values when editing
  useEffect(() => {
    if (initialQuestionValues) {
      setStt(initialQuestionValues.stt);
      setQuestionText(initialQuestionValues.question);
      
      const isPredefined = DOMAINS.includes(initialQuestionValues.domain);
      if (isPredefined) {
        setDomain(initialQuestionValues.domain);
        setCustomDomain("");
      } else {
        setDomain("Khác");
        setCustomDomain(initialQuestionValues.domain);
      }

      setOptionA(initialQuestionValues.options.A || "");
      setOptionB(initialQuestionValues.options.B || "");
      setOptionC(initialQuestionValues.options.C || "");
      setOptionD(initialQuestionValues.options.D || "");
      setCorrectOption(initialQuestionValues.correctOption);
      setUserOption(initialQuestionValues.userOption);
      setExplanation(initialQuestionValues.explanation || "");
      setExtension(initialQuestionValues.extension || "");
      setWhat(initialQuestionValues.threeWOneL?.what || "");
      setWhy(initialQuestionValues.threeWOneL?.why || "");
      setAction(initialQuestionValues.threeWOneL?.action || "");
      setLesson(initialQuestionValues.threeWOneL?.lesson || "");
    } else {
      resetFields();
    }
  }, [initialQuestionValues, nextStt]);

  const resetFields = () => {
    setStt(nextStt);
    setQuestionText("");
    setDomain("Process (Quy trình)");
    setCustomDomain("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectOption("");
    setUserOption("");
    setExplanation("");
    setExtension("");
    setWhat("");
    setWhy("");
    setAction("");
    setLesson("");
    setErrorMsg("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setErrorMsg("Vui lòng nhập nội dung câu hỏi PMP.");
      return;
    }

    const finalDomain = domain === "Khác" ? (customDomain.trim() || "Khác") : domain;
    
    const newQuestion: Omit<PMPQuestion, "id"> = {
      stt: Number(stt) || nextStt,
      question: questionText.trim(),
      options: {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim(),
      },
      correctOption: correctOption || "",
      userOption: userOption || "",
      domain: finalDomain,
      explanation: explanation.trim(),
      extension: extension.trim(),
      threeWOneL: {
        what: what.trim(),
        why: why.trim(),
        action: action.trim(),
        lesson: lesson.trim(),
      },
    };

    onAddQuestion(newQuestion);
    resetFields();
  };

  // Auto-fill some 3W-1L placeholder templates if user got it right or wrong
  const autoFillTemplate = (type: 'right' | 'wrong') => {
    if (type === 'right') {
      setWhat("Tôi làm đúng câu này chủ động.");
      setWhy("Đã phân tích chính xác vai trò Servant Leader hoặc Quy luật quy trình PMI.");
      setAction("Duy trì kiến thức này cho ngày thi, rà soát thêm tư duy Agile.");
      setLesson("Tiếp tục bình tĩnh chọn giải pháp tối ưu, giải quyết mâu thuẫn trực tiếp và luôn phân tích tác động.");
    } else {
      setWhat("Đã chọn phương án sai dẫn tới chệch tinh thần PMP.");
      setWhy("Bị bẫy của đề bài làm nhầm lẫn giữa việc chủ động giải quyết với việc chuyển giao quyền lực / báo cáo lên cấp trên.");
      setAction("Quy chiếu theo quy trình đổi thay/quá trình Agile, luôn tìm phương án hành động trước, không vội leo thang.");
      setLesson("Tư duy PMP: Phải chủ động phân tích rủi ro/vấn đề trước, sau đó trao đổi thảo luận trực tiếp cùng stakeholder.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold font-display text-gray-900">
            {initialQuestionValues ? "Cập Nhật Câu Hỏi" : "Thêm Câu Hỏi Mới"}
          </h3>
          <p className="text-xs text-gray-500">Nhập thông tin chi tiết câu hỏi và nhật ký lỗi sai</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-gray-600">STT:</label>
          <input
            type="number"
            value={stt}
            onChange={(e) => setStt(Number(e.target.value))}
            className="w-16 px-2 py-1 text-center font-mono border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            required
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-100 flex items-center space-x-2">
          <Info className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Basic fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Câu Hỏi PMP <span className="text-red-500">*</span>
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ví dụ: Một dự án đang tiến hành thì phát hiện một bên liên quan mới xuất hiện..."
            className="w-full min-h-[100px] p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-gray-400"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Vùng kiến thức (Domain)
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium"
            >
              {DOMAINS.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          </div>

          {domain === "Khác" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Nhập Vùng kiến thức khác
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Ví dụ: Risk Management"
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 space-y-3">
        <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          Các lựa chọn đáp án (Không bắt buộc, nhưng khuyên dùng)
        </span>
        <div className="grid grid-cols-1 gap-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 flex items-center justify-center font-bold bg-amber-100 text-amber-800 rounded-full text-xs">A</span>
            <input
              type="text"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="Nội dung phương án A..."
              className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 flex items-center justify-center font-bold bg-blue-100 text-blue-800 rounded-full text-xs">B</span>
            <input
              type="text"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="Nội dung phương án B..."
              className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 flex items-center justify-center font-bold bg-purple-100 text-purple-800 rounded-full text-xs">C</span>
            <input
              type="text"
              value={optionC}
              onChange={(e) => setOptionC(e.target.value)}
              placeholder="Nội dung phương án C..."
              className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 flex items-center justify-center font-bold bg-emerald-100 text-emerald-800 rounded-full text-xs">D</span>
            <input
              type="text"
              value={optionD}
              onChange={(e) => setOptionD(e.target.value)}
              placeholder="Nội dung phương án D..."
              className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        {/* Correct answer and choice selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              📌 Đáp án ĐÚNG của đề:
            </label>
            <select
              value={correctOption}
              onChange={(e) => setCorrectOption(e.target.value as any)}
              className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
            >
              <option value="">-- Chọn đáp án đúng --</option>
              <option value="A">Phương án A</option>
              <option value="B">Phương án B</option>
              <option value="C">Phương án C</option>
              <option value="D">Phương án D</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              👤 Lựa chọn của BẠN:
            </label>
            <select
              value={userOption}
              onChange={(e) => setUserOption(e.target.value as any)}
              className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
            >
              <option value="">-- Chọn đáp án đã thử --</option>
              <option value="A">Phương án A</option>
              <option value="B">Phương án B</option>
              <option value="C">Phương án C</option>
              <option value="D">Phương án D</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3W - 1L section with detailed guidance */}
      <div className="border border-amber-200 rounded-2xl bg-amber-50/20 p-5 space-y-4">
        <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-2 pb-2 border-b border-amber-100">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-[11px] font-bold tracking-widest bg-amber-600 text-white rounded-md">
              MÔ HÌNH LỖI SAI PMP 3W-1L
            </span>
            <HelpCircle className="w-4 h-4 text-amber-600" title="Khung tư duy ghi nhớ lỗi sai cốt lõi" />
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-amber-800">
            <span className="font-medium text-amber-700">Điền nhanh mẫu:</span>
            <button
              type="button"
              onClick={() => autoFillTemplate('wrong')}
              className="px-2 py-0.5 bg-red-100 hover:bg-red-200 border border-red-200 rounded text-[11px] font-bold text-red-800 transition-all cursor-pointer"
            >
              Làm sai ❌
            </button>
            <button
              type="button"
              onClick={() => autoFillTemplate('right')}
              className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 rounded text-[11px] font-bold text-emerald-800 transition-all cursor-pointer"
            >
              Làm đúng (Ghi chú)  
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-amber-800 flex items-center mb-1">
              ✏️ WHAT (Mô tả cái gì sai):
            </label>
            <textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Ví dụ: Chọn nhầm phương án báo cáo ngay lên Sponsor..."
              className="w-full h-18 p-2 text-sm bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-800 flex items-center mb-1">
              🔍 WHY (Tại sao chọn sai):
            </label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Ví dụ: Vì nghĩ rủi ro quá lớn, quên mất Servant leader phải tự tìm giải pháp trước..."
              className="w-full h-18 p-2 text-sm bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-800 flex items-center mb-1">
              🛡️ ACTION (Hành động chuẩn PMP):
            </label>
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ví dụ: Đọc kỹ điều lệ rủi ro, phân tích tác động, thảo luận trực tiếp nhóm nội bộ..."
              className="w-full h-18 p-2 text-sm bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-800 flex items-center mb-1">
              💡 1 LESSON (1 Bài học cốt lõi):
            </label>
            <textarea
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="Ví dụ: Chưa phân tích thì KHÔNG được hành động, không leo thang khẩn cấp."
              className="w-full h-18 p-2 text-sm bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Explanations & Extensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Giải Thích của đề (Explanation)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Giải thích chính gốc từ tài liệu ôn thi..."
            className="w-full h-24 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Ghi Chú Rộng / Extension
          </label>
          <textarea
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            placeholder="Mở rộng thuật ngữ, đường link tài liệu chính thống, PMBOK 7th Ed, Agile Guide page..."
            className="w-full h-24 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Submit / Cancel Buttons */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
        {onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-950 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            Hủy Bỏ
          </button>
        )}
        <button
          type="submit"
          className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          {initialQuestionValues ? (
            <>
              <Check className="w-4 h-4" />
              <span>Cập Nhật Câu Hỏi</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Thêm Câu Hỏi</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
