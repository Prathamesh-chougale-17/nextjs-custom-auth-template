import 'server-only';
import clientPromise from '@/mongo/clientpromise';
import { verifySession } from './02-stateless-session'; // or './02-database-session' if using database sessions
import { User } from '@/mongo/mongodb-schema';
import { ObjectId } from 'mongodb';
import { cache } from 'react';

async function getCollection(collectionName: string) {
  const client = await clientPromise;
  const db = client.db("auth");
  return db.collection(collectionName);
}

// export async function getUser(): Promise<User | null> {
//   const session = await verifySession();
//   if (!session) return null;

//   try {
//     const usersCollection = await getCollection('users');
//     const user = await usersCollection.findOne<User>({ _id: new ObjectId(session.userId as string) });
//     return user;
//   } catch (error) {
//     console.log('Failed to fetch user:', error);
//     return null;
//   }
// }

// export async function updateUser(userId: string, updateData: Partial<{ name: string, email: string }>): Promise<boolean> {
//   try {
//     const usersCollection = await getCollection('users');
//     const result = await usersCollection.updateOne(
//       { _id: new ObjectId(userId) },
//       { $set: updateData }
//     );

//     return result.modifiedCount > 0;
//   } catch (error) {
//     console.log('Failed to update user:', error);
//     return false;
//   }
// }

// Add more data access functions as needed

export const getUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;
  try{

    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ _id: new ObjectId(session.userId as string) });    
    return user;
  }catch(error){
    console.log('Failed to fetch user:', error);
    return null;
  }
  
  } 
);