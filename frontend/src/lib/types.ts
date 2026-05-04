export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_onboarded: boolean;
  is_impersonating: boolean;
}

export interface Topic {
  id: number;
  name: string;
  description?: string;
  submission_instructions?: string;
  url: string;
  owner_first_name?: string;
  owner_last_name?: string;
  outreach_count?: number;
  closed_at?: string | null;
  stats?: {
    strong_fit: number;
    potential_fit: number;
    weak_fit: number;
  };
}

export interface Question {
  id: number;
  text: string;
}

export interface OutreachSummary {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  topic: { id: number; name: string };
  created_at: string;
  analysis: { score: number; summary: string } | null;
  is_unread: boolean;
  attachment_count: number;
}

export interface OutreachAnalysis {
  summary: string;
  score: number;
  relevance_score: number;
  completeness_score: number;
  credibility_score: number;
  follow_ups: { id: number; text: string }[];
}

export interface OutreachDetail extends Omit<OutreachSummary, 'relevance_score'> {
  linkedin_url: string;
  feedback: boolean | null;
  analysis: OutreachAnalysis | null;
  attachments: { id: number; filename: string; file_size: number }[];
  responses: { question_id: number; text: string; response: string }[];
}
