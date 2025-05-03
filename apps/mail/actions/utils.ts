import { account, connection } from '@zero/db/schema';
import { createDriver } from '@/app/api/driver';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export const FatalErrors = ['invalid_grant'];

export const deleteActiveConnection = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (session?.connectionId) {
    try {
      console.log('Server: Successfully deleted connection, please reload');
      await auth.api.signOut({ headers: headersList });
      await db
        .delete(connection)
        .where(
          and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)),
        );
      return revalidatePath('/mail/inbox');
    } catch (error) {
      console.error('Server: Error deleting connection:', error);
      throw error;
    }
  } else {
    console.log('No connection ID found');
  }
};

export const getActiveDriver = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error('Invalid session');
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection) {
    throw new Error('Invalid connection');
  }

  if (!_connection.accessToken || !_connection.refreshToken) {
    throw new Error('Invalid connection');
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
      email: _connection.email,
    },
  });

  return driver;
};

export const getActiveConnection = async () => {
  const headersList = await headers();

  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) return null;
  if (!session.connectionId) return null;

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)))
    .orderBy(connection.createdAt)
    .limit(1);

  return _connection;
};

export function fromBase64Url(str: string) {
  return str.replace(/-/g, '+').replace(/_/g, '/');
}

export function fromBinary(str: string) {
  return decodeURIComponent(
    atob(str.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(''),
  );
}

export const findHtmlBody = (parts: any[]): string => {
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      console.log('✓ Driver: Found HTML content in message part');
      return part.body.data;
    }
    if (part.parts) {
      const found = findHtmlBody(part.parts);
      if (found) return found;
    }
  }
  console.log('⚠️ Driver: No HTML content found in message parts');
  return '';
};
