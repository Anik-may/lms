const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const isBrowser = () => typeof window !== "undefined";
export const getToken = () => (isBrowser() ? localStorage.getItem("access_token") : null);
export const setTokens = (a: string, r: string) => {
  localStorage.setItem("access_token", a);
  localStorage.setItem("refresh_token", r);
};
export const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
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
  setTokens(t.access_token, t.refresh_token);
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
export const send = <T,>(method: string, p: string, json?: unknown) => api<T>(p, { method, json: json ?? {} });

export type Course = {
  id: string; title: string; slug: string; status: string; subtitle: string | null;
  enrollment_count: number; rating_average: number; rating_count: number; level: string;
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
export type Review = { id: string; course_title: string; reviewer_name: string; rating: number; body: string | null; created_at: string };
export type Reviews = { average_rating: number | null; review_count: number; distribution: Record<string, number>; reviews: Review[] };
export type Question = {
  thread_id: string; course_title: string; title: string; status: string; is_pinned: boolean;
  asker_name: string; reply_count: number; answered: boolean; created_at: string;
};
export type Post = { id: string; author_name: string; body: string; is_instructor_answer: boolean; created_at: string };
export type ThreadDetail = { thread: Question; posts: Post[] };
export type Submission = {
  id: string; content_title: string; student_name: string; attempt_number: number;
  text_submission: string | null; external_url: string | null; status: string; submitted_at: string;
  grade: { score: number; feedback: string | null } | null;
};
export type Analytics = {
  enrollment_count: number; active_enrollment_count: number; completed_count: number; completion_rate: number;
  average_progress: number; average_rating: number | null; review_count: number; total_earned: number;
  sales_count: number; currency_code: string;
};
export type Student = { user_id: string; display_name: string; status: string; enrolled_at: string; completion_percentage: number };
export type Instructor = { user_id: string; display_name: string; role: string };
export type Profile = { professional_title: string | null; biography: string | null; expertise_summary: string | null; status: string; verification_status: string };
export type Account = {
  id: string; email: string; display_name: string; status: string; roles: string[];
  first_name: string | null; last_name: string | null; bio: string | null; headline: string | null;
  country_code: string | null; timezone: string | null; website_url: string | null; language: string | null;
  facebook_url: string | null; instagram_url: string | null; linkedin_url: string | null;
  tiktok_url: string | null; twitter_url: string | null; youtube_url: string | null;
};
