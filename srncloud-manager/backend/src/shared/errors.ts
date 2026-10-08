export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BrowserError extends AppError {
  constructor(message: string) {
    super(message, 'BROWSER_ERROR', 502);
  }
}

export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 503);
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = 'Session expired') {
    super(message, 'SESSION_EXPIRED', 401);
  }
}

export class ChallengeRequiredError extends AppError {
  constructor(message = 'Manual verification required') {
    super(message, 'CHALLENGE_REQUIRED', 449);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}
