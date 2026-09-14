// app/api/auth/route.ts

import {
  equal,
  sessionCookie,
  validOrigin,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(
  data: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function POST(req: Request) {
  try {
    console.log('AUTH ENV CHECK', {
      cwd: process.cwd(),
      adminPasswordExists:
        typeof process.env.ADMIN_PASSWORD === 'string',
      adminPasswordLength:
        process.env.ADMIN_PASSWORD?.length ?? 0,
      sessionSecretExists:
        typeof process.env.SESSION_SECRET === 'string',
      sessionSecretLength:
        process.env.SESSION_SECRET?.length ?? 0,
      nodeEnv: process.env.NODE_ENV,
    });

    if (!validOrigin(req)) {
      return json(
        { error: 'Cerere nevalidă.' },
        403
      );
    }

    const expected = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!expected) {
      console.error(
        'AUTH ERROR: ADMIN_PASSWORD lipsește din environment.'
      );

      return json(
        {
          error:
            'ADMIN_PASSWORD lipsește din .env.local.',
        },
        503
      );
    }

    if (expected.length < 12) {
      console.error(
        'AUTH ERROR: ADMIN_PASSWORD are doar',
        expected.length,
        'caractere.'
      );

      return json(
        {
          error:
            'ADMIN_PASSWORD trebuie să aibă minimum 12 caractere.',
        },
        503
      );
    }

    if (!sessionSecret) {
      console.error(
        'AUTH ERROR: SESSION_SECRET lipsește din environment.'
      );

      return json(
        {
          error:
            'SESSION_SECRET lipsește din .env.local.',
        },
        503
      );
    }

    if (sessionSecret.length < 32) {
      console.error(
        'AUTH ERROR: SESSION_SECRET are doar',
        sessionSecret.length,
        'caractere.'
      );

      return json(
        {
          error:
            'SESSION_SECRET trebuie să aibă minimum 32 de caractere.',
        },
        503
      );
    }

    let data: unknown;

    try {
      data = await req.json();
    } catch {
      return json(
        { error: 'Cerere nevalidă.' },
        400
      );
    }

    if (
      !data ||
      typeof data !== 'object' ||
      !('password' in data) ||
      typeof (data as { password?: unknown }).password !==
        'string'
    ) {
      return json(
        { error: 'Parola lipsește.' },
        400
      );
    }

    const password = (
      data as { password: string }
    ).password;

    if (!equal(password, expected)) {
      return json(
        { error: 'Parolă incorectă.' },
        401
      );
    }

    return json(
      { ok: true },
      200,
      {
        'Set-Cookie': sessionCookie(),
      }
    );
  } catch (error) {
    console.error('Admin login failed:', error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Autentificarea nu este disponibilă.',
      },
      503
    );
  }
}

export async function DELETE(req: Request) {
  if (!validOrigin(req)) {
    return json(
      { error: 'Cerere nevalidă.' },
      403
    );
  }

  return json(
    { ok: true },
    200,
    {
      'Set-Cookie':
        'comanda_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    }
  ); 
}