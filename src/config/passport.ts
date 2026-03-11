import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from '../lib/prisma';

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found in Google profile'));
                    }

                    // Check if user exists
                    let user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email },
                                { oauthProvider: 'google', oauthId: profile.id },
                            ],
                        },
                    });

                    if (!user) {
                        // Create new user
                        user = await prisma.user.create({
                            data: {
                                email,
                                firstName: profile.name?.givenName,
                                lastName: profile.name?.familyName,
                                oauthProvider: 'google',
                                oauthId: profile.id,
                                emailVerified: true, // Google emails are pre-verified
                            },
                        });
                    } else if (!user.oauthProvider) {
                        // Link existing email account to Google
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                oauthProvider: 'google',
                                oauthId: profile.id,
                                emailVerified: true,
                            },
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error);
                }
            }
        )
    );
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID as string,
                clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
                callbackURL: process.env.GITHUB_CALLBACK_URL as string,
                scope: ['user:email'],
            },
            async (accessToken: string, refreshToken: string, profile: any, done: any) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found in GitHub profile'));
                    }

                    let user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email },
                                { oauthProvider: 'github', oauthId: profile.id },
                            ],
                        },
                    });

                    if (!user) {
                        const nameParts = profile.displayName?.split(' ') || [];
                        user = await prisma.user.create({
                            data: {
                                email,
                                firstName: nameParts[0],
                                lastName: nameParts.slice(1).join(' '),
                                username: profile.username,
                                oauthProvider: 'github',
                                oauthId: profile.id,
                                emailVerified: true,
                            },
                        });
                    } else if (!user.oauthProvider) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                oauthProvider: 'github',
                                oauthId: profile.id,
                                emailVerified: true,
                            },
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error);
                }
            }
        )
    );
}

export default passport;
