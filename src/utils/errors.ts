export class ApiError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export class BadRequestError extends ApiError {
    constructor(message: string = 'Bad Request') {
        super(400, message);
        this.name = 'BadRequestError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message: string = 'Unauthorized') {
        super(401, message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message: string = 'Forbidden') {
        super(403, message);
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string = 'Not Found') {
        super(404, message);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends ApiError {
    constructor(message: string = 'Conflict') {
        super(409, message);
        this.name = 'ConflictError';
    }
}

export class InternalServerError extends ApiError {
    constructor(message: string = 'Internal Server Error') {
        super(500, message);
        this.name = 'InternalServerError';
    }
}
