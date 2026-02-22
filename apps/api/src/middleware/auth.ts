import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      firebaseUid: string;
      email: string | null;
      displayName: string | null;
      role: 'user' | 'developer' | 'admin';
    };
  }
}

// Dev user ID — consistent UUID for development
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Dev mode: skip Firebase auth when no Firebase credentials configured
  if (
    process.env.NODE_ENV === 'development' &&
    !process.env.FIREBASE_PROJECT_ID?.startsWith('your-')
    ? !process.env.FIREBASE_PROJECT_ID
    : true
  ) {
    // Ensure dev user exists in database
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.firebaseUid, 'dev-user-123'))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.users).values({
        id: DEV_USER_ID,
        firebaseUid: 'dev-user-123',
        email: 'dev@urbanpulse.test',
        displayName: 'Dev User',
      });
    }

    request.user = {
      id: existing[0]?.id || DEV_USER_ID,
      firebaseUid: 'dev-user-123',
      email: 'dev@urbanpulse.test',
      displayName: 'Dev User',
      role: (existing[0] as any)?.role || 'user',
    };
    return;
  }

  // Production: verify Firebase token
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  try {
    const token = authHeader.slice(7);

    // Dynamic import firebase-admin to avoid issues when not configured
    const admin = await import('firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    // Find or create user
    let dbUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.firebaseUid, decoded.uid))
      .limit(1);

    if (dbUser.length === 0) {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          firebaseUid: decoded.uid,
          email: decoded.email || null,
          displayName: decoded.name || null,
          avatarUrl: decoded.picture || null,
        })
        .returning();
      dbUser = [newUser];
    }

    request.user = {
      id: dbUser[0].id,
      firebaseUid: decoded.uid,
      email: dbUser[0].email,
      displayName: dbUser[0].displayName,
      role: (dbUser[0] as any).role || 'user',
    };
  } catch (error) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}
