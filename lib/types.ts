// Core TypeScript interfaces for Voice Agent
// Note: LiveSession and ServerMessage are now imported from '@google/genai'

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
  functionCall?: {
    id: string;
    name: 'show_menu' | 'hide_menu' | 'close_session';
    args?: any;
  };
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
