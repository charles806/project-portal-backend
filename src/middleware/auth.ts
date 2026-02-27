import clerkClient from "@clerk/clerk-sdk-node";

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const session = await clerkClient.verifyToken(token);
    (req as any).userId = session.sub;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};