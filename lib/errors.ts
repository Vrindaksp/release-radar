/** An error that maps directly onto an HTTP response. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** A required environment variable / integration is missing (HTTP 503). */
export class ConfigError extends HttpError {
  constructor(message: string) {
    super(503, message);
    this.name = "ConfigError";
  }
}

/** The upstream Gemini API failed after retries. */
export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

/** The upstream GitHub API failed. `status` is the upstream HTTP status. */
export class GitHubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}
