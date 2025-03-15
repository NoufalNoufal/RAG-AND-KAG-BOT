export interface Message {
  role: 'user' | 'assistant';
  content: string;
  followupQuestions?: string[];
  entities?: Entity[];
  relationships?: Relationship[];
}

export interface ChatResponse {
  response: string;
  session_id?: string;
  followup_questions?: string[];
  conversational_response?: string;
  results?: Array<{
    content: string;
    metadata: {
      source: string;
      page?: number;
    };
    score?: number;
  }>;
  error?: string;
}

export interface ChatRequest {
  query: string;
  chat_history: Message[];
  session_id?: string;
  k?: number;
}

export type AssistantType = 'rag' | 'kag';

export interface EntityProperty {
  name: string;
  value: string | number | boolean;
}

export interface Entity {
  name: string;
  type: string;
  labels?: string[];
  properties?: Record<string, any>;
}

export interface Relationship {
  source: string;
  target: string;
  relationship: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphResponse {
  entities: Entity[];
  relationships: Relationship[];
}

export interface PDFDocument {
  id: string;
  filename: string;
  upload_date: string;
  size?: number;
  page_count?: number;
}

// New types for KAG API

export interface KAGDocument {
  id: string;
  filename: string;
  upload_date: string;
  document_type: string;
  entities?: Entity[];
  relationships?: Relationship[];
  metadata?: Record<string, any>;
}

export interface KAGQueryParams {
  query: string;
  document_type?: string | null;
  limit?: number;
  format_as_text?: boolean;
}

export interface KAGQueryResult {
  entity: Entity;
  confidence: number;
  source_document?: string;
  context?: string;
}

export interface KAGStandardResponse {
  query: string;
  results: KAGQueryResult[];
  conversational_response?: string;
  session_id?: string;
  execution_time?: number;
}

export interface KAGSimplifiedResponse {
  query: string;
  results: Record<string, any>[];
  conversational_response?: string;
  session_id?: string;
}

export interface KAGTextResponse {
  text: string;
  session_id?: string;
}