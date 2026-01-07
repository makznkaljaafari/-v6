
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { getChatResponse } from '../services/geminiService';
import { ChatMessage, AppError } from '../types';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { useIsMounted } from '../hooks/useIsMounted'; // Import useIsMounted

const AIAdvisor: React.FC = () => {
  const { sales, customers, purchases, vouchers, categories, suppliers, exchangeRates, navigate, theme, addNotification } = useApp();
  const { 
    pendingAction, setPendingAction, ambiguityMatches, setAmbiguityMatches, 
    debtWarning, errorInfo, setErrorInfo, validateToolCall, executeAction 
  } = useAIProcessor();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useIsMounted(); // Initialize useIsMounted hook

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome', role: 'model',
        text: 'أهلاً يا مدير. أنا رفيقك الذكي Gemini، جاهز لإدارة الحسابات وتنفيذ الأوامر الصوتية والنصية. كيف يمكنني مساعدتك اليوم؟',
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const aiResponse = await getChatResponse(input, messages, { sales, customers, purchases, vouchers, categories, suppliers, rates: exchangeRates });
      
      if (!isComponentMounted()) return; // Check if component is still mounted before state updates

      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const tool = aiResponse.toolCalls[0];
        // Validate and set pending action for confirmation
        if (validateToolCall(tool.name, tool.args)) {
          setPendingAction(tool);
        } else {
          // If validation fails, use errorInfo from useAIProcessor to show a specific error to the user.
          addNotification("فشل التحقق ⚠️", errorInfo || "لم يتم التحقق من الأمر الصوتي. حدث خطأ غير متوقع.", "warning");
        }
      }

      const modelMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), role: 'model', 
        text: aiResponse.text || "أبشر يا مدير، جاري تنفيذ طلبك...", 
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      if (!isComponentMounted()) return; // Check if component is still mounted before state updates
      
      const errorMessage = err instanceof AppError ? err.message : "المعذرة، واجهت مشكلة في الاتصال بسحابة Gemini.";
      addNotification("خطأ في المحاسب الذكي ❌", errorMessage, "warning");
      
      // Still add to chat for context
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: errorMessage, timestamp: new Date().toISOString() }]);
    } finally {
      if (!isComponentMounted()) return; // Check if component is still mounted before state updates
      setIsTyping(false);
    }
  };

  return (
    <PageLayout title="المحاسب الذكي Gemini" onBack={() => navigate('dashboard')}>
      <div className="flex flex-col h-[78vh] max-w-4xl mx-auto px-2 relative">
        
        {/* سجل المحادثة */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-44 space-y-6 pt-4 px-2" role="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-5 rounded-[2rem] shadow-2xl relative ${
                m.role === 'user' 
                  ? 'bg-[var(--color-background-card)] text-[var(--color-text-default)] rounded-bl-none border border-[var(--color-border-default)]' 
                  : 'bg-gradient-to-br from-[var(--color-accent-indigo)] to-[var(--color-accent-indigo)]/80 text-[var(--color-text-inverse)] rounded-br-none'
              }`} role="status">
                <p className="font-bold text-xs md:text-base leading-relaxed whitespace-pre-line">{m.text}</p>
                <div className="flex justify-between items-center mt-3 opacity-30 text-[var(--color-text-muted)]">
                   <span className="text-[7px] font-black tabular-nums" aria-label={`وقت الرسالة ${new Date(m.timestamp).toLocaleTimeString('ar-YE', {hour:'2-digit', minute:'2-digit'})}`}>{new Date(m.timestamp).toLocaleTimeString('ar-YE', {hour:'2-digit', minute:'2-digit'})}</span>
                   <span className="text-[7px] font-black uppercase tracking-widest">{m.role === 'user' ? 'المدير' : 'Gemini AI'}</span>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-end p-4" aria-live="polite" aria-label="جاري كتابة الرد">
               <div className="glass-ai px-6 py-3 rounded-full flex gap-1 items-center animate-pulse">
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent-indigo)] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent-indigo)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent-indigo)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
               </div>
            </div>
          )}
        </div>

        {/* نافذة التأكيد الذكي */}
        {(pendingAction || errorInfo || ambiguityMatches.length > 0) && (
          <div className="absolute inset-x-2 bottom-28 z-[100] animate-in zoom-in-95" role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title">
             <div className={`p-8 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.3)] border-4 border-[var(--color-accent-indigo)] bg-[var(--color-background-card)]`}>
                {pendingAction && (
                   <div className="space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-[var(--color-accent-indigo)] text-[var(--color-text-inverse)] rounded-xl flex items-center justify-center text-2xl shadow-lg animate-pulse" aria-hidden="true">⚡</div>
                         <h4 id="confirmation-dialog-title" className="font-black text-lg text-[var(--color-text-default)]">تأكيد العملية سحابياً</h4>
                      </div>
                      <div className="bg-[var(--color-background-tertiary)] p-6 rounded-2xl space-y-2 text-[var(--color-text-default)]" role="region" aria-label="تفاصيل العملية المقترحة">
                         {Object.entries(pendingAction.args || {}).map(([k,v]: any) => (
                           <div key={k} className="flex justify-between text-xs font-black">
                              <span className="opacity-40 text-[var(--color-text-muted)]">{k}</span>
                              <span className="text-[var(--color-accent-indigo)] dark:text-[var(--color-accent-sky)]">{String(v)}</span>
                           </div>
                         ))}
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => executeAction()} className="flex-[2] bg-[var(--color-accent-indigo)] text-[var(--color-text-inverse)] py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all" aria-label="تأكيد تنفيذ القيد">تأكيد القيد ✅</button>
                         <button onClick={() => setPendingAction(null)} className="flex-1 bg-[var(--color-background-tertiary)] text-[var(--color-text-default)] py-4 rounded-xl font-black" aria-label="إلغاء العملية المقترحة">إلغاء</button>
                      </div>
                   </div>
                )}
             </div>
          </div>
        )}

        {/* مدخل النص */}
        <div className="fixed bottom-24 left-0 right-0 px-4 max-w-4xl mx-auto z-50">
           <form onSubmit={handleSend} className="relative group" role="search">
              <input 
                type="text" 
                className={`w-full rounded-full p-6 pr-8 pl-24 font-black text-sm md:text-xl shadow-3xl border-4 outline-none transition-all bg-[var(--color-background-card)] border-[var(--color-border-subtle)] text-[var(--color-text-default)] focus:border-[var(--color-accent-indigo)]`}
                placeholder="اسأل Gemini (بيع، توريد، ديون)..."
                value={input} onChange={e => setInput(e.target.value)}
                aria-label="أدخل رسالتك إلى المحاسب الذكي"
                disabled={isTyping}
              />
              <button 
                type="submit" 
                disabled={isTyping}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-[var(--color-accent-indigo)] text-[var(--color-text-inverse)] rounded-full shadow-xl active:scale-90 transition-all flex items-center justify-center text-2xl"
                aria-label="إرسال رسالتك"
              >🚀</button>
           </form>
        </div>
      </div>
    </PageLayout>
  );
};

export default AIAdvisor;
