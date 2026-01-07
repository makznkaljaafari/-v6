
import React, { useState, useRef, useEffect, memo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { useUI } from '../context/UIContext'; // Changed from @/context/UIContext
import { useData } from '../context/DataContext'; // Changed from @/context/DataContext
import { aiTools, SYSTEM_INSTRUCTION } from '../services/geminiService'; // Changed from @/services/geminiService
import { useAIProcessor } from '../hooks/useAIProcessor'; // Changed from @/hooks/useAIProcessor
import { useIsMounted } from '../hooks/useIsMounted'; // Changed from @/hooks/useIsMounted

// Helper to encode Uint8Array to base64 string
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode base64 string to Uint8Array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode raw PCM audio data into AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const VoiceAssistant: React.FC = () => {
  const { addNotification, user, resolvedTheme } = useUI();
  const { customers, suppliers, categories, sales, purchases, vouchers, exchangeRates, addSale, addPurchase, addVoucher, returnSale, returnPurchase } = useData();
  const { pendingAction, setPendingAction, ambiguityMatches, executeAction, validateToolCall, errorInfo, setErrorInfo } = useAIProcessor();
  
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState('جاهز لسماعك...');
  const [inputAudioContext, setInputAudioContext] = useState<AudioContext | null>(null);
  const [outputAudioContext, setOutputAudioContext] = useState<AudioContext | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const sessionPromise = useRef<Promise<any> | null>(null);
  const nextStartTime = useRef(0);
  const currentAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isComponentMounted = useIsMounted();

  useEffect(() => {
    if (!user?.enable_voice_ai) {
      setIsActive(false);
      return;
    }

    if (isActive) {
      initVoiceSession();
    } else {
      closeVoiceSession();
    }

    return () => closeVoiceSession();
  }, [isActive, user?.enable_voice_ai]);

  const initVoiceSession = async () => {
    if (sessionPromise.current) return;

    if (!isComponentMounted()) return;
    setStatusText('جاري الاتصال بـ Gemini...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isComponentMounted()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setMediaStream(stream);

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      if (!isComponentMounted()) {
        inputCtx.close();
        outputCtx.close();
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      setInputAudioContext(inputCtx);
      setOutputAudioContext(outputCtx);

      // IMPORTANT: API key must be accessible via process.env.API_KEY as per guidelines.
      // If `process` is undefined in the browser, this will fail. Ensure your environment provides it.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      sessionPromise.current = ai.live.connect({
        // Updated to the latest recommended model for real-time audio
        model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
        callbacks: {
          onopen: () => {
            if (!isComponentMounted()) return;
            setStatusText('أنا أستمع...');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.current?.then((session) => {
                if (session && isComponentMounted()) { 
                  session.sendRealtimeInput({ media: pcmBlob });
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isComponentMounted()) return;

            if (message.serverContent?.outputTranscription) {
              setStatusText(message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              if (outputCtx) {
                playAudio(base64Audio, outputCtx);
              }
            }
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (validateToolCall(fc.name, fc.args)) {
                  setPendingAction(fc);
                  setStatusText(`جاري التحقق من أمر: ${fc.name}`);
                } else {
                  // If validation fails, use errorInfo from useAIProcessor to show a specific error to the user.
                  addNotification("فشل التحقق ⚠️", errorInfo || "لم يتم التحقق من الأمر الصوتي. حدث خطأ غير متوقع.", "warning");
                }
              }
            }
          },
          onerror: (e: ErrorEvent) => {
            if (!isComponentMounted()) return;
            console.error('Gemini Live Error:', e);
            const detail = e.message || (e.error?.message ? e.error.message : 'مشكلة في الاتصال.');
            setStatusText(`حدث خطأ: ${detail}. يرجى المحاولة مرة أخرى.`);
            addNotification("خطأ في Gemini AI ❌", `حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${detail}`, "warning");
            closeVoiceSession();
          },
          onclose: () => {
            if (!isComponentMounted()) return;
            setStatusText('تم إغلاق الاتصال.');
            closeVoiceSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: aiTools }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
    } catch (err: any) {
      if (!isComponentMounted()) return;
      console.error('Failed to start voice session:', err);
      const detail = err.message || 'تأكد من إذن الميكروفون.';
      setStatusText(`تعذر بدء المساعد الصوتي: ${detail}`);
      addNotification("خطأ 🎙️", `فشل بدء المساعد الصوتي: ${detail}`, "warning");
      closeVoiceSession();
    }
  };

  const closeVoiceSession = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    inputAudioContext?.close();
    outputAudioContext?.close();
    sessionPromise.current?.then((session) => session.close());
    sessionPromise.current = null;
    currentAudioSources.current.forEach(source => { try { source.stop(); } catch(e){} });
    currentAudioSources.current.clear();
    nextStartTime.current = 0;
    
    if (isComponentMounted()) { 
      setInputAudioContext(null);
      setOutputAudioContext(null);
      setPendingAction(null);
      setErrorInfo(null);
      setStatusText('جاهز لسماعك...');
    }
  };

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const playAudio = async (base64Audio: string, ctx: AudioContext) => {
    try {
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      
      if (!isComponentMounted()) return;

      nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.addEventListener('ended', () => {
        currentAudioSources.current.delete(source);
      });

      source.start(nextStartTime.current);
      nextStartTime.current = nextStartTime.current + audioBuffer.duration;
      currentAudioSources.current.add(source);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  if (!user?.enable_voice_ai) return null;

  return (
    <>
      {/* زر المساعد الصوتي - تصميم جذاب وديناميكي */}
      <div className="fixed bottom-20 left-6 z-[60] flex flex-col items-center">
        <button 
          onClick={() => setIsActive(!isActive)} 
          className={`group relative w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-500 border-4 active:scale-90 ${
            isActive 
              ? 'bg-rose-600 border-white/40 rotate-90' 
              : 'bg-indigo-600 border-white/20 shadow-[0_0_30px_rgba(79,70,229,0.6)] hover:scale-110'
          }`} 
          aria-label={isActive ? "إيقاف المساعد الصوتي" : "تفعيل المساعد الصوتي الذكي"}
        >
          {/* تأثير نبض الخلفية عند النشاط */}
          {isActive && (
            <div className="absolute inset-0 rounded-[2rem] bg-rose-600 animate-ping opacity-20"></div>
          )}
          
          <span className="text-3xl relative z-10">{isActive ? '✕' : '🎙️'}</span>
          
          {/* تلميح صغير فوق الزر */}
          {!isActive && (
            <div className="absolute bottom-full mb-3 px-3 py-1.5 bg-indigo-600 text-white text-[8px] font-black rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
              المساعد الصوتي الذكي
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-600"></div>
            </div>
          )}
        </button>
      </div>

      {isActive && (
        <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center p-8 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="w-full max-w-md flex flex-col items-center gap-10 text-center">
            
            {(pendingAction || ambiguityMatches.length > 0) ? (
              <div className="w-full bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border-4 border-indigo-600 page-enter">
                <div className="flex items-center justify-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg">⚡</div>
                   <h3 className="text-xl font-black">تأكيد القيد الصوتي</h3>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl mb-10 text-right space-y-3 shadow-inner">
                  {pendingAction?.args && Object.entries(pendingAction.args).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50 pb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{k}</span>
                      <span className="font-black text-indigo-600 dark:text-sky-400">{String(v)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-4">
                  <button onClick={() => executeAction()} className="flex-[2] bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl active:scale-95 transition-all">تأكيد القيد ✅</button>
                  <button onClick={() => setPendingAction(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 py-6 rounded-2xl font-black active:scale-95 transition-all">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col items-center">
                <div className="relative">
                   <div className="absolute inset-0 bg-indigo-500 blur-[80px] rounded-full opacity-30 animate-pulse"></div>
                   <div className="w-56 h-56 bg-indigo-600 rounded-[4rem] flex items-center justify-center text-8xl shadow-[0_0_80px_rgba(79,70,229,0.5)] border-8 border-white/10 animate-bounce-soft relative z-10">🎙️</div>
                </div>
                <h2 className="text-2xl font-black text-white mt-12 tracking-tight line-clamp-2 px-4">{statusText}</h2>
                <div className="flex gap-2 mt-6">
                   <div className="w-1 h-8 bg-indigo-500 rounded-full animate-[waveform_0.8s_ease-in-out_infinite]"></div>
                   <div className="w-1 h-12 bg-indigo-400 rounded-full animate-[waveform_1s_ease-in-out_infinite]"></div>
                   <div className="w-1 h-10 bg-indigo-300 rounded-full animate-[waveform_1.2s_ease-in-out_infinite]"></div>
                   <div className="w-1 h-6 bg-indigo-500 rounded-full animate-[waveform_0.9s_ease-in-out_infinite]"></div>
                </div>
                <p className="text-[10px] text-white/30 mt-8 uppercase tracking-[0.4em] font-black">Al-Shwaia Gemini Live AI</p>
              </div>
            )}
            
            <button onClick={() => setIsActive(false)} className="bg-white/10 text-white px-12 py-5 rounded-2xl font-black mt-8 active:scale-95 transition-all border border-white/5 shadow-2xl hover:bg-white/20">إغلاق المساعد الذكي</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(2); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default memo(VoiceAssistant);
