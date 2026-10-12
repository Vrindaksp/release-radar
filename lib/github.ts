import { GitHubError } from "./errors";

const API = "https://api.github.com";

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
}

export interface GitHubRepoMeta {
  fullName: string; // canonical casing, e.g. "Stripe/stripe-python"
  description: string | null;
  htmlUrl: string;
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Accepts "owner/repo", "github.com/owner/repo", or a full GitHub URL
 * (including trailing slashes, ".git", and deep links like /releases) and
 * returns "owner/repo" — or null if it isn't recognisable.
 */
export function parseRepoName(input: string): string | null {
  let value = input.trim();
  value = value.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "");
  value = value.split(/[?#]/)[0].replace(/\/+$/, "");
  const [owner, repo] = value.split("/");
  if (!owner || !repo) return null;
  const candidate = `${owner}/${repo.replace(/\.git$/i, "")}`;
  return REPO_PATTERN.test(candidate) ? candidate : null;
}

async function githubFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "open-source-release-radar",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new GitHubError(0, `Could not reach GitHub: ${(error as Error).message}`);
  }
  if (response.ok) return response;

  if (response.status === 404) {
    throw new GitHubError(404, "Repository not found (or not visible to the configured GITHUB_TOKEN).");
  }
  if (response.status === 401) {
    throw new GitHubError(401, "GitHub rejected the token. Check GITHUB_TOKEN.");
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || response.status === 429) {
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const when = reset ? ` Resets at ${new Date(reset * 1000).toISOString()}.` : "";
      const hint = process.env.GITHUB_TOKEN ? "" : " Set GITHUB_TOKEN to raise the limit.";
      throw new GitHubError(429, `GitHub API rate limit exceeded.${when}${hint}`);
    }
    throw new GitHubError(403, "GitHub denied access to this repository.");
  }
  throw new GitHubError(response.status, `GitHub API error (HTTP ${response.status}).`);
}

/** Looks up a repository, returning its canonical name. Used to validate on add. */
export async function fetchRepoMeta(repoName: string): Promise<GitHubRepoMeta> {
  const response = await githubFetch(`/repos/${repoName}`);
  const data = (await response.json()) as {
    full_name: string;
    description: string | null;
    html_url: string;
  };
  return { fullName: data.full_name, description: data.description, htmlUrl: data.html_url };
}

/** The most recent published releases (GitHub returns them newest first). */
export async function fetchReleases(repoName: string, perPage = 20): Promise<GitHubRelease[]> {
  const response = await githubFetch(`/repos/${repoName}/releases?per_page=${perPage}`);
  return (await response.json()) as GitHubRelease[];
}
