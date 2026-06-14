/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { PracticeSession, PMPQuestion, GeminiAdviceResponse } from "./types";
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Upload,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Edit2,
  Check,
  RotateCcw,
  Lightbulb,
  AlertTriangle,
  Info,
  Smartphone,
  BookMarked,
  FileSpreadsheet,
  Eye,
  EyeOff,
  QrCode,
  Copy
} from "lucide-react";

// Predefined domains for classification
const DOMAINS = [
  "Process",
  "People",
  "Business Environment",
  "Agile / Scrum Mindset",
  "Hybrid",
  "Other",
];

export default function App() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  // App Modes (To simplify interface on mobile)
  // 'list' = View all questions of selected Day
  // 'add' = Form to add a new question
  // 'view' = Deep-dive review of the selected question (including 3W-1L, Explanation, Ext)
  // 'flashcard' = Interactive 10-Question Flashcard practice test
  const [mobileMode, setMobileMode] = useState<'list' | 'add' | 'view' | 'flashcard'>('list');

  // UI States for adding a new day of questions
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionNotes, setNewSessionNotes] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split("T")[0]);

  // Form states for creating / editing a question
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qStt, setQStt] = useState<number>(1);
  const [qQuestion, setQQuestion] = useState("");
  const [qDomain, setQDomain] = useState("Process");
  const [qOptionA, setOptionA] = useState("");
  const [qOptionB, setOptionB] = useState("");
  const [qOptionC, setOptionC] = useState("");
  const [qOptionD, setOptionD] = useState("");
  const [qCorrect, setCorrect] = useState<'A' | 'B' | 'C' | 'D' | ''>("");
  const [qUserOption, setUserOption] = useState<'A' | 'B' | 'C' | 'D' | ''>("");
  const [qExplanation, setExplanation] = useState("");
  const [qExtension, setExtension] = useState("");
  const [qWhat, setWhat] = useState("");
  const [qWhy, setWhy] = useState("");
  const [qAction, setAction] = useState("");
  const [qLesson, setLesson] = useState("");

  const [formError, setFormError] = useState("");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All"); // All, Correct, Wrong, Flagged

  // Gemini Advice states
  const [aiAdviceCache, setAiAdviceCache] = useState<Record<string, GeminiAdviceResponse>>({});
  const [loadingAdviceQId, setLoadingAdviceQId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Challenge Answers state (for mock test provided by Gemini)
  const [challengeAnswerId, setChallengeAnswerId] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [showChallengeResult, setShowChallengeResult] = useState(false);

  // Helper to obtain the non-iframe, production preview URL suitable for mobile
  const getMobileUrl = () => {
    let current = window.location.href;
    // Replace development subdomain flag with production preview flag
    if (current.includes("-dev-")) {
      current = current.replace("-dev-", "-pre-");
    }
    // Remove hash or trailing query parameters for cleaner root path access
    try {
      const urlObj = new URL(current);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return current;
    }
  };

  // Copy link utility pointing to the pre URL
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(getMobileUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle for hiding stats/Excel tools to maximize viewport space
  const [showStatsAndTools, setShowStatsAndTools] = useState<boolean>(() => {
    try {
      return localStorage.getItem("pmp_show_stats_tools") !== "false";
    } catch {
      return true;
    }
  });

  // Custom confirmation state to replace window.confirm (which gets blocked in the iframe preview)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Flashcards state
  const [flashcardQuestions, setFlashcardQuestions] = useState<PMPQuestion[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState<number>(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState<boolean>(false);
  const [flashcardAnswers, setFlashcardAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D' | null>>({});
  const [isFlashcardQuizFinished, setIsFlashcardQuizFinished] = useState<boolean>(false);

  // Trigger interactive 10-Question Flashcard Practice Test
  const handleStartFlashcards = () => {
    // Collect questions
    let pool: PMPQuestion[] = [];
    if (activeSession && activeSession.questions.length > 0) {
      pool = [...activeSession.questions];
    } else {
      // Fallback: collect from all loadable sessions
      sessions.forEach(s => {
        pool.push(...s.questions);
      });
    }

    if (pool.length === 0) {
      alert("Today's package is empty or contains no data. Please add questions or upload from the Excel template first!");
      return;
    }

    // Shuffle pool and select max 10
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    setFlashcardQuestions(selected);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setFlashcardAnswers({});
    setIsFlashcardQuizFinished(false);
    setMobileMode('flashcard');
  };

  // Fetch PMP sessions from API on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    // 1. Try fetching from LocalStorage first for instant loading and fully offline usage
    const localDataRaw = localStorage.getItem("pmp_sessions_fallback");
    if (localDataRaw) {
      try {
        const localData = JSON.parse(localDataRaw);
        if (localData && localData.length > 0) {
          setSessions(localData);
          setSelectedSessionId(localData[0].id);
        }
      } catch (e) {
        console.error("Local data parse error", e);
      }
    }

    // 2. Update with latest database from the server if online
    try {
      const response = await fetch("/api/pmp/sessions");
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setSessions(data);
          setSelectedSessionId(prev => {
            const hasPrev = data.some((s: any) => s.id === prev);
            return hasPrev ? prev : data[0].id;
          });
          localStorage.setItem("pmp_sessions_fallback", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.warn("Running in offline mode or server unavailable. Using local storage data.", err);
    }
  };

  const saveSessions = async (updatedSessions: PracticeSession[]) => {
    // 1. Save locally instantly to local storage so work is never lost offline
    setSessions(updatedSessions);
    localStorage.setItem("pmp_sessions_fallback", JSON.stringify(updatedSessions));

    // 2. Sync to the server non-blocking
    try {
      await fetch("/api/pmp/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSessions),
      });
    } catch (err) {
      console.warn("Could not sync online. Data is stored safely on your phone.", err);
    }
  };

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  // Auto increment STT when setting up a new question
  const getNextStt = () => {
    if (!activeSession || activeSession.questions.length === 0) return 1;
    return Math.max(...activeSession.questions.map((q) => q.stt)) + 1;
  };

  // Switch to standard question form mode
  const openAddQuestionForm = () => {
    setEditingQuestionId(null);
    setQStt(getNextStt());
    setQQuestion("");
    setQDomain("Process");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrect("");
    setUserOption("");
    setExplanation("");
    setExtension("");
    setWhat("");
    setWhy("");
    setAction("");
    setLesson("");
    setFormError("");
    setMobileMode('add');
  };

  // Populate form to edit custom question
  const openEditQuestionForm = (q: PMPQuestion) => {
    setEditingQuestionId(q.id);
    setQStt(q.stt);
    setQQuestion(q.question);
    setQDomain(q.domain);
    setOptionA(q.options.A || "");
    setOptionB(q.options.B || "");
    setOptionC(q.options.C || "");
    setOptionD(q.options.D || "");
    setCorrect(q.correctOption);
    setUserOption(q.userOption);
    setExplanation(q.explanation || "");
    setExtension(q.extension || "");
    setWhat(q.threeWOneL?.what || "");
    setWhy(q.threeWOneL?.why || "");
    setAction(q.threeWOneL?.action || "");
    setLesson(q.threeWOneL?.lesson || "");
    setFormError("");
    setMobileMode('add');
  };

  // Add/Update the question
  const handleSaveQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qQuestion.trim()) {
      setFormError("Please fill in at least the question content.");
      return;
    }

    const questionPayload: PMPQuestion = {
      id: editingQuestionId || "q-" + Date.now(),
      stt: Number(qStt) || 1,
      question: qQuestion.trim(),
      options: {
        A: qOptionA.trim(),
        B: qOptionB.trim(),
        C: qOptionC.trim(),
        D: qOptionD.trim(),
      },
      correctOption: qCorrect || "",
      userOption: qUserOption || "",
      domain: qDomain,
      explanation: qExplanation.trim(),
      extension: qExtension.trim(),
      threeWOneL: {
        what: qWhat.trim(),
        why: qWhy.trim(),
        action: qAction.trim(),
        lesson: qLesson.trim(),
      },
    };

    let updatedSessions = [...sessions];
    const sessionIdx = updatedSessions.findIndex((s) => s.id === selectedSessionId);
    if (sessionIdx !== -1) {
      const existingQs = updatedSessions[sessionIdx].questions;
      if (editingQuestionId) {
        // Edit
        const qIdx = existingQs.findIndex((q) => q.id === editingQuestionId);
        if (qIdx !== -1) {
          existingQs[qIdx] = questionPayload;
        }
      } else {
        // Create new
        existingQs.push(questionPayload);
      }
      // Sort questions by STT
      existingQs.sort((a, b) => a.stt - b.stt);
      await saveSessions(updatedSessions);
    }

    setMobileMode('list');
  };

  // Delete a specific question
  const handleDeleteQuestion = async (qId: string) => {
    askConfirmation(
      "Xóa câu hỏi?",
      "Bạn có chắc chắn muốn xóa câu hỏi này khỏi đề luyện?",
      async () => {
        const updated = sessions.map((s) => {
          if (s.id === selectedSessionId) {
            return {
              ...s,
              questions: s.questions.filter((q) => q.id !== qId),
            };
          }
          return s;
        });
        if (selectedQuestionId === qId) setSelectedQuestionId(null);
        await saveSessions(updated);
      }
    );
  };

  // Bookmark / Flag a question
  const handleToggleFlag = async (qId: string) => {
    const updated = sessions.map((s) => {
      if (s.id === selectedSessionId) {
        return {
          ...s,
          questions: s.questions.map((q) => {
            if (q.id === qId) {
              return { ...q, isFlagged: !q.isFlagged };
            }
            return q;
          }),
        };
      }
      return s;
    });
    await saveSessions(updated);
  };

  // Add new study session/day
  const handleAddSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    const newSess: PracticeSession = {
      id: "session-" + Date.now(),
      title: newSessionTitle.trim(),
      date: newSessionDate,
      notes: newSessionNotes.trim(),
      questions: [],
    };

    const updated = [...sessions, newSess];
    await saveSessions(updated);
    setSelectedSessionId(newSess.id);
    setIsAddingSession(false);
    setNewSessionTitle("");
    setNewSessionNotes("");
    setSelectedQuestionId(null);
    setMobileMode('list');
  };

  // Delete a study session/day
  const handleDeleteSession = async (sessId: string) => {
    askConfirmation(
      "Xóa đề ôn luyện?",
      "Bạn có chắc chắn muốn xóa đề ôn luyện này cùng tất cả câu hỏi liên quan?",
      async () => {
        const updated = sessions.filter((s) => s.id !== sessId);
        if (updated.length === 0) {
          const defaultSess: PracticeSession = {
            id: "session-" + Date.now(),
            title: "Đề 1a",
            date: new Date().toISOString().split("T")[0],
            notes: "Đề ôn luyện mặc định mới tạo",
            questions: []
          };
          const finalSessions = [defaultSess];
          await saveSessions(finalSessions);
          setSelectedSessionId(defaultSess.id);
          setSelectedQuestionId(null);
        } else {
          await saveSessions(updated);
          setSelectedSessionId(updated[0].id);
          setSelectedQuestionId(null);
        }
      }
    );
  };

  // Quick autofills for mistakes
  const applyFormTemplate = (style: 'correct_pmp' | 'mistake_pmp') => {
    if (style === 'correct_pmp') {
      setWhat("I analyzed and chose the correct root-cause resolution option myself.");
      setWhy("Deeply mastered the Scrum Guide & Servant Leadership mindset: Discussion, guiding the team to reach goals sustainably.");
      setAction("Continue to understand Agile context (always prioritize win-win collaboration & self-organization).");
      setLesson("Servant Leader Thinking: Coach knowledge & buffer team from disturbing interferences.");
    } else {
      setWhat("I mistakenly chose a dictatorial/directive action or rushed to escalate to Sponsor immediately.");
      setWhy("Due to traditional management habit wanting quick fixes, forgetting that PMI guides dialogue and impact analysis first.");
      setAction("Re-verify the Change Control process: Impact evaluation -> Find alternatives -> Present for approval.");
      setLesson("PMP Spirit: Never escalate or report to Sponsor/higher-ups before the Project Manager has thoroughly analyzed the problem impact.");
    }
  };

  // Data import/export functions
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", dataStr);
    downloadLink.setAttribute("download", `PMP-History-3W1L.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const reader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          await saveSessions(parsed);
          if (parsed.length > 0) setSelectedSessionId(parsed[0].id);
          alert("PMP database imported successfully!");
        } else {
          alert("Invalid file format. The file must contain an array of PMP sessions.");
        }
      } catch (err) {
        alert("Error reading JSON file. Please check its validity.");
      }
    };
    reader.readAsText(file);
  };

  // Advanced Excel / CSV Download Template
  const handleDownloadExcelTemplate = () => {
    try {
      const headers = [
        "No.",
        "Question",
        "Domain",
        "Correct Answer",
        "What",
        "Where",
        "Why",
        "Lesson Learn",
        "Explaination"
      ];
      const sampleData = [
        [
          1,
          "During a project progress meeting, a stakeholder informs the team that a previously identified technical issue has been resolved. However, the stakeholder warns that the same issue is likely to happen on other, similar projects. What should the project manager do first?\nSelect one:\n\na. Update the lessons learned register.\n\nb. Communicate the warning to the project sponsor.\n\nc. Update the issue log.\n\nd. Prepare a risk report.",
          "PM Do First",
          "D",
          "Issue đã xảy ra và giải quyết. Stakeholder lo sẽ xảy ra ở dự án tương tự",
          "", // Where (Action) is blank as in the mockup screenshot
          "", // Why is blank as in the mockup screenshot
          "", // Lesson Learn is blank as in the mockup screenshot
          "The lessons learned register can be used for future projects to help avoid past project issues.\nThe correct answer is: Update the lessons learned register."
        ]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "PMP Template");
      
      XLSX.writeFile(workbook, "PMP_Loi_Sai_Template.xlsx");
    } catch (err) {
      alert("Failed to generate Excel template. Please try again.");
    }
  };

  // Helper to extract options A, B, C, D from standard question stem if separate columns are absent
  const extractOptionsFromQuestion = (qText: string) => {
    const options = { A: "", B: "", C: "", D: "" };
    const cleanText = qText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    let cleanQuestion = cleanText;
    
    const findMarkerIndex = (char: string) => {
      const rx = new RegExp(`(?:^|\\s|\\n|[\\(\\)\\[\\]\\*])(${char})[\\.\\)\\:\\-]\\s+`, 'i');
      const match = cleanText.match(rx);
      if (match && match.index !== undefined) {
        return match.index + match[0].indexOf(match[1]);
      }
      return -1;
    };

    const idxA = findMarkerIndex('a');
    const idxB = findMarkerIndex('b');
    const idxC = findMarkerIndex('c');
    const idxD = findMarkerIndex('d');

    if (idxA !== -1 && idxB !== -1 && idxC !== -1 && idxD !== -1 && idxA < idxB && idxB < idxC && idxC < idxD) {
      options.A = cleanText.substring(idxA + 2, idxB).replace(/^[\.\)\:\-\s\*]+/, '').trim();
      options.B = cleanText.substring(idxB + 2, idxC).replace(/^[\.\)\:\-\s\*]+/, '').trim();
      options.C = cleanText.substring(idxC + 2, idxD).replace(/^[\.\)\:\-\s\*]+/, '').trim();
      options.D = cleanText.substring(idxD + 2).trim().replace(/^[\.\)\:\-\s\*]+/, '').trim();
      
      cleanQuestion = cleanText.substring(0, idxA).trim();
    } else {
      // Find the first option marker index if any to clean the stem
      const matches = Array.from(cleanText.matchAll(/(?:^|\n|\s|[(*])([a-dA-D])[\.\)\:\-]\s+/gi));
      if (matches.length > 0) {
        let firstOptIdx = cleanText.length;
        matches.forEach(m => {
          if (m.index !== undefined && m.index < firstOptIdx) {
            firstOptIdx = m.index;
          }
        });
        if (firstOptIdx < cleanText.length) {
          cleanQuestion = cleanText.substring(0, firstOptIdx).trim();
        }
      }

      const optMatches = Array.from(cleanText.matchAll(/(?:^|\n|\s|[(*])([a-dA-D])[\.\)\:\-]\s+([^\n\r]+)/gi));
      optMatches.forEach(m => {
        const key = m[1].toUpperCase();
        const val = m[2].trim();
        if (key === 'A' || key === 'B' || key === 'C' || key === 'D') {
          options[key as 'A'|'B'|'C'|'D'] = val;
        }
      });
    }

    // Strip common "Select one:", "Hãy chọn:", "Chọn một phương án:" suffixes to keep the question sleek
    cleanQuestion = cleanQuestion
      .replace(/\s*(?:select\s+one|chọn\s+một|choose\s+one|hãy\s+chọn|chon\s+mot)[\s\:\*\-!]*$/i, "")
      .trim();

    return {
      options: {
        A: options.A || "Option A",
        B: options.B || "Option B",
        C: options.C || "Option C",
        D: options.D || "Option D"
      },
      cleanQuestion: cleanQuestion || cleanText
    };
  };

  // Robust Excel / CSV Parse and Save
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rawData = evt.target?.result;
        if (!rawData) return;

        const workbook = XLSX.read(rawData, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet rows to raw Array of Arrays
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length < 2) {
          alert("The Excel/CSV file does not contain enough valid data rows.");
          return;
        }

        // Clean columns headers
        const headers: string[] = jsonData[0].map((h: any) => String(h || "").trim().toLowerCase());
        
        const getIndex = (aliases: string[]) => {
          return headers.findIndex(h => aliases.some(alias => {
            if (alias === "a" || alias === "b" || alias === "c" || alias === "d") {
              return h === alias || h === alias + "." || h === alias + ":" || h === alias + ")" || h === "(" + alias + ")" || h.startsWith(alias + " ");
            }
            return h.includes(alias);
          }));
        };

        const idxStt = getIndex(["stt", "thự tự", "id", "index", "no."]);
        const idxQuestion = getIndex(["câu hỏi", "cau hoi", "question", "đề bài", "de bai", "stem"]);
        const idxDomain = getIndex(["domain", "vùng kiến thức", "vung kien thuc", "nhóm", "phân loại"]);
        const idxA = getIndex(["a", "phương án a", "p/á a", "option a", "choice a", "phuong an a"]);
        const idxB = getIndex(["b", "phương án b", "p/á b", "option b", "choice b", "phuong an b"]);
        const idxC = getIndex(["c", "phương án c", "p/á c", "option c", "choice c", "phuong an c"]);
        const idxD = getIndex(["d", "phương án d", "p/á d", "option d", "choice d", "phuong an d"]);
        const idxCorrect = getIndex(["đáp án đúng", "dap an dung", "correct", "key", "đáp án chính xác", "đúng", "correct option", "correct answer"]);
        const idxUser = getIndex(["lựa chọn của bạn", "lua chon cua ban", "phương án chọn", "user option", "đáp án của bạn", "chọn", "ban chon", "bạn chọn"]);
        const idxWhat = getIndex(["what", "lỗi sai gì", "loi sai gi", "sai sót", "sai gi"]);
        const idxWhy = getIndex(["why", "tại sao nhầm", "tai sao nham", "lý do sai", "nguyên nhân", "nguyen nhan"]);
        const idxAction = getIndex(["where", "action", "hành động sửa", "hanh dong sua", "khắc phục", "hanh dong", "sửa ở đâu", "sua o dau"]);
        const idxLesson = getIndex(["lesson", "bài học", "bai hoc", "rút ra", "dung mang", "lesson learn"]);
        const idxNote = getIndex(["giải thích", "giai thich", "mở rộng", "mo rong", "comment", "ghi chú", "note", "explanation", "explaination", "chi tiet"]);

        if (idxQuestion === -1) {
          alert("Could not match the column containing questions (Please structure any headers with 'Question' or 'Câu hỏi').");
          return;
        }

        // Prevent column collision: Ensure custom option indices do not point to other metadata columns
        const metadataIndices = [idxStt, idxQuestion, idxDomain, idxCorrect, idxUser, idxWhat, idxWhy, idxAction, idxLesson, idxNote].filter(idx => idx !== -1);
        let cleanIdxA = idxA;
        let cleanIdxB = idxB;
        let cleanIdxC = idxC;
        let cleanIdxD = idxD;

        if (metadataIndices.includes(cleanIdxA)) cleanIdxA = -1;
        if (metadataIndices.includes(cleanIdxB)) cleanIdxB = -1;
        if (metadataIndices.includes(cleanIdxC)) cleanIdxC = -1;
        if (metadataIndices.includes(cleanIdxD)) cleanIdxD = -1;

        const newQuestions: PMPQuestion[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          const rawQuestion = row[idxQuestion];
          if (!rawQuestion || String(rawQuestion).trim() === "") continue;

          const getValue = (idx: number, def = "") => {
            if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
              return String(row[idx]).trim();
            }
            return def;
          };
          
          const sttValue = idxStt !== -1 && row[idxStt] !== undefined ? Number(row[idxStt]) : i;
          const qText = String(rawQuestion).trim();
          const domainText = getValue(idxDomain, "Process");
          
          // Try extracting options from question text first
          const extracted = extractOptionsFromQuestion(qText);
          const hasExtractedOptions = (
            extracted.options.A !== "Option A" &&
            extracted.options.B !== "Option B" &&
            extracted.options.C !== "Option C" &&
            extracted.options.D !== "Option D"
          );

          let optionA = "";
          let optionB = "";
          let optionC = "";
          let optionD = "";

          if (hasExtractedOptions) {
            optionA = extracted.options.A;
            optionB = extracted.options.B;
            optionC = extracted.options.C;
            optionD = extracted.options.D;
          } else {
            optionA = getValue(cleanIdxA, "");
            optionB = getValue(cleanIdxB, "");
            optionC = getValue(cleanIdxC, "");
            optionD = getValue(cleanIdxD, "");

            if (!optionA && !optionB && !optionC && !optionD) {
              optionA = "Option A";
              optionB = "Option B";
              optionC = "Option C";
              optionD = "Option D";
            }
          }
          
          let correctOpt = getValue(idxCorrect, "").toUpperCase();
          if (correctOpt.includes("A")) correctOpt = "A";
          else if (correctOpt.includes("B")) correctOpt = "B";
          else if (correctOpt.includes("C")) correctOpt = "C";
          else if (correctOpt.includes("D")) correctOpt = "D";
          else correctOpt = "";

          let userOpt = getValue(idxUser, "").toUpperCase();
          if (userOpt.includes("A")) userOpt = "A";
          else if (userOpt.includes("B")) userOpt = "B";
          else if (userOpt.includes("C")) userOpt = "C";
          else if (userOpt.includes("D")) userOpt = "D";
          else userOpt = "";

          const whatVal = getValue(idxWhat, "");
          const whyVal = getValue(idxWhy, "");
          const actionVal = getValue(idxAction, "");
          const lessonVal = getValue(idxLesson, "");
          const noteVal = getValue(idxNote, "");

          newQuestions.push({
            id: "q-excel-" + Date.now() + "-" + i,
            stt: sttValue || i,
            question: hasExtractedOptions ? extracted.cleanQuestion : qText,
            options: {
              A: optionA,
              B: optionB,
              C: optionC,
              D: optionD,
            },
            correctOption: correctOpt as any,
            userOption: userOpt as any,
            domain: domainText,
            explanation: noteVal,
            extension: "",
            threeWOneL: {
              what: whatVal,
              why: whyVal,
              action: actionVal,
              lesson: lessonVal,
            }
          });
        }

        if (newQuestions.length === 0) {
          alert("Could not extract any valid PMP questions from the uploaded file.");
          return;
        }

        const rawFileName = file.name.replace(/\.[^/.]+$/, "").trim();
        let fileNameWithoutExt = rawFileName.replace(/\s+/g, ' ');
        
        // Auto prepends "Đề " if it doesn't already start with "đề "
        let finalSessionTitle = fileNameWithoutExt;
        if (!/^đề\s+/i.test(finalSessionTitle)) {
          finalSessionTitle = "Đề " + finalSessionTitle;
        }

        let updatedSessions = [...sessions];

        // Check if a session with the exact same title exists
        const existingSessionWithSameTitle = sessions.find(
          (s) => s.title.toLowerCase().trim() === finalSessionTitle.toLowerCase().trim()
        );

        if (existingSessionWithSameTitle) {
          // Overwrite instantly as requested "nếu up cùng tên sẽ lưu đè luôn"
          const sIdx = updatedSessions.findIndex(s => s.id === existingSessionWithSameTitle.id);
          if (sIdx !== -1) {
            updatedSessions[sIdx] = {
              ...updatedSessions[sIdx],
              notes: `Đã cập nhật tự động từ file ${file.name} lúc ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN")}`,
              questions: newQuestions.sort((a,b) => a.stt - b.stt)
            };
            setSelectedSessionId(existingSessionWithSameTitle.id);
          }
          await saveSessions(updatedSessions);
          setSelectedQuestionId(null);
          alert(`Đã lưu đè: Cập nhật thành công "${existingSessionWithSameTitle.title}" với đúng ${newQuestions.length} câu hỏi mới.`);
          return;
        }

        // Create a brand new session with formatting "Đề ${name}"
        const freshSess: PracticeSession = {
          id: "session-excel-" + Date.now(),
          title: finalSessionTitle,
          date: new Date().toISOString().split("T")[0],
          notes: `Tải lên từ file ${file.name}`,
          questions: newQuestions.sort((a,b) => a.stt - b.stt)
        };
        updatedSessions.push(freshSess);
        setSelectedSessionId(freshSess.id);

        await saveSessions(updatedSessions);
        setSelectedQuestionId(null);
        alert(`Thành công! Đã thêm đề mới "${finalSessionTitle}" với ${newQuestions.length} câu hỏi mới.`);
      } catch (err) {
        console.error(err);
        alert("Excel structural error. Please make sure to import a standard .xlsx/.csv with correct column headers.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // Filtering list
  const activeQuestions = activeSession?.questions || [];
  const filteredQuestions = activeQuestions.filter((q) => {
    const matchesSearch =
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.threeWOneL.what.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.threeWOneL.lesson.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDomain = domainFilter === "All" || q.domain.includes(domainFilter);

    let matchesStatus = true;
    if (statusFilter === "Correct") {
      matchesStatus = q.userOption === q.correctOption && q.correctOption !== "";
    } else if (statusFilter === "Wrong") {
      matchesStatus = q.userOption !== q.correctOption && q.userOption !== "";
    } else if (statusFilter === "Flagged") {
      matchesStatus = !!q.isFlagged;
    }

    return matchesSearch && matchesDomain && matchesStatus;
  });

  // Calculate statistics for the active day's practice
  const totalCount = activeQuestions.length;
  const answeredCount = activeQuestions.filter((q) => q.userOption !== "").length;
  const correctCount = activeQuestions.filter((q) => q.userOption === q.correctOption && q.correctOption !== "").length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const loggedThreeWCount = activeQuestions.filter(
    (q) => q.threeWOneL.what.trim() !== "" || q.threeWOneL.lesson.trim() !== ""
  ).length;

  // Selected question target for reading panel
  const selectedQuestion = activeQuestions.find((q) => q.id === selectedQuestionId);
  const selectedQuestionAdvice = selectedQuestion ? aiAdviceCache[selectedQuestion.id] : null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col shadow-2xl relative border-x border-slate-200">
      
      {/* Dynamic Mini Mobile Title Bar */}
      <header className="bg-slate-900 text-white px-4 py-3 sticky.top-0 z-30 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-slate-900 text-base shadow">
              P
            </span>
            <div>
              <h1 className="text-sm font-black tracking-tight font-display">PMP 3W-1L Exam Prep</h1>
              <p className="text-[10px] text-slate-400 flex items-center">
                <Smartphone className="w-2.5 h-2.5 mr-0.5 text-emerald-400" /> Mobile-Optimized
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowQrModal(true)}
              title="Quét QR trên điện thoại"
              className="p-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all flex items-center space-x-1 text-[10px] font-black cursor-pointer border border-emerald-500/30"
            >
              <QrCode className="w-3.5 h-3.5 animate-pulse" />
              <span>Dùng Điện Thoại</span>
            </button>

            {/* Download/Backup icons */}
            <button
              onClick={handleDownloadBackup}
              title="Xuống dữ liệu"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <label className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      {/* Main Screen Layout Container */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 pb-24">
        
        {/* DAY PREPARATION SELECTOR */}
        {mobileMode === 'list' && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" /> Current Prep Session
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !showStatsAndTools;
                    setShowStatsAndTools(nextVal);
                    localStorage.setItem("pmp_show_stats_tools", String(nextVal));
                  }}
                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-250 rounded text-[9px] font-black flex items-center space-x-1 cursor-pointer transition-colors"
                  title={showStatsAndTools ? "Collapse stats & Excel panels for a cleaner view" : "Show statistics & Excel import/export panels"}
                >
                  {showStatsAndTools ? (
                    <>
                      <EyeOff className="w-2.5 h-2.5 text-red-500" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-2.5 h-2.5 text-emerald-500" />
                      <span>Show Tools</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSession(!isAddingSession)}
                  className="px-2 py-1 bg-indigo-55 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded text-[9px] font-black flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <span>{isAddingSession ? "Close" : "➕ Add Session"}</span>
                </button>
              </div>
            </div>

            {/* Quick Create Day Form */}
            {isAddingSession && (
              <form onSubmit={handleAddSessionSubmit} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Session Title (e.g. Day 1 Practice)</label>
                  <input
                    type="text"
                    required
                    placeholder="Day 1... (input about 10 questions)"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    className="w-full mt-1 p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Date</label>
                    <input
                      type="date"
                      value={newSessionDate}
                      onChange={(e) => setNewSessionDate(e.target.value)}
                      className="w-full mt-1 p-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Source Notes</label>
                    <input
                      type="text"
                      placeholder="Rita, PMBOK 7th, etc."
                      value={newSessionNotes}
                      onChange={(e) => setNewSessionNotes(e.target.value)}
                      className="w-full mt-1 p-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold shadow hover:bg-indigo-700"
                  >
                    Create Session
                  </button>
                </div>
              </form>
            )}

            {/* List quản lý theo ngày */}
            {sessions.length > 0 && !isAddingSession && (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const isActive = s.id === selectedSessionId;
                  const qCount = s.questions.length;
                  const wrongCount = s.questions.filter(q => q.userOption !== q.correctOption && q.userOption !== "").length;
                  const correctCount = s.questions.filter(q => q.userOption === q.correctOption && q.correctOption !== "").length;
                  const accuracyVal = qCount > 0 ? Math.round((correctCount / qCount) * 100) : 0;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        setSelectedQuestionId(null);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-50/80 border-indigo-200 shadow-sm"
                          : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-white/70 px-1 py-0.5 rounded border border-slate-200/45">
                              {s.date}
                            </span>
                            {isActive && (
                              <span className="text-[8px] bg-emerald-500 text-white font-black px-1 rounded shadow-xs">
                                ĐANG CHỌN
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-black text-slate-800 truncate mt-0.5 leading-snug">
                            {s.title}
                          </p>
                          <div className="flex items-center space-x-2 text-[9px] text-slate-400 font-bold mt-0.5">
                            <span>{qCount} câu hỏi</span>
                            {qCount > 0 ? (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-600">Đúng: {accuracyVal}%</span>
                                {wrongCount > 0 && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-rose-500">{wrongCount} Sai</span>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400">Trống</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.id)}
                          className="p-1 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                          title="Xóa đề này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Micro Dashboard stats for current Day */}
            {activeSession && showStatsAndTools && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100/80 text-center">
                <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Total Questions</span>
                  <span className="text-sm font-black text-slate-800">{totalCount}</span>
                </div>
                <div className="bg-emerald-50 rounded-lg p-1.5 border border-emerald-100">
                  <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Accuracy</span>
                  <span className="text-sm font-black text-emerald-700">{accuracy}%</span>
                </div>
                <div className="bg-indigo-50 rounded-lg p-1.5 border border-indigo-100">
                  <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">3W-1L Logs</span>
                  <span className="text-sm font-black text-indigo-700">{loggedThreeWCount}/{totalCount}</span>
                </div>
              </div>
            )}

            {/* Advanced Excel Data Options & OneDrive Cloud Archiving */}
            {showStatsAndTools && (
              <div className="pt-2.5 border-t border-slate-100/80 flex flex-col space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                  <span className="flex items-center text-slate-400">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    Study from Excel / CSV file:
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 rounded flex items-center space-x-0.5 text-[9px] cursor-pointer transition-colors"
                    title="Download standard Excel template"
                  >
                    <Download className="w-2.5 h-2.5" />
                    <span>Download Template</span>
                  </button>
                </div>
                
                <div className="w-full">
                  <label className="py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg flex items-center justify-center space-x-1 text-[10px] font-black cursor-pointer border border-slate-800 transition-colors w-full">
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                    <span>IMPORT FROM EXCEL</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 1. MAIN LIST MODE (Simple, clear cards with responsive filters) */}
        {mobileMode === 'list' && (
          <div className="space-y-4">

            {/* Flashcard Practice Launch Banner */}
            {sessions.some(s => s.questions.length > 0) && (
              <button
                type="button"
                onClick={handleStartFlashcards}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white rounded-xl shadow-md font-black text-xs flex items-center justify-between transition-all cursor-pointer hover:brightness-110 active:scale-[0.98] border border-amber-400/25"
              >
                <div className="flex items-center space-x-2">
                  <span className="p-1 bg-white/20 rounded-lg text-sm leading-none">🎯</span>
                  <div className="text-left">
                    <p className="font-bold text-[9px] text-amber-100 uppercase tracking-widest leading-none">Randomized Question Deck</p>
                    <p className="text-xs font-black mt-0.5">10-QUESTION FLASHCARD PRACTICE TEST</p>
                  </div>
                </div>
                <div className="flex items-center space-x-0.5 bg-black/20 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold tracking-wider">
                  <span>Start Quiz</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            )}
            
            {/* Filter buttons & Search */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search keywords, mistakes, lessons learned..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs p-2.5 pl-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none"
                />
              </div>

              {/* Status scroll selectors */}
              <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setStatusFilter("All")}
                  className={`px-3 py-1 rounded-full whitespace-nowrap border transition-all font-semibold ${
                    statusFilter === "All"
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setStatusFilter("Wrong")}
                  className={`px-3 py-1 rounded-full whitespace-nowrap border transition-all font-semibold ${
                    statusFilter === "Wrong"
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-white border-slate-200 text-red-600"
                  }`}
                >
                  Wrong ❌
                </button>
                <button
                  onClick={() => setStatusFilter("Correct")}
                  className={`px-3 py-1 rounded-full whitespace-nowrap border transition-all font-semibold ${
                    statusFilter === "Correct"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-emerald-600"
                  }`}
                >
                  Correct 🎯
                </button>
                <button
                  onClick={() => setStatusFilter("Flagged")}
                  className={`px-3 py-1 rounded-full whitespace-nowrap border transition-all font-semibold ${
                    statusFilter === "Flagged"
                      ? "bg-amber-500 border-amber-500 text-slate-950"
                      : "bg-white border-slate-200 text-amber-600"
                  }`}
                >
                  Flagged ⭐
                </button>
              </div>
            </div>

            {/* Questions List cards */}
            <div className="space-y-3">
              {filteredQuestions.map((q) => {
                const isSelected = q.id === selectedQuestionId;
                const isCorrect = q.userOption === q.correctOption && q.correctOption !== "";
                const isWrong = q.userOption !== q.correctOption && q.userOption !== "";

                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setSelectedQuestionId(q.id);
                      setMobileMode('view');
                    }}
                    className={`bg-white rounded-xl border p-3.5 shadow-sm transition-all relative flex flex-col justify-between cursor-pointer ${
                      isCorrect 
                        ? "border-l-4 border-l-emerald-500 border-slate-100" 
                        : isWrong 
                        ? "border-l-4 border-l-red-400 border-slate-100" 
                        : "border-slate-200"
                    } hover:border-indigo-400`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                        <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          STT #{q.stt}
                        </span>
                        
                        <div className="flex items-center space-x-1.5">
                          <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded max-w-[120px] truncate" title={q.domain}>
                            {q.domain}
                          </span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFlag(q.id);
                            }}
                            className="text-slate-300 hover:text-amber-500 focus:outline-none"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${q.isFlagged ? "text-amber-500 fill-amber-500" : ""}`} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-normal line-clamp-3">
                        {q.question}
                      </h3>

                      {/* Brief info on options */}
                      {q.userOption && (
                        <div className="flex items-center text-[11px] font-semibold space-x-2 pt-1">
                          <span className="text-slate-400 font-normal">Your selection:</span>
                          <span className={`px-1.5 py-0.2 rounded font-mono font-black ${
                            isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                          }`}>
                            {q.userOption}
                          </span>
                          <span className="text-slate-400 font-normal">Correct Key:</span>
                          <span className="font-mono bg-slate-100 px-1.5 rounded text-slate-700">{q.correctOption}</span>
                        </div>
                      )}

                      {/* Lesson learned summary preview */}
                      {q.threeWOneL.lesson && (
                        <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded flex items-start space-x-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <p className="italic line-clamp-1">{q.threeWOneL.lesson}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick review footer indicator */}
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50/70 text-[11px] text-indigo-600 font-bold">
                      <span className="flex items-center">
                        Detailed 3W-1L Analysis
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                      
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditQuestionForm(q)}
                          className="p-1 text-slate-400 hover:text-indigo-600"
                          title="Sửa câu"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                          title="Xóa câu"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredQuestions.length === 0 && (
                <div className="bg-white rounded-xl py-12 px-4 text-center border border-slate-150 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">No questions found in this session.</p>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Log your practice answers here! Click <strong>"Add Today's Question"</strong> below to create your error-analysis journal.
                  </p>
                </div>
              )}
            </div>

            {/* Float Action Area to easily add questions */}
            <button
              onClick={openAddQuestionForm}
              className="w-full py-3 bg-indigo-600 hover:bg-slate-900 border-indigo-600 hover:border-slate-900 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1 transition-all cursor-pointer"
              id="fab-add-question"
            >
              <Plus className="w-4 h-4" />
              <span>Add Today's Question</span>
            </button>
          </div>
        )}

        {/* 2. CHỌN 1 CÂU ĐỂ XEM CHI TIẾT & GỌI GEMINI ADVISOR */}
        {mobileMode === 'view' && selectedQuestion && (
          <div className="space-y-4 animate-fade-in text-xs">
            
            {/* Header: Go Back */}
            <button
              onClick={() => {
                setMobileMode('list');
                setSelectedQuestionId(null);
              }}
              className="flex items-center space-x-1 text-indigo-600 font-bold py-1.5 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Question List</span>
            </button>

            {/* Target Question Details */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span className="font-mono">STT: #{selectedQuestion.stt}</span>
                <span>{selectedQuestion.domain}</span>
              </div>
              <p className="text-slate-800 font-bold leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-150">
                {selectedQuestion.question}
              </p>

              {/* Selection list if available */}
              {(selectedQuestion.options.A || selectedQuestion.options.B || selectedQuestion.options.C || selectedQuestion.options.D) && (
                <div className="space-y-2 pt-1 text-slate-700">
                  {selectedQuestion.options.A && (
                    <div className={`p-2 rounded border text-[11px] ${
                      selectedQuestion.correctOption === "A" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                        : selectedQuestion.userOption === "A" 
                        ? "bg-red-50 border-red-200 text-red-700" 
                        : "bg-white border-slate-150"
                    }`}>
                      <strong>A.</strong> {selectedQuestion.options.A}
                    </div>
                  )}
                  {selectedQuestion.options.B && (
                    <div className={`p-2 rounded border text-[11px] ${
                      selectedQuestion.correctOption === "B" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                        : selectedQuestion.userOption === "B" 
                        ? "bg-red-50 border-red-200 text-red-700" 
                        : "bg-white border-slate-150"
                    }`}>
                      <strong>B.</strong> {selectedQuestion.options.B}
                    </div>
                  )}
                  {selectedQuestion.options.C && (
                    <div className={`p-2 rounded border text-[11px] ${
                      selectedQuestion.correctOption === "C" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                        : selectedQuestion.userOption === "C" 
                        ? "bg-red-50 border-red-200 text-red-700" 
                        : "bg-white border-slate-150"
                    }`}>
                      <strong>C.</strong> {selectedQuestion.options.C}
                    </div>
                  )}
                  {selectedQuestion.options.D && (
                    <div className={`p-2 rounded border text-[11px] ${
                      selectedQuestion.correctOption === "D" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                        : selectedQuestion.userOption === "D" 
                        ? "bg-red-50 border-red-200 text-red-700" 
                        : "bg-white border-slate-150"
                    }`}>
                      <strong>D.</strong> {selectedQuestion.options.D}
                    </div>
                  )}
                </div>
              )}

              {/* Correct answer display */}
              <div className="flex space-x-2 pt-1">
                {selectedQuestion.userOption && (
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    selectedQuestion.userOption === selectedQuestion.correctOption 
                      ? "bg-emerald-100 text-emerald-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    Your Selection: {selectedQuestion.userOption}
                  </span>
                )}
                {selectedQuestion.correctOption && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold">
                    Correct Option: {selectedQuestion.correctOption}
                  </span>
                )}
              </div>

              {selectedQuestion.explanation && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400">Explanation:</span>
                  <p className="text-slate-600 text-xs italic leading-relaxed mt-0.5">{selectedQuestion.explanation}</p>
                </div>
              )}
              {selectedQuestion.extension && (
                <div className="pt-2">
                  <span className="block text-[10px] font-bold text-slate-400">Knowledge Extension:</span>
                  <p className="text-slate-600 text-xs font-mono bg-slate-50 p-2 rounded mt-0.5">{selectedQuestion.extension}</p>
                </div>
              )}
            </div>

            {/* 3W-1L MISTAKE DEEP ANALYSIS DISPLAY */}
            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/50 space-y-3">
              <span className="px-2 py-0.5 text-[9px] font-black tracking-wider bg-amber-600 text-white rounded">
                3W-1L cognitive error log
              </span>

              <div className="grid grid-cols-1 gap-2.5">
                {selectedQuestion.threeWOneL.what && (
                  <div className="bg-white p-2 rounded-lg border border-amber-100">
                    <span className="font-bold text-amber-800 text-[10px] block">✏️ WHAT - Điều gì gây ra sai sót (What)?</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{selectedQuestion.threeWOneL.what}</p>
                  </div>
                )}
                {selectedQuestion.threeWOneL.action && (
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-800 text-[10px] block">🛡️ WHERE - Hành động sửa đổi hoặc sửa lỗi ở đâu (Where)?</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{selectedQuestion.threeWOneL.action}</p>
                  </div>
                )}
                {selectedQuestion.threeWOneL.why && (
                  <div className="bg-white p-2 rounded-lg border border-amber-100">
                    <span className="font-bold text-amber-800 text-[10px] block">🔍 WHY - Tại sao bạn tư duy sai lệch (Why)?</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{selectedQuestion.threeWOneL.why}</p>
                  </div>
                )}
                {selectedQuestion.threeWOneL.lesson && (
                  <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                    <span className="font-bold text-indigo-800 text-[10px] block">💡 LESSON LEARN - Bài học kinh nghiệm lâu dài (Lesson Learn)?</span>
                    <p className="text-slate-800 mt-0.5 font-bold leading-relaxed">{selectedQuestion.threeWOneL.lesson}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setMobileMode('list');
                setSelectedQuestionId(null);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-center"
            >
              Go Back
            </button>
          </div>
        )}

        {/* 3. ADD AND EDIT FORM STATE */}
        {mobileMode === 'add' && (
          <form onSubmit={handleSaveQuestionSubmit} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-4 text-xs font-semibold">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h2 className="text-sm font-black font-display text-slate-800">
                {editingQuestionId ? "Edit PMP Question" : "Add Today's Question"}
              </h2>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-400">STT:</span>
                <input
                  type="number"
                  value={qStt}
                  onChange={(e) => setQStt(Number(e.target.value))}
                  className="w-12 p-1 text-center bg-slate-50 border border-slate-200 rounded text-xs"
                />
              </div>
            </div>

            {formError && (
              <div className="p-2 bg-red-50 text-red-700 rounded text-[11px]">{formError}</div>
            )}

            {/* Title / Stem */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">PMP Question Stem <span className="text-red-500">*</span></label>
              <textarea
                value={qQuestion}
                onChange={(e) => setQQuestion(e.target.value)}
                placeholder="Type question text here... e.g. The customer refuses to sign off on the deliverable..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-slate-50/50 min-h-[90px] font-medium"
                required
              />
            </div>

            {/* Category / Domain selection */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">Knowledge Domain</label>
              <select
                value={qDomain}
                onChange={(e) => setQDomain(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Answer inputs A, B, C, D */}
            <div className="space-y-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/50">
              <span className="block text-[9px] font-black tracking-wider uppercase text-slate-400">Multiple Choices</span>
              
              <div className="space-y-1.5 text-slate-700">
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center font-bold">A</span>
                  <input
                    type="text"
                    placeholder="Option A..."
                    value={qOptionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center font-bold">B</span>
                  <input
                    type="text"
                    placeholder="Option B..."
                    value={qOptionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center font-bold">C</span>
                  <input
                    type="text"
                    placeholder="Option C..."
                    value={qOptionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center font-bold">D</span>
                  <input
                    type="text"
                    placeholder="Option D..."
                    value={qOptionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>

              {/* Correct key dropdown */}
              <div className="pt-2 border-t border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold">Correct Option:</label>
                  <select
                    value={qCorrect}
                    onChange={(e) => setCorrect(e.target.value as any)}
                    className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded text-xs"
                  >
                    <option value="">-- Select --</option>
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3W - 1L Mistake Log form area */}
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/50 space-y-3">
              <div className="flex justify-between items-center pb-1 border-b border-amber-100">
                <span className="block text-[10px] uppercase font-bold text-amber-800">3W-1L Cognitive Error Log</span>
                
                {/* Auto Populate helper templates */}
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => applyFormTemplate('mistake_pmp')}
                    className="px-1.5 py-0.5 bg-red-100 border border-red-200 rounded text-[9px] text-red-700"
                  >
                    Wrong Answer ❌
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormTemplate('correct_pmp')}
                    className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-200 rounded text-[9px] text-emerald-700"
                  >
                    Correct (Take Note)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-bold text-amber-800">What:</label>
                  <input
                    type="text"
                    value={qWhat}
                    onChange={(e) => setWhat(e.target.value)}
                    placeholder="e.g. Issue đã xảy ra và giải quyết..."
                    className="w-full mt-1 p-2 bg-white border border-slate-200 text-xs rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-amber-800">Where (What correct PMI action is needed / Where to align?):</label>
                  <input
                    type="text"
                    value={qAction}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="e.g. Sổ đăng ký rủi ro (Risk Register)..."
                    className="w-full mt-1 p-2 bg-white border border-slate-200 text-xs rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-emerald-800">Why:</label>
                  <input
                    type="text"
                    value={qWhy}
                    onChange={(e) => setWhy(e.target.value)}
                    placeholder="e.g. Trầm trọng hoá vấn đề hoặc chọn sai bước..."
                    className="w-full mt-1 p-2 bg-white border border-slate-200 text-xs rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-indigo-900">Lesson Learn:</label>
                  <input
                    type="text"
                    value={qLesson}
                    onChange={(e) => setLesson(e.target.value)}
                    placeholder="e.g. Bài học rút ra cho kì thi..."
                    className="w-full mt-1 p-2 bg-white border border-slate-200 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Optional additions */}
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <label className="block text-[10px] text-slate-400">Official Explanation / References:</label>
                <textarea
                  value={qExplanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Paste official explanation here..."
                  className="w-full mt-1 p-1.5 border border-slate-200 bg-slate-50 text-xs rounded focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">External Notes / References (Link, page):</label>
                <textarea
                  value={qExtension}
                  onChange={(e) => setExtension(e.target.value)}
                  placeholder="e.g., PMBOK 7th Edition Page 142..."
                  className="w-full mt-1 p-1.5 border border-slate-200 bg-slate-50 text-xs rounded focus:outline-none"
                />
              </div>
            </div>

            {/* Buttons of Form */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMobileMode('list')}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700"
              >
                Save Question
              </button>
            </div>

          </form>
        )}

        {/* 4. CHUYÊN MỤC TRẮC NGHIỆM FLASHCARD (10 CÂU NGẪU NHIÊN) */}
        {mobileMode === 'flashcard' && flashcardQuestions.length > 0 && (
          <div className="space-y-4 animate-fade-in text-xs">
            
            {/* Header section with Exit button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMobileMode('list');
                  setFlashcardQuestions([]);
                }}
                className="flex items-center space-x-1 text-slate-800 font-bold py-1.5 px-3 bg-slate-100 hover:bg-slate-250 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Exit Quiz</span>
              </button>
              
              <span className="font-mono text-[10px] font-black uppercase text-slate-400">
                ⭐ Flashcard Mode
              </span>
            </div>

            {!isFlashcardQuizFinished ? (
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>Quiz Progress</span>
                    <span>Question {flashcardIndex + 1} / {flashcardQuestions.length}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${((flashcardIndex + 1) / flashcardQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* The Flashcard itself */}
                {(() => {
                  const currentQ = flashcardQuestions[flashcardIndex];
                  const chosenOption = flashcardAnswers[flashcardIndex] || null;
                  const isAnswerCorrect = chosenOption === currentQ.correctOption;

                  return (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-indigo-100/70 space-y-4 relative overflow-hidden">
                        
                        {/* Decorative background circle */}
                        <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-50 rounded-full -z-0 opacity-40 select-none pointer-events-none" />

                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase relative z-10">
                          <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                            STT #{currentQ.stt}
                          </span>
                          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded max-w-[150px] truncate">
                            {currentQ.domain}
                          </span>
                        </div>

                        {/* Front Side: Question body */}
                        <div className="space-y-3 relative z-10">
                          <p className="text-slate-800 text-sm font-black leading-relaxed">
                            {currentQ.question}
                          </p>
                        </div>

                        {/* Interactive Option List */}
                        <div className="space-y-2 pt-2 relative z-10">
                          {['A', 'B', 'C', 'D'].map((optKey) => {
                            const optText = currentQ.options[optKey as 'A' | 'B' | 'C' | 'D'];
                            if (!optText) return null;

                            const isSelected = chosenOption === optKey;
                            const isCorrect = currentQ.correctOption === optKey;

                            let btnStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-105";
                            
                            if (flashcardFlipped) {
                              if (isCorrect) {
                                btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold";
                              } else if (isSelected) {
                                btnStyle = "bg-red-50 border-red-350 text-red-800 font-semibold";
                              } else {
                                btnStyle = "bg-slate-50/50 border-slate-100 text-slate-400 opacity-60";
                              }
                            } else {
                              if (isSelected) {
                                btnStyle = "bg-indigo-50 border-indigo-400 text-indigo-900 font-bold ring-1 ring-indigo-400";
                              }
                            }

                            return (
                              <button
                                key={optKey}
                                type="button"
                                disabled={flashcardFlipped}
                                onClick={() => {
                                  setFlashcardAnswers(prev => ({ ...prev, [flashcardIndex]: optKey as any }));
                                  setFlashcardFlipped(true);
                                }}
                                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all text-xs flex items-start space-x-2.5 cursor-pointer ${btnStyle}`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 border ${
                                  flashcardFlipped && isCorrect 
                                    ? "bg-emerald-500 text-white border-emerald-500" 
                                    : flashcardFlipped && isSelected 
                                    ? "bg-red-500 text-white border-red-500"
                                    : isSelected 
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-500"
                                }`}>
                                  {optKey}
                                </span>
                                <span className="flex-1 leading-snug">{optText}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Direct Flip and skip logic */}
                        {!flashcardFlipped && (
                          <div className="pt-2 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setFlashcardFlipped(true)}
                              className="w-full py-2.5 bg-indigo-55 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                            >
                              <span>📖</span>
                              <span>SKIP & REVEAL KEY + 3W-1L</span>
                            </button>
                          </div>
                        )}

                        {/* Back Side content (3W-1L + Explanation) */}
                        {flashcardFlipped && (
                          <div className="pt-4 border-t border-slate-100 space-y-4 animate-fade-in relative z-10">
                            
                            {/* Score alert */}
                            {chosenOption && (
                              <div className={`p-3 rounded-xl flex items-center space-x-2 font-black ${
                                isAnswerCorrect ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
                              }`}>
                                <span className="text-sm leading-none">{isAnswerCorrect ? "🎯" : "❌"}</span>
                                <div>
                                  <p className="text-[11px]">{isAnswerCorrect ? "Correct answer!" : `Incorrect! The correct PMI answer key is ${currentQ.correctOption}.`}</p>
                                </div>
                              </div>
                            )}

                            {/* 3W-1L section */}
                            <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/50 space-y-3">
                              <span className="inline-block px-2 py-0.5 text-[9px] font-black tracking-wider bg-orange-500 text-slate-950 rounded">
                                3W-1L MISTAKE DEEP ANALYSIS
                              </span>

                              <div className="grid grid-cols-1 gap-2">
                                {currentQ.threeWOneL.what && (
                                  <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                                    <span className="font-bold text-amber-800 text-[10px] block">✏️ WHAT - What went wrong, exactly?</span>
                                    <p className="text-slate-700 mt-0.5 leading-relaxed font-semibold">{currentQ.threeWOneL.what}</p>
                                  </div>
                                )}
                                {currentQ.threeWOneL.why && (
                                  <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                                    <span className="font-bold text-amber-800 text-[10px] block">🔍 WHY - Why did you choose that incorrect option?</span>
                                    <p className="text-slate-700 mt-0.5 leading-relaxed font-semibold">{currentQ.threeWOneL.why}</p>
                                  </div>
                                )}
                                {currentQ.threeWOneL.action && (
                                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                                    <span className="font-bold text-emerald-800 text-[10px] block">🛡️ Action - Text-book correct PMI action:</span>
                                    <p className="text-slate-700 mt-0.5 leading-relaxed font-semibold">{currentQ.threeWOneL.action}</p>
                                  </div>
                                )}
                                {currentQ.threeWOneL.lesson && (
                                  <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                    <span className="font-bold text-indigo-800 text-[10px] block">💡 L - 1-line key takeaway lesson:</span>
                                    <p className="text-indigo-950 mt-0.5 font-bold leading-relaxed">{currentQ.threeWOneL.lesson}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Standard explanation */}
                            {currentQ.explanation && (
                              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl">
                                <span className="block text-[10px] font-black uppercase text-slate-400">Explanation & References:</span>
                                <p className="mt-1 leading-relaxed italic">{currentQ.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}

                      </div>

                      {/* Footer Action to proceed to next card */}
                      {flashcardFlipped && (
                        <div className="flex justify-end pt-1">
                          {flashcardIndex < flashcardQuestions.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setFlashcardIndex(prev => prev + 1);
                                setFlashcardFlipped(false);
                              }}
                              className="w-full py-3 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <span>Next Question</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsFlashcardQuizFinished(true)}
                              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Award className="w-4 h-4" />
                              <span>Finish & See Performance Score</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Flashcard Quiz Result Summary view */
              <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-150 space-y-5 text-center animate-fade-in text-xs">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border-2 border-amber-300">
                    <span className="text-3xl">🏆</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 font-display">PERFORMANCE RESULT SUMMARY</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">PMP PREPARATION — 3W-1L</p>
                </div>

                {/* Score panel */}
                {(() => {
                  let correctCount = 0;
                  flashcardQuestions.forEach((q, idx) => {
                    const ans = flashcardAnswers[idx];
                    if (ans && ans === q.correctOption) {
                      correctCount++;
                    }
                  });
                  const isPass = correctCount >= 7;

                  return (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 border border-slate-200/80 rounded-xl inline-block px-10">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Correct answers</span>
                        <div className="flex items-baseline justify-center space-x-1 mt-1">
                          <span className="text-3xl font-black text-indigo-600">{correctCount}</span>
                          <span className="text-slate-400 font-bold text-sm">/ {flashcardQuestions.length}</span>
                        </div>
                        <span className={`inline-block mt-2 text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          isPass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {isPass ? "🎯 TARGET SATISFIED (>= 70%)" : "⚠️ NEEDS MORE PRACTICE (< 70%)"}
                        </span>
                      </div>

                      <p className="text-slate-600 leading-relaxed max-w-sm mx-auto p-2 bg-indigo-50/30 rounded border border-indigo-100/40">
                        {isPass 
                          ? "Fantastic! The 3W-1L mindset is sinking deep into your habits. Continue to review and refer to PMBOK Guide chapters for high confidence during the real exam!"
                          : "Don't worry! Reviewing questions you missed is exactly how you pass the PMP exam. Take some time to review your 3W-1L logs to turn errors into future points."
                        }
                      </p>

                      {/* Detailed Question Review Check list */}
                      <div className="border-t border-slate-100 pt-4 text-left space-y-2">
                        <span className="block text-[10px] font-black uppercase text-slate-400 pb-1">Detailed Flashcard Breakdown:</span>
                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                          {flashcardQuestions.map((q, idx) => {
                            const ans = flashcardAnswers[idx];
                            const isCorrect = ans === q.correctOption;
                            return (
                              <div key={idx} className="p-2 border border-slate-100 rounded-lg flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center space-x-2 truncate mr-2">
                                  <span className={`w-4 h-4 flex items-center justify-center text-[8px] font-bold text-white shrink-0 rounded-full ${
                                    isCorrect ? "bg-emerald-500" : "bg-red-400"
                                  }`}>
                                    {isCorrect ? "✓" : "✗"}
                                  </span>
                                  <span className="font-mono text-slate-400 font-bold text-[9px]">STT#{q.stt}</span>
                                  <span className="text-slate-700 truncate font-semibold">{q.question}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-500 shrink-0">
                                  {ans ? `Ans: ${ans}` : "Skipped"} (Key: {q.correctOption})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={handleStartFlashcards}
                          className="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Practice Another Deck
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMode('list');
                            setFlashcardQuestions([]);
                          }}
                          className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg transition-colors shadow-md cursor-pointer text-center"
                        >
                          Back to Home
                        </button>
                      </div>

                    </div>
                  );
                })()}

              </div>
            )}

          </div>
        )}

      </div>


      {/* Custom Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-600 uppercase tracking-wide">
                {confirmState.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-bold">
                {confirmState.message}
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code and Mobile Access Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4">
            <div className="space-y-1 w-full">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                <Smartphone className="w-5 h-5 animate-bounce" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Học Trên Điện Thoại 📱
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Mở link hoặc quét mã QR dưới đây bằng camera, Zalo hoặc trình duyệt điện thoại để thực hành ngay:
              </p>
            </div>

            {/* QR Code Container */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200/50 shadow-inner flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getMobileUrl())}`}
                alt="QR Code Mobile"
                className="w-[180px] h-[180px] bg-white rounded-lg p-1.5 shadow"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-200/50 truncate max-w-full select-all">
              {getMobileUrl()}
            </div>

            <div className="flex items-center space-x-2 w-full pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 rounded-lg text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "Đã sao chép!" : "Sao chép link"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="py-2 px-5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
