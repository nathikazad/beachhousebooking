import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

export interface JwtPayload {
    email: string;
    sub: string;
}


// Function to verify JWT
export const verifyToken = (token: string): JwtPayload | string => {
  try {
    // The jwt.verify method throws an error if the token cannot be verified
    const jwt_secret: string = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, jwt_secret)
    return decoded as JwtPayload;
  } catch (error) {
    console.error("Invalid token", error);
    return "Invalid token";
  }
}


export const decodeJWT = (token: string): string => {
  const base64String = token.split('.')[1]; // Get the payload part of the JWT
  const decodedValue = Buffer.from(base64String, 'base64').toString('utf8');
  return decodedValue;
};

export async function query(text: string, params?: any[]): Promise<any> {
  // Create a new client instance
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // Your Supabase connection string
  });

  try {
    // Connect to the database
    await client.connect();

    // Execute the query
    const { rows } = await client.query(text, params);
    return rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;  // Rethrow or handle error appropriately
  } finally {
    // Always close the client, regardless of query success or failure
    await client.end();
  }
}

export interface QueryExecutor {
  query: (
    text: string,
    params?: any[]
  ) => Promise<{ rows: any[] }>;
}

export async function withTransaction<T>(
  callback: (client: QueryExecutor) => Promise<T>
): Promise<T> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export function removeSpacesAndCapitalize(str:string) {
  return decodeURIComponent(str)
      .split(' ') // Split the string into an array of words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
      .join(''); // Join the words back into a single string without spaces
}
