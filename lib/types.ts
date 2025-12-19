// Core TypeScript interfaces for Voice Agent

// Message in conversation transcript
export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

// Voice session state
export interface VoiceState {
  isConnected: boolean;
  isRecording: boolean;
  transcript: Message[];
  error: string | null;
}

// Gemini Live API session interface
export interface LiveSession {
  sendRealtimeInput: (data: { audio: { data: string; mimeType: string } }) => void;
  close: () => void;
}

// Gemini Live API message types
export interface ServerMessage {
  serverContent?: {
    turnComplete?: boolean;
    modelTurn?: {
      parts: Array<{
        text?: string;
        inlineData?: {
          data: string;
          mimeType: string;
        };
      }>;
    };
  };
  text?: string;
  data?: string;
}

// Token usage metadata
export interface TokenUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

// Parsed server message (returned by parseServerMessage)
export interface ParsedServerMessage {
  text?: string;
  audioData?: string;
  turnComplete: boolean;
  usageMetadata?: TokenUsage;
}

// Audio configuration
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

// Session configuration
export interface SessionConfig {
  model: string;
  systemInstruction: string;
  responseModalities: string[];
}
