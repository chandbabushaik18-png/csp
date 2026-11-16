import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Volume2, VolumeX, X, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { safeFetchJson } from '../utils/safeFetchJson';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AgriAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  initialQuery?: string;
  farmContext?: any;
}

export const AgriAssistantModal: React.FC<AgriAssistantModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  initialQuery = '',
  farmContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text:
        currentLang === 'te'
          ? 'నమస్కారం రైతు సోదరా! నేను మీ "రైతు నేస్తం" (Rythu Nestham) డిజిటల్ వ్యవసాయ సలహాదారుని. పంట ఎంపిక, చీడపీడల నివారణ, ఎరువుల మోతాదు లేదా డ్రోన్ పిచికారీ గురించి ఏదైనా అడగండి.'
          : 'Welcome, Farmer! I am your "Rythu Nestham" AI Agronomic Advisor. Ask me anything about crop protection, dosage, fertilizer schedules, mandi rates, or drone spraying.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      setInputQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text) return;

    const userMsg: Message = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await safeFetchJson<any>('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          language: currentLang,
          farmContext,
        }),
      });

      const data = res.data;
      if (res.ok && data?.success) {
        const botReply = data.reply || data.replyTe || data.replyEn || 'No response available.';
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: botReply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text:
              data?.error ||
              (currentLang === 'te'
                ? `AI సలహా సేవ అందుబాటులో లేదు (HTTP ${res.status}).`
                : `AI advisor is currently unavailable (HTTP ${res.status}).`),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (e) {
      console.error('Assistant error:', e);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text:
            currentLang === 'te'
              ? 'క్షమించండి, సర్వర్ కనెక్ట్ చేయడంలో సమస్య ఉంది. దయచేసి కాసేపటి తర్వాత ప్రయత్నించండి.'
              : 'Connection error. Please try again in a few moments.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const sampleQuestions =
    currentLang === 'te'
      ? [
          'మిరపలో నల్ల తామర పురుగు నివారణ ఎలా?',
          'వరిలో పిలకల దశలో ఏ ఎరువులు వేయాలి?',
          'రబీ సీజన్లో తక్కువ నీటితో పండే పంట ఏది?',
          'డ్రోన్ పిచికారీకి ఎకరానికి ఎంత ఖర్చవుతుంది?',
        ]
      : [
          'How to control Black Thrips in Chilli?',
          'Best fertilizer schedule for Paddy active tillering?',
          'Which high-yield crop requires least water in Rabi?',
          'What spray precautions apply in high wind?',
        ];

  return (
    <div className="fixed inset-0 z-50 bg-[#202820]/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-elevated rounded-[26px] max-w-2xl w-full h-[86vh] max-h-[720px] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#174C36] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-[#DDEDE2]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm font-display flex items-center gap-2">
                <span>రైతు నేస్తం AI (Rythu Nestham)</span>
                <span className="text-[10px] font-mono bg-white/15 px-2 py-0.5 rounded-lg text-[#DDEDE2]">
                  Gemini AI
                </span>
              </div>
              <div className="text-[11px] text-[#DDEDE2]/85">
                Contextual Telugu & English AI Advisory (Verify critical inputs locally)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isSpeaking) window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/15 cursor-pointer"
            aria-label="Close assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F5F6F3]/60">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-[#174C36] text-white rounded-tr-sm shadow-sm'
                    : 'bg-white/88 backdrop-blur-md text-[#202820] border border-white/80 rounded-tl-sm shadow-xs'
                }`}
              >
                {msg.text}

                {msg.sender === 'assistant' && (
                  <div className="mt-3 pt-2.5 border-t border-[#174C36]/10 flex items-center justify-between text-[#858D86]">
                    <span className="text-[10px] font-mono">{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => speakText(msg.text)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#174C36] hover:text-[#4D966B] cursor-pointer"
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{isSpeaking ? 'Stop Audio' : 'Listen (వినండి)'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[#5D665E] p-3 bg-white/85 rounded-2xl border border-white w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#174C36]" />
              <span>Analyzing farm telemetry & agronomy knowledge...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Queries */}
        <div className="p-3 bg-white/75 border-t border-[#174C36]/10 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <span className="text-[11px] font-semibold text-[#858D86] pl-1 shrink-0">Quick Queries:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => handleSend(q)}
              className="px-3 py-1.5 text-[11px] font-medium bg-[#DDEDE2]/75 text-[#174C36] rounded-xl hover:bg-[#DDEDE2] transition-colors shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white/85 border-t border-[#174C36]/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              placeholder={
                currentLang === 'te'
                  ? 'మీ వ్యవసాయ ప్రశ్నను ఇక్కడ అడగండి...'
                  : 'Type your farming question in English or Telugu...'
              }
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="flex-1 bg-white border border-[#174C36]/15 rounded-xl px-4 py-2.5 text-xs font-medium text-[#202820] focus:outline-none focus:border-[#174C36]"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
