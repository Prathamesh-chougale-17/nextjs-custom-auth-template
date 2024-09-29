import { ObjectId } from 'mongodb';

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
}

export interface Session {
  _id: ObjectId;
  userId: ObjectId;
  expiresAt: Date;
}

export type NewUser = Omit<User, '_id'>;
export type NewSession = Omit<Session, '_id'>;