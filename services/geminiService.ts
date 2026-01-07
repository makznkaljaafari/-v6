
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Sale, Expense, ChatMessage, QatCategory, AppError } from "../types";
import { logger } from "./loggerService";

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// متغير لتتبع حالة الحظر المؤقت (Quota protection)
let isQuotaExhausted = false;
let quotaResetTime = 0;

export const SYSTEM_INSTRUCTION = `
أنت "المحاسب الذكي" لوكالة الشويع للقات. خبير محاسبي يمني يتحدث بلهجة السوق.
مهامك: (القييد، الجرد، والمتابعة).

القواعد الذهبية:
1. الدقة: لا تنفذ عملية بيع لعميل غير موجود، اطلب إضافته أولاً.
2. المرتجعات: إذا طلب المدير "مرجع" أو "رجع"، استخدم أداة recordReturn للبحث عن آخر فاتورة وإلغائها.
3. التنبيهات: حذر المدير دائماً إذا كان العميل لديه ديون متراكمة قبل تسجيل بيع جديد.
4. الإيجاز: ردودك مختصرة وقوية مثل كبار التجار.
`;

export const aiTools: FunctionDeclaration[] = [
  {
    name: 'recordSale',
    description: 'تسجيل عملية بيع لعميل موجود.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_name: { type: Type.STRING },
        qat_type: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unit_price: { type: Type.NUMBER },
        currency: { type: Type.STRING, enum: ['YER', 'SAR', 'OMR'] },
        status: { type: Type.STRING, enum: ['نقدي', 'آجل'] }
      },
      required: ['customer_name', 'qat_type', 'quantity', 'unit_price', 'currency', 'status']
    }
  },
  {
    name: 'recordReturn',
    description: 'إلغاء فاتورة سابقة لعملية بيع أو شراء لعميل أو مورد.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation_type: { type: Type.STRING, enum: ['بيع', 'شراء'] },
        person_name: { type: Type.STRING }
      },
      required: ['operation_type', 'person_name']
    }
  },
  {
    name: 'recordVoucher',
    description: 'تسجيل سند قبض أو دفع مالي.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['قبض', 'دفع'] },
        person_name: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        currency: { type: Type.STRING, enum: ['YER', 'SAR', 'OMR'] }
      },
      required: ['type', 'person_name', 'amount', 'currency']
    }
  },
];

// وظيفة إعادة المحاولة المطورة
async function retryAI<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  if (isQuotaExhausted && Date.now() < quotaResetTime) {
    throw new AppError("المحاسب الذكي استنفد طاقته حالياً يا مدير. يرجى الانتظار دقيقة قبل المحاولة ثانية.", "QUOTA_LOCK", 429, true);
  }

  try {
    const result = await fn();
    isQuotaExhausted = false; // نجاح الطلب يعني الحصة متاحة
    return result;
  } catch (error: any) {
    const isRateLimit = error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      isQuotaExhausted = true;
      quotaResetTime = Date.now() + 60000; // قفل الطلبات لمدة دقيقة
      logger.warn("Gemini Quota Exhausted. Cooling down for 60s.");
      throw new AppError("المحاسب الذكي استنفد طاقته حالياً يا مدير. يرجى الانتظار دقيقة قبل المحاولة ثانية.", "QUOTA_EXHAUSTED", 429, true);
    }

    if (retries > 0) {
      logger.warn(`AI request failed. Retrying... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, delay));
      return retryAI(fn, retries - 1, delay * 2);
    }
    // Re-throw as AppError for other persistent errors
    const detail = error.message || (error.status ? `خطأ رقم ${error.status}` : 'مشكلة في الاتصال.');
    throw new AppError(`فشل الاتصال بسحابة Gemini: ${detail}`, error.code, error.status, true);
  }
}

const forecastCache: { [key: string]: { text: string, timestamp: number } } = {};
const CACHE_TTL = 30 * 60 * 1000; // زيادة وقت الكاش لـ 30 دقيقة لتقليل الطلبات

export const getChatResponse = async (message: string, history: ChatMessage[], context: any) => {
  const ai = getAIClient();
  const ctxStr = `سياق السوق: ${context.customers?.length} عملاء، ${context.suppliers?.length} موردين، صرف SAR: ${context.rates?.SAR_TO_YER}`;

  try {
    const response = await retryAI(async () => {
      const chatResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: message,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION + "\n" + ctxStr,
          tools: [{ functionDeclarations: aiTools }],
          thinkingConfig: { thinkingBudget: 0 } // تقليل ميزانية التفكير لتوفير التوكينز
        }
      });
      return { text: chatResponse.text, toolCalls: chatResponse.functionCalls || [] };
    });
    return response;
  } catch(e: any) {
    // Re-throw the AppError from retryAI directly
    if (e instanceof AppError) {
      throw e;
    }
    logger.error("AI Chat Cloud Error:", e);
    const detail = e.message || (e.status ? `خطأ رقم ${e.status}` : 'مشكلة في الاتصال.');
    throw new AppError(`المعذرة يا مدير، هناك مشكلة في الاتصال بسحابة Gemini: ${detail}`, e.code, e.status, true);
  }
};

export const getFinancialForecast = async (sales: Sale[], expenses: Expense[], categories: QatCategory[]) => {
  const summary = `sales:${sales.length},exp:${expenses.length},cat:${categories.length}`;
  const cached = forecastCache[summary];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.text;

  const ai = getAIClient();
  try {
    const resultText = await retryAI(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `بناءً على البيانات التالية: ${summary}، قدم توقعاً مالياً قصيراً ومختصراً بلهجة يمنية سوقية لتاجر قات يمني. ركز على نصيحة واحدة فقط.`,
        config: { systemInstruction: SYSTEM_INSTRUCTION, thinkingConfig: { thinkingBudget: 0 } }
      });
      return response.text || "واضح إن السوق طيب يا مدير، استمر.";
    });
    
    forecastCache[summary] = { text: resultText, timestamp: Date.now() };
    return resultText;
  } catch (e: any) {
    // Re-throw the AppError from retryAI directly
    if (e instanceof AppError) {
      throw e;
    }
    logger.error("Financial Forecast AI Error:", e);
    const detail = e.message || (e.status ? `خطأ رقم ${e.status}` : 'مشكلة في الاتصال.');
    throw new AppError(`السوق يشتي له صبر، حدث خطأ: ${detail}. الأمور بتتحسن بإذن الله.`, e.code, e.status, true);
  }
};
