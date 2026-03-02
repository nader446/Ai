import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Activity, 
  Search, 
  History, 
  Trash2, 
  Volume2, 
  Mic, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Car,
  Settings,
  HelpCircle,
  Menu,
  X,
  Zap,
  ShieldCheck,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDropzone } from "react-dropzone";
import { cn } from "./lib/utils";
import { GoogleGenAI } from "@google/genai";

interface HistoryItem {
  id: number;
  type: string;
  input_text: string;
  result: string;
  created_at: string;
}

const DIAGNOSTIC_TYPES = [
  { id: 'body', label: 'فحص الهيكل والطلاء', icon: Camera, color: 'blue', desc: 'كشف الرش وأضرار الشاسيه' },
  { id: 'parts', label: 'التحقق من القطع', icon: ShieldCheck, color: 'emerald', desc: 'تمييز الأصلي من المقلد' },
  { id: 'engine', label: 'تحليل صوت المحرك', icon: Activity, color: 'purple', desc: 'كشف الأعطال الميكانيكية' },
  { id: 'dash', label: 'تشخيص لوحة القيادة', icon: LayoutDashboard, color: 'orange', desc: 'تحليل لمبات التحذير' },
];

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] } 
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.onload = () => setAudio(reader.result as string);
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("يرجى السماح بالوصول إلى الميكروفون");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleDiagnose = async () => {
    if (!selectedType) return;
    setIsAnalyzing(true);
    setCurrentResult(null);
    setError(null);

    try {
      // ملاحظة لريبليت: تأكد من إضافة GEMINI_API_KEY في Secrets
      // في ريبليت، للوصول للمفتاح من الفرونت إند، نستخدم الطريقة التالية:
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";

      if (!apiKey) {
        throw new Error("مفتاح API غير موجود. يرجى إضافته في Secrets باسم VITE_GEMINI_API_KEY");
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";

      const prompt = `
        أنت مهندس ميكانيك خبير ومستشار فني في "عالم الميكانيك الشامل".
        مهمتك هي تقديم تحليل دقيق واحترافي باللغة العربية الفصحى بناءً على الصور والبيانات المرفوعة.

        نوع التشخيص المطلوب: ${selectedType}
        وصف المستخدم: ${inputText || "لا يوجد وصف نصي"}

        التعليمات الصارمة:
        1. إذا كان النوع "body": حلل الصور بدقة للبحث عن أي تموجات في الطلاء، اختلاف في درجات الألوان، فجوات غير منتظمة بين الأبواب (Panel gaps)، أو أي علامات تشير إلى "رش" (Repaint) أو سمكرة أو أضرار في الشاسيه. كن صريحاً جداً في تقييمك.
        2. إذا كان النوع "parts": قارن بين القطعة في الصورة والمعايير المصنعية المعروفة. ابحث عن الشعارات، جودة التشطيب، والأرقام التسلسلية لتمييز الأصلي (OEM) من المقلد.
        3. إذا كان النوع "engine": حلل الوصف النصي أو الملف الصوتي (إن وجد) لتحديد أصوات الطرق (Knocking)، التكتكة، أو أي اهتزازات غير طبيعية.
        4. إذا كان النوع "dash": حلل رموز لوحة القيادة (Check Engine, ABS, Airbag) واشرح خطورة كل رمز والإجراء الفوري المطلوب.
        5. في جميع الحالات: قدم تقديراً للسعر السوقي (عالمياً ومحلياً) بناءً على حالة المركبة الموضحة.

        يجب أن يكون الرد منسقاً باستخدام Markdown، مع عناوين واضحة ونقاط محددة. ابدأ دائماً بملخص سريع للحالة ثم التفاصيل التقنية.
      `;

      const parts: any[] = [{ text: prompt }];

      if (images.length > 0) {
        images.forEach((img) => {
          const mimeType = img.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
          parts.push({
            inlineData: {
              mimeType,
              data: img.split(",")[1] || img
            }
          });
        });
      }

      if (audio) {
        parts.push({
          inlineData: {
            mimeType: "audio/mp3",
            data: audio.split(",")[1] || audio
          }
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
      });

      const resultText = response.text || "عذراً، لم أتمكن من تحليل البيانات.";
      setCurrentResult(resultText);

      // حفظ في السجل
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          input_text: inputText,
          result: resultText
        })
      });

      fetchHistory();
    } catch (err: any) {
      console.error("Diagnosis Error:", err);
      setError(err.message || "حدث خطأ أثناء التشخيص");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
  };

  const deleteHistory = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا التشخيص؟")) return;
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      fetchHistory();
      if (activeHistoryId === id) {
        setActiveHistoryId(null);
        setCurrentResult(null);
      }
    } catch (err) {
      alert("فشل الحذف");
    }
  };

  const selectHistoryItem = (item: HistoryItem) => {
    setActiveHistoryId(item.id);
    setCurrentResult(item.result);
    setSelectedType(item.type);
    setInputText(item.input_text);
    setImages([]);
    setAudio(null);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white overflow-hidden font-sans" dir="rtl">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-[#111114] border-l border-white/5 flex flex-col relative overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Car className="text-white" size={24} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">عالم الميكانيك</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 px-2">سجل التشخيصات</div>
          {history.map((item) => (
            <div 
              key={item.id}
              onClick={() => selectHistoryItem(item)}
              className={cn(
                "sidebar-item p-4 rounded-2xl cursor-pointer group relative",
                activeHistoryId === item.id ? "active" : "text-white/60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">{item.type}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-[10px] opacity-40 truncate">{item.input_text || "بدون وصف"}</div>
              <div className="text-[9px] opacity-30 mt-2">{new Date(item.created_at).toLocaleDateString('ar-EG')}</div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm">
            <Settings size={18} />
            <span>الإعدادات</span>
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm">
            <HelpCircle size={18} />
            <span>المساعدة</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 shrink-0 bg-[#0a0a0b]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="h-6 w-[1px] bg-white/10 mx-2" />
            <h2 className="font-bold text-xl">لوحة التحكم الذكية</h2>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setSelectedType(null);
                setCurrentResult(null);
                setActiveHistoryId(null);
                setImages([]);
                setAudio(null);
                setInputText("");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <Zap size={16} />
              <span>تشخيص جديد</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-8">

            {!currentResult && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <h3 className="text-4xl font-bold tracking-tight">مرحباً بك في عالم الميكانيك الشامل</h3>
                  <p className="text-white/40 max-w-xl mx-auto">اختر نوع التشخيص الذي ترغب في إجرائه باستخدام أقوى تقنيات الذكاء الاصطناعي المتخصصة في عالم السيارات.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DIAGNOSTIC_TYPES.map((type) => (
                    <motion.div
                      key={type.id}
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedType(type.id)}
                      className={cn(
                        "glass-card p-6 rounded-3xl cursor-pointer transition-all border-2",
                        selectedType === type.id ? "border-blue-500 bg-blue-500/5" : "border-transparent hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                        selectedType === type.id ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/40"
                      )}>
                        <type.icon size={24} />
                      </div>
                      <h4 className="font-bold mb-1">{type.label}</h4>
                      <p className="text-[10px] text-white/40 leading-relaxed">{type.desc}</p>
                    </motion.div>
                  ))}
                </div>

                {selectedType && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card rounded-3xl p-8 space-y-6"
                  >
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">وصف المشكلة أو القطعة</label>
                      <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="اكتب هنا تفاصيل المشكلة أو اسم القطعة..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500 transition-all min-h-[120px] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest">الصور (اختياري)</label>
                        <div {...getRootProps()} className={cn(
                          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                          isDragActive ? "border-blue-500 bg-blue-500/5" : "border-white/10 hover:border-white/20"
                        )}>
                          <input {...getInputProps()} />
                          <Upload className="mx-auto mb-2 text-white/20" size={32} />
                          <p className="text-xs text-white/40">اسحب الصور هنا أو انقر للاختيار</p>
                        </div>
                        {images.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {images.map((img, i) => (
                              <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                                <img src={img} className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-red-500 transition-all"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest">الصوت (اختياري)</label>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
                          <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className={cn(
                              "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                              isRecording ? "bg-red-500 animate-pulse" : "bg-white/5 hover:bg-white/10"
                            )}
                          >
                            {isRecording ? <X size={24} /> : <Mic size={24} />}
                          </button>
                          <p className="text-xs text-white/40">{isRecording ? "جاري التسجيل..." : "سجل صوت المحرك"}</p>
                          {audio && <div className="text-[10px] text-emerald-400 font-bold">تم تسجيل الصوت بنجاح ✓</div>}
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3"
                      >
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    <button 
                      onClick={handleDiagnose}
                      disabled={isAnalyzing}
                      className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Activity className="animate-spin" size={20} />
                          <span>جاري التحليل الذكي...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={20} />
                          <span>بدء التشخيص الآن</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-24 space-y-8">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 rounded-full border-4 border-blue-500/20 border-t-blue-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Car className="text-blue-500 animate-bounce" size={40} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold">جاري فحص البيانات...</h3>
                  <p className="text-white/40">يقوم المهندس الافتراضي بتحليل الصور والبيانات بدقة عالية</p>
                </div>
              </div>
            )}

            {currentResult && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">تقرير التشخيص النهائي</h3>
                      <p className="text-xs text-white/40 font-mono uppercase tracking-widest">DIAGNOSTIC REPORT COMPLETED</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => speak(currentResult)}
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                      title="قراءة التقرير بصوت عالٍ"
                    >
                      <Volume2 size={20} />
                    </button>
                    <button 
                      onClick={() => setCurrentResult(null)}
                      className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10"
                    >
                      رجوع
                    </button>
                  </div>
                </div>

                <div className="glass-card rounded-3xl p-8 markdown-body">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {currentResult}
                  </Markdown>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}