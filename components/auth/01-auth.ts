'use server';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import clientPromise from '@/mongo/clientpromise';
import { createSession, deleteSession } from './02-stateless-session';
import { User, NewUser } from '@/mongo/mongodb-schema';

const SignupFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const LoginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
};

async function getCollection(collectionName: string) {
  const client = await clientPromise;
  const db = client.db("auth");
  return db.collection(collectionName);
}

export async function login(
  prevState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  const errorMessage = { message: 'Invalid login credentials.' };


  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;

  const usersCollection = await getCollection('users');
  const user = await usersCollection.findOne<User>({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return errorMessage;
  }
  await createSession(user._id.toHexString());

  return { message: 'Login successful' };
}

export async function signup(
  prevState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  const validatedFields = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = validatedFields.data;

  const usersCollection = await getCollection('users');
  const existingUser = await usersCollection.findOne<User>({ email });

  if (existingUser) {
    return {
      message: 'Email already exists, please use a different email or login.',
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser: NewUser = {
    name,
    email,
    password: hashedPassword,
  };
  
  const result = await usersCollection.insertOne(newUser);

  if (!result.insertedId) {
    return {
      message: 'An error occurred while creating your account.',
    };
  }

  await createSession(result.insertedId.toHexString());

  return { message: 'Account created successfully' };
}

export async function logout() {
  deleteSession();
  return { message: 'Logout successful' };
}