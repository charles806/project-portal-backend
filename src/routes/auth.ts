import express, { Response, NextFunction } from 'express';
import prisma from '../config/database'; // Use shared client
import { hashPassword, verifyPassword, validatePassword, validateUsername } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';

const router = express.Router();

async function signupHandler(req: any, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, username } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new BadRequestError(passwordValidation.error);
    }

    if (username) {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        throw new BadRequestError(usernameValidation.error);
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          ...(username ? [{ username }] : [])
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestError(
        existingUser.email === email.toLowerCase()
          ? 'Email already registered'
          : 'Username already taken'
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        username,
      },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username || undefined,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      username: user.username || undefined,
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 45 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      needsUsername: !user.username,
    });
  } catch (error: any) {
    next(error); // Pass to errorHandler
  }
}

router.post('/signup', signupHandler);
router.post('/register', signupHandler);


router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      throw new BadRequestError('Email/username and password are required');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username || undefined,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      username: user.username || undefined,
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 45 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/'
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const payload = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const accessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    next(new UnauthorizedError('Invalid refresh token'));
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        oauthProvider: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.patch('/username', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    if (!username) {
      throw new BadRequestError('Username is required');
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      throw new BadRequestError(usernameValidation.error);
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser && existingUser.id !== req.user!.userId) {
      throw new ConflictError('Username already taken');
    }

    let passwordHash: string | undefined;
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        throw new BadRequestError(passwordValidation.error);
      }
      passwordHash = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        username,
        ...(passwordHash && { passwordHash }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;