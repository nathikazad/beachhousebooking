import * as jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';

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

export interface QueryExecutor {
  query: (
    text: string,
    params?: any[]
  ) => Promise<{ rows: any[] }>;
}

declare global {
  // eslint-disable-next-line no-var
  var beachhouseDatabasePool: Pool | undefined;
}

function getDatabasePool(): Pool {
  if (!global.beachhouseDatabasePool) {
    global.beachhouseDatabasePool = new Pool({
      connectionString:
        process.env.DATABASE_POOLER_URL ?? process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 3),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
  }

  return global.beachhouseDatabasePool;
}

export async function query(
  text: string,
  params?: any[],
  executor: QueryExecutor = getDatabasePool()
): Promise<any[]> {
  try {
    const { rows } = await executor.query(text, params);
    return rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

export async function withDatabaseClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDatabasePool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  callback: (client: QueryExecutor) => Promise<T>,
  executor?: QueryExecutor
): Promise<T> {
  if (executor) {
    return runTransaction(executor, callback);
  }

  return withDatabaseClient((client) => runTransaction(client, callback));
}

async function runTransaction<T>(
  client: QueryExecutor,
  callback: (client: QueryExecutor) => Promise<T>
): Promise<T> {
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export function removeSpacesAndCapitalize(str:string) {
  return decodeURIComponent(str)
      .split(' ') // Split the string into an array of words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
      .join(''); // Join the words back into a single string without spaces
}
