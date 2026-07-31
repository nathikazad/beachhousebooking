import {
  JwtPayload,
  query,
  QueryExecutor,
  verifyToken,
} from "@/utils/lib/helper";
import { NextApiRequest, NextApiResponse } from 'next';
// import { headers } from 'next/headers'

export function verifyAndGetPayload(request: NextApiRequest): JwtPayload {
  const header = request.headers.authorization;
  if (!header) {
    throw new Error('No authorization header');
  }

  const bearer = header.split(' ');
  const token = bearer[1];

  const verifiedToken = verifyToken(token);

  if (verifiedToken == "Invalid token") { 
    throw new Error('Invalid token');
  }
  return verifiedToken as JwtPayload;
}

export interface User {
  id: string;
  email?: string | undefined;
  displayName?: string | undefined;
}

export async function fetchUser(
  id: string,
  executor?: QueryExecutor
): Promise<User> {
  // id = "fd730c87-6eba-4b50-9ada-20ef5749a37b"
  const result = await query(
    'SELECT * FROM auth.users WHERE id = $1',
    [id],
    executor
  );
  // let metadata = result[0].raw_user_meta_data
  // metadata.display_name = "Rafica";
  // await query('UPDATE auth.users SET raw_user_meta_data = $1 WHERE id = $2', [metadata, id]);
  return {
    id: result[0].id,
    email: result[0].email,
    displayName: result[0].raw_user_meta_data.display_name
  };
}

export async function saveUser(): Promise<void> {
  let id = "ebd19bfb-043b-43fb-943e-e03d3b25db69"
  const result = await query('SELECT * FROM auth.users WHERE id = $1', [id]);
  let metadata = result[0].raw_user_meta_data
  metadata.display_name = "Tito";
  await query('UPDATE auth.users SET raw_user_meta_data = $1 WHERE id = $2', [metadata, id]);
}
