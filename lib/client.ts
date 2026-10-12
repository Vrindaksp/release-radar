import type {
  AlertsView,
  DigestResponse,
  FeedbackInput,
  IngestReport,
  Release,
  Repository,
  Tier,
  TriageColumn,
} from "./types";

/** Browser-side wrappers around the JSON API routes. */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Network error — could not reach the server.");
  }
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? `Request failed (HTTP ${response.status}).`);
  }
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchDigest = () => request<DigestResponse>("/api/releases");

export const fetchRepositories = () =>
  request<{ repositories: Repository[] }>("/api/repos").then((data) => data.repositories);

export const addRepository = (input: { repoName: string; category: string; tier: Tier }) =>
  request<{ repository: Repository }>("/api/repos", send("POST", input)).then((data) => data.repository);

export const patchRepository = (id: number, patch: { category?: string; tier?: Tier; isActive?: boolean }) =>
  request<{ repository: Repository }>(`/api/repos/${id}`, send("PATCH", patch)).then((data) => data.repository);

export const removeRepository = (id: number) => request<{ ok: true }>(`/api/repos/${id}`, send("DELETE"));

export const moveRelease = (id: number, triageColumn: TriageColumn) =>
  request<{ release: Release }>(`/api/releases/${id}`, send("PATCH", { triageColumn })).then((data) => data.release);

/** The original GitHub release notes for one card (fetched on demand, not part of the digest). */
export const fetchReleaseNotes = (id: number) =>
  request<{ notes: string | null; truncated: boolean }>(`/api/releases/${id}/notes`);

export const runSync = (repositoryId?: number) => request<IngestReport>("/api/ingest", send("POST", { repositoryId }));

/** One batch of a history backfill; call repeatedly until `remaining` hits 0. */
export const runBackfill = (days: number) =>
  request<IngestReport>("/api/ingest", send("POST", { days, backfill: true }));

export const submitFeedback = (input: FeedbackInput) =>
  request<{ release: Release }>("/api/feedback", send("POST", input)).then((data) => data.release);

export const loadSampleData = () =>
  request<{ repositories: number; releases: number }>("/api/seed", send("POST"));

export const clearSampleData = () => request<{ removed: number }>("/api/seed", send("DELETE"));

// ---- Alerts panel ----------------------------------------------------------------

export const fetchAlerts = () => request<AlertsView>("/api/alerts");

/** Change email alert settings: switch on/off, add a recipient, or remove one by its opaque id. */
export const updateAlerts = (change: { enabled?: boolean; addRecipient?: string; removeRecipient?: string }) =>
  request<AlertsView>("/api/alerts", send("PUT", change));

export const sendTestEmail = () => request<{ sent: number; lastTestAt: string }>("/api/alerts/test", send("POST"));
