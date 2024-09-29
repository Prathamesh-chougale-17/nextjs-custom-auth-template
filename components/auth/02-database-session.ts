import 'server-only';
import { ObjectId } from 'mongodb';
import clientPromise from '@/mongo/clientpromise';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { Session, NewSession } from '@/mongo/mongodb-schema';

const secretKey = process.env.SECRET;
const key = new TextEncoder().encode(secretKey);

async function getCollection(collectionName: string) {
  const client = await clientPromise;
  const db = client.db();
  return db.collection(collectionName);
}

type SessionPayload = {
  sessionId: string;
  userId: string;
  expiresAt: number;
};

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessionsCollection = await getCollection('sessions');
  const newSession: NewSession = {
    userId: new ObjectId(userId),
    expiresAt,
  };
  const result = await sessionsCollection.insertOne(newSession);

  const session = await encrypt({ 
    sessionId: result.insertedId.toHexString(),
    userId, 
    expiresAt: expiresAt.getTime()
  });

  cookies().set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const session = cookies().get('session')?.value;
  if (!session) return null;

  try {
    const payload = await decrypt(session);
    if (!payload) return null;

    const sessionsCollection = await getCollection('sessions');
    const dbSession = await sessionsCollection.findOne<Session>({ 
      _id: new ObjectId(payload.sessionId)
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return null;
    }

    return payload;
  } catch (error) {
    console.log('Failed to get session:', error);
    return null;
  }
}

export async function updateSession(sessionId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const sessionsCollection = await getCollection('sessions');
  await sessionsCollection.updateOne(
    { _id: new ObjectId(sessionId) },
    { $set: { expiresAt } }
  );

  const session = cookies().get('session')?.value;
  if (session) {
    const payload = await decrypt(session);
    if (payload) {
      const updatedSession = await encrypt({ ...payload, expiresAt: expiresAt.getTime() });
      cookies().set('session', updatedSession, {
        httpOnly: true,
        secure: true,
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });
    }
  }
}

export async function deleteSession() {
  const session = await getSession();
  if (session) {
    const sessionsCollection = await getCollection('sessions');
    await sessionsCollection.deleteOne({ _id: new ObjectId(session.sessionId) });
  }
  cookies().delete('session');
}

async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

async function decrypt(session: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    console.log('Failed to decrypt session:', error);
    return null;
  }
}