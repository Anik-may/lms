const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const isBrowser = () => typeof window !== "undefined";
export const getToken = () => (isBrowser() ? localStorage.getItem("access_token") : null);
// Fired on sign-in/out so components showing who is signed in (e.g. the navbar) refresh.
export const AUTH_EVENT = "auth-change";
const notify = () => window.dispatchEvent(new Event(AUTH_EVENT));
export const setTokens = (a: string, r: string) => {
  localStorage.setItem("access_token", a);
  localStorage.setItem("refresh_token", r);
  notify();
};
export const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  notify();
};

async function refresh(): Promise<boolean> {
  const rt = localStorage.getItem("refresh_token");
  if (!rt) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) return false;
  const t = await res.json();
  // Same user, new tokens: store quietly rather than announcing a sign-in.
  localStorage.setItem("access_token", t.access_token);
  localStorage.setItem("refresh_token", t.refresh_token);
  return true;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && (await refresh())) return api<T>(path, init, false);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const b = await res.json();
      msg = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const get = <T,>(p: string) => api<T>(p);

/** API origin, for the API's own relative links (e.g. signed media URLs "/api/v1/media/..."). */
export const API_ORIGIN = BASE.replace(/\/api\/v1\/?$/, "");
export const mediaUrl = (path: string) => (/^https?:/.test(path) ? path : `${API_ORIGIN}${path}`);

/** Multipart upload with progress (fetch can't report upload progress). */
export function upload<T>(path: string, file: File, onProgress?: (pct: number) => void, retry = true): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(0, "Upload failed. Check your connection and try again."));
    xhr.onload = async () => {
      if (xhr.status === 401 && retry && (await refresh())) return resolve(upload<T>(path, file, onProgress, false));
      let body: { detail?: unknown } | null = null;
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
      const d = body?.detail;
      reject(new ApiError(xhr.status, xhr.status === 413 ? "That file is too large." : typeof d === "string" ? d : d ? JSON.stringify(d) : xhr.statusText));
    };
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}
export const send = <T,>(method: string, p: string, json?: unknown) => api<T>(p, { method, json: json ?? {} });

export type Course = {
  id: string; title: string; slug: string; status: string; subtitle: string | null; owner_user_id?: string;
  language_code?: string; visibility?: string; thumbnail_media_id?: string | null;
  enrollment_count: number; rating_average: number; rating_count: number; level: string;
  description?: string | null; price?: number | null; list_price?: number | null; currency_code?: string | null;
  instructor_name?: string | null; thumbnail_url?: string | null; published_at?: string | null; created_at?: string;
};
export type Overview = {
  course_count: number; published_course_count: number; student_count: number;
  enrollment_count: number; pending_submission_count: number; total_earned: number; currency_code: string;
};
export type Earnings = {
  currency_code: string; total_earned: number; total_paid_out: number; pending_payout: number;
  balance: number; available_balance: number;
  courses: { course_id: string; title: string; sales_count: number; amount: number }[];
};
export type Payout = { id: string; amount: number; currency_code: string; status: string; provider: string; requested_at: string };
export type Review = {
  id: string; course_title: string; reviewer_name: string; rating: number; body: string | null; created_at: string;
  instructor_reply: string | null; instructor_reply_at: string | null;
};
export type Reviews = { average_rating: number | null; review_count: number; distribution: Record<string, number>; reviews: Review[] };
export type Question = {
  thread_id: string; course_title: string; title: string; status: string; is_pinned: boolean;
  asker_name: string; reply_count: number; answered: boolean; created_at: string;
};
export type Post = { id: string; author_name: string; body: string; is_instructor_answer: boolean; created_at: string };
export type ThreadDetail = { thread: Question; posts: Post[] };
export type Submission = {
  id: string; course_id: string; content_id: string; content_title: string; student_name: string; attempt_number: number;
  text_submission: string | null; external_url: string | null; status: string; submitted_at: string;
  grade: { score: number; feedback: string | null } | null;
};
export type Analytics = {
  enrollment_count: number; active_enrollment_count: number; completed_count: number; completion_rate: number;
  average_progress: number; average_rating: number | null; review_count: number; total_earned: number;
  sales_count: number; currency_code: string;
};
export type Student = {
  user_id: string; display_name: string; email: string | null; status: string; source: string; enrolled_at: string;
  completion_percentage: number; completed_at: string | null; last_accessed_at: string | null;
};
export type Instructor = { user_id: string; display_name: string; role: string };
export type Profile = { professional_title: string | null; biography: string | null; expertise_summary: string | null; status: string };
export type Account = {
  id: string; email: string; display_name: string; status: string; roles: string[];
  first_name: string | null; last_name: string | null; bio: string | null; headline: string | null;
  country_code: string | null; timezone: string | null; website_url: string | null; language: string | null;
  facebook_url: string | null; instagram_url: string | null; linkedin_url: string | null;
  tiktok_url: string | null; twitter_url: string | null; youtube_url: string | null;
};

