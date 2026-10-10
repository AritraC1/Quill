// Base class for all custom application errors
export class AppError extends Error {
  // HTTP status code associated with the error
  public readonly statusCode: number;

  // Indicates whether the error is an expected operational error
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error for invalid requests (HTTP 400)
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

// Error for unauthenticated requests (HTTP 401)
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

// Error for requests where the user lacks the required permissions (HTTP 403)
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

// Error for resources that cannot be found (HTTP 404)
export class NotFoundError extends AppError {
  constructor(message: string = "Resource Not Found") {
    super(message, 404);
  }
}

// Error for conflicts, such as attempting to create a duplicate resource (HTTP 409)
export class ConflictError extends AppError {
  constructor(message: string = "Conflict: Resource already exists") {
    super(message, 409);
  }
}

// Error for unexpected server-side failures (HTTP 500)
export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
  }
}
