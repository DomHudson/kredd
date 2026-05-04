import type { Topic, OutreachDetail, OutreachSummary, Question, User } from '@/lib/types';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me/', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<User>;
}

export async function login(email: string, password: string): Promise<void> {
  await post('/api/auth/login/', { email, password });
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout/', {});
}

export async function updateMe(first_name: string, last_name: string, current_password: string, new_password: string): Promise<void> {
  await post('/api/auth/me/update/', { first_name, last_name, current_password, new_password });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await post('/api/auth/password-reset/request/', { email });
}

export async function validatePasswordResetToken(token: string): Promise<boolean> {
  const data = await apiFetch<{ valid: boolean }>(
    `/api/auth/password-reset/validate/?token=${encodeURIComponent(token)}`,
  );
  return data.valid;
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await post('/api/auth/password-reset/confirm/', { token, password });
}

export async function signup(
  first_name: string,
  last_name: string,
  email: string,
  password: string,
): Promise<void> {
  await post('/api/auth/signup/', { first_name, last_name, email, password });
}

// ── Onboarding ────────────────────────────────────────────────────────────────

interface OnboardingTopic {
  name: string;
  description: string;
  questions: { text: string; model_answer: string }[];
}

interface PrefillQuestion {
  text: string;
  model_answer: string;
}

interface PrefillTopic {
  name: string;
  description: string;
  questions: PrefillQuestion[];
}

export async function onboardingPrefill(role: string, description: string): Promise<PrefillTopic[]> {
  const data = await post<{ topics: PrefillTopic[] }>('/api/onboarding/prefill/', { role, description });
  return data.topics;
}

export async function completeOnboarding(
  topics: OnboardingTopic[],
): Promise<{ name: string; url: string }[]> {
  const data = await post<{ topics: { name: string; url: string }[] }>('/api/onboarding/', { topics });
  return data.topics;
}

// ── Topics ─────────────────────────────────────────────────────────────────

interface NewTopicPrefillResult {
  name: string;
  questions: { text: string; model_answer: string }[];
}

export async function newTopicPrefill(description: string): Promise<NewTopicPrefillResult> {
  return post<NewTopicPrefillResult>('/api/topics/prefill/', { description });
}

export async function getTopics(): Promise<Topic[]> {
  const data = await apiFetch<{ topics: Topic[] }>('/api/topics/');
  return data.topics;
}

export async function createTopic(
  name: string,
  description: string,
  questions: { text: string; model_answer: string }[],
): Promise<{ id: number; url: string }> {
  return post<{ id: number; url: string }>('/api/topics/', { name, description, questions });
}

export async function setTopicClosed(topicId: number, closed: boolean): Promise<{ closed_at: string | null }> {
  return post<{ closed_at: string | null }>(`/api/topics/${topicId}/close/`, { closed });
}

export async function getTopicByUrlSuffix(
  urlSuffix: string,
): Promise<{ topic: Topic; questions: Question[] }> {
  return apiFetch(`/api/topics/${urlSuffix}/`);
}

// ── Outreaches ────────────────────────────────────────────────────────────────

export async function getOutreaches(): Promise<OutreachSummary[]> {
  const data = await apiFetch<{ outreaches: OutreachSummary[] }>('/api/outreaches/');
  return data.outreaches;
}

export async function getOutreach(id: number): Promise<OutreachDetail> {
  return apiFetch<OutreachDetail>(`/api/outreaches/${id}/`);
}

export async function recordView(id: number): Promise<void> {
  await post(`/api/outreaches/${id}/view/`, {});
}

export async function setFeedback(id: number, value: boolean | null): Promise<boolean | null> {
  const data = await post<{ feedback: boolean | null }>(`/api/outreaches/${id}/feedback/`, { value });
  return data.feedback;
}

export async function createOutreach(payload: {
  topic_id: number;
  first_name: string;
  last_name: string;
  email: string;
  linkedin_url: string;
  responses: Record<number, string>;
}): Promise<{ id: number }> {
  return post<{ id: number }>('/api/outreaches/', payload);
}

export async function finalizeOutreach(outreachId: number): Promise<void> {
  await post(`/api/outreaches/${outreachId}/finalize/`, {});
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
  is_onboarded: boolean;
  topic_count: number;
  outreach_count: number;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const data = await apiFetch<{ users: AdminUser[] }>('/api/admin/users/');
  return data.users;
}

export async function impersonate(userId: number): Promise<void> {
  await post(`/api/admin/impersonate/${userId}/`, {});
}

export async function stopImpersonating(): Promise<void> {
  await post('/api/admin/impersonate/stop/', {});
}

export async function setUserActive(userId: number, active: boolean): Promise<void> {
  await post(`/api/admin/users/${userId}/set-active/`, { active });
}

export async function setUserStaff(userId: number, staff: boolean): Promise<void> {
  await post(`/api/admin/users/${userId}/set-staff/`, { staff });
}

export async function forceLogout(userId: number): Promise<void> {
  await post(`/api/admin/users/${userId}/force-logout/`, {});
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function uploadAttachment(outreachId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  await apiFetch(`/api/outreaches/${outreachId}/attachments/`, {
    method: 'POST',
    body: formData,
  });
}