// --- Learner (my account) ---
export type Learning = {
  course: Course; enrollment_status: string; enrolled_at: string; completion_percentage: number;
  completed_content_count: number; total_required_content_count: number;
  last_accessed_at: string | null; completed_at: string | null;
};
export type Certificate = {
  id: string; certificate_number: string; verification_code: string; course_id: string;
  course_title: string; holder_name: string; issued_at: string; revoked: boolean;
};
export type MyOrder = {
  id: string; order_number: string; currency_code: string; subtotal: number; discount_total: number;
  tax_total: number; grand_total: number; status: string; created_at: string; items: { id: string; course_id: string }[];
  payments?: Payment[];
};
export type Payment = {
  id: string; order_id: string; provider: string; provider_payment_id: string; amount: number; currency_code: string;
  status: "CAPTURED" | "FAILED" | string; captured_at: string | null; failure_code: string | null;
  card_brand: string | null; card_last4: string | null;
};
export const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" };

// --- Invitations ---
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
export type Invitation = {
  id: string; email: string; display_name: string | null; role_code: string; status: InvitationStatus;
  invited_by_name: string | null; created_at: string; expires_at: string; accepted_at: string | null;
};
export type InvitationSent = { invitation: Invitation; invite_url: string; email_sent: boolean };
export type InvitationPublic = {
  email: string; display_name: string | null; role_name: string; invited_by_name: string | null;
  status: InvitationStatus; expires_at: string;
};

// --- Admin dashboard ---
export type AdminUser = { id: string; email: string; display_name: string; status: string; created_at: string; roles: string[] };
export type Role = { code: string; name: string; description: string | null; permissions: string[] };
export type AdminStats = {
  users_total: number; users_suspended: number; users_by_role: Record<string, number>;
  courses_by_status: Record<string, number>; enrollments_total: number; orders_paid: number;
  revenue: number; currency_code: string; open_review_reports: number;
};
export type AdminCourse = {
  id: string; title: string; slug: string; status: string; owner_name: string; owner_email: string;
  enrollment_count: number; created_at: string; published_at: string | null;
};
export type AdminOrder = {
  id: string; order_number: string; user_name: string; user_email: string; grand_total: number;
  currency_code: string; status: string; item_count: number; created_at: string;
};
export type ReviewReport = {
  id: string; review_id: string; review_body: string | null; review_rating: number; review_status: string;
  reported_by_name: string; reason: string; status: string; created_at: string;
};
export type Category = { id: string; parent_id: string | null; name: string; slug: string; description: string | null; display_order: number };

// --- Lesson authoring ---
export type MediaAsset = { id: string; original_filename: string | null; mime_type: string | null; size_bytes: number | null; created_at: string; url: string | null };
export type QuestionType = "SINGLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type QuizQuestion = {
  id: string; question_type: QuestionType; position: number; points: number; question_text: string;
  options: { id: string; option_text: string; position: number; is_correct: boolean | null }[];
  explanation: string | null; accepted_answers: string[] | null;
};
export type Quiz = {
  time_limit_seconds: number | null; pass_percentage: number; attempt_limit: number | null;
  randomize_questions: boolean; randomize_options: boolean; questions: QuizQuestion[];
};
export type QuizAttempt = {
  id: string; user_id: string; attempt_number: number; status: string; submitted_at: string | null;
  score: number | null; percentage: number | null; passed: boolean | null; student_name: string | null;
};
export type LessonDetail = {
  id: string; section_id: string; title: string; content_type: string; position: number; is_preview: boolean;
  is_required: boolean; status: string; estimated_duration_seconds: number | null;
  article: { body: string; body_format: string; version_number: number } | null;
  video: { media_asset_id: string; duration_seconds: number | null; mime_type: string | null; url: string } | null;
  resource: { media_asset_id: string; filename: string | null; mime_type: string | null; size_bytes: number | null; downloadable: boolean; url: string } | null;
  quiz: Quiz | null;
  assignment: { instructions: string; due_days: number | null; allow_resubmission: boolean } | null;
};
