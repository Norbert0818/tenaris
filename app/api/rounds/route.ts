import { dailyVariants } from '@/lib/griff-daily';
import { createHash } from 'node:crypto';
import { database } from '@/lib/database';
import { isAdmin, validOrigin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (error: string, status = 400) =>
  Response.json(
    { error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );

const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    value
  );

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    const admin = isAdmin(req);

    if (!id) {
      if (!admin) {
        return fail(
          'Autentifică-te ca organizator pentru a gestiona comenzile.',
          401
        );
      }

      const rounds = await database(
        'rounds?select=id,title,currency,closed,created&order=created.desc'
      );

      return Response.json(
        { rounds },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    if (!uuid(id)) {
      return fail('Link de comandă nevalid.', 404);
    }

    const records = await database(
      'rounds?id=eq.' +
        id +
        '&select=id,title,currency,closed,products'
    );

    if (!records.length) {
      return fail('Comanda nu a fost găsită.', 404);
    }

    const orders = admin
      ? await database(
          'orders?round_id=eq.' +
            id +
            '&deleted=eq.false&select=id,name,items,total,created,revision&order=created.desc'
        )
      : [];

    return Response.json(
      {
        round: records[0],
        orders,
        isOwner: admin,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : 'Datele nu pot fi încărcate.',
      503
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!validOrigin(req)) {
      return fail('Cerere nevalidă.', 403);
    }

    const raw = await req.text();

    if (raw.length > 100000) {
      return fail('Cererea este prea mare.', 413);
    }

    const body = JSON.parse(raw);

    if (body.action === 'create') {
      if (!isAdmin(req)) {
        return fail(
          'Autentifică-te ca organizator.',
          401
        );
      }

      if (
        typeof body.title !== 'string' ||
        !body.title.trim() ||
        body.title.length > 100 ||
        !['RON', 'HUF', 'EUR'].includes(
          body.currency
        ) ||
        !Array.isArray(body.products) ||
        !body.products.length ||
        body.products.length > 100
      ) {
        return fail(
          'Introdu denumirea și între 1 și 100 de produse.'
        );
      }

      if (
        body.products.some(
          (product: any) =>
            typeof product.name !== 'string' ||
            !product.name.trim() ||
            product.name.length > 200 ||
            !Number.isInteger(product.price) ||
            product.price < 0 ||
            product.price > 10000000
        )
      ) {
        return fail(
          'Verifică produsele și prețurile.'
        );
      }

      if (
        body.products.some(
          (product: any) =>
            (product.section !== undefined &&
              (typeof product.section !== 'string' ||
                product.section.length > 80)) ||
            (product.category !== undefined &&
              (typeof product.category !== 'string' ||
                product.category.length > 80))
        )
      ) {
        return fail(
          'Categoria sau secțiunea produsului este nevalidă.'
        );
      }

      if (
        body.products.filter(
          (product: any) => product.dailyMenu
        ).length > 1 ||
        body.products.some(
          (product: any) =>
            product.dailyMenu &&
            body.currency !== 'RON'
        )
      ) {
        return fail(
          'Meniul zilei Griff poate fi adăugat o singură dată, în RON.'
        );
      }

      const expanded = body.products.flatMap(
        (product: any) =>
          product.dailyMenu
            ? dailyVariants()
            : [
                {
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  section: product.section,
                  category: product.category,
                },
              ]
      );

      const id = crypto.randomUUID();

      await database('rounds', {
        method: 'POST',

        body: JSON.stringify({
          id,
          title: body.title.trim(),
          currency: body.currency,

          products: expanded.map(
            (product: any) => ({
              id: crypto.randomUUID(),
              name: product.name.trim(),
              price: product.price,

              ...(product.dailyChoices
                ? {
                    dailyChoices:
                      product.dailyChoices,
                  }
                : {}),

              ...(typeof product.section ===
                'string' &&
              product.section.trim()
                ? {
                    section: product.section
                      .trim()
                      .slice(0, 80),
                  }
                : {}),

              ...(typeof product.category ===
                'string' &&
              product.category.trim()
                ? {
                    category: product.category
                      .trim()
                      .slice(0, 80),
                  }
                : {}),

              ...(typeof product.image ===
                'string' &&
              /^https:\/\/imagedelivery\.net\/C9mHCjLG8xvsJJ6bWQJL0w\/[a-f0-9-]+\/w=400,fit=scale-down,format=auto$/.test(
                product.image
              )
                ? {
                    image: product.image,
                  }
                : {}),
            })
          ),
        }),
      });

      return Response.json({ id });
    }

    if (!uuid(body.id)) {
      return fail('Link de comandă nevalid.');
    }

    if (body.action === 'toggle') {
      if (!isAdmin(req)) {
        return fail(
          'Doar organizatorul poate modifica această comandă.',
          403
        );
      }

      await database(
        'rounds?id=eq.' + body.id,
        {
          method: 'PATCH',
          body: JSON.stringify({
            closed: !!body.closed,
          }),
        }
      );

      return Response.json({ ok: true });
    }

    const supported = [
      'order',
      'view_order',
      'update_order',
      'delete_order',
    ];

    if (
      !supported.includes(body.action) ||
      !uuid(body.orderId)
    ) {
      return fail(
        'Operațiune sau identificator nevalid.'
      );
    }

    const admin = isAdmin(req);

    const tokenValid =
      typeof body.editToken === 'string' &&
      /^[a-f0-9]{64}$/.test(body.editToken);

    if (
      body.action === 'delete_order' &&
      !admin
    ) {
      return fail(
        'Doar organizatorul poate șterge comanda.',
        403
      );
    }

    if (
      (body.action === 'order' || !admin) &&
      !tokenValid
    ) {
      return fail(
        'Linkul de editare lipsește sau nu este valid.',
        403
      );
    }

    if (
      ['update_order', 'delete_order'].includes(
        body.action
      ) &&
      (!Number.isInteger(body.revision) ||
        body.revision < 0)
    ) {
      return fail(
        'Reîncarcă această comandă înainte de modificare.'
      );
    }

    if (
      ['order', 'update_order'].includes(
        body.action
      )
    ) {
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.length > 80 ||
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > 100
      ) {
        return fail(
          'Introdu numele tău și alege cel puțin un produs.'
        );
      }

      if (
        body.items.some(
          (item: any) =>
            !uuid(item.id) ||
            !Number.isInteger(item.qty) ||
            item.qty < 1 ||
            item.qty > 999
        ) ||
        new Set(
          body.items.map((item: any) => item.id)
        ).size !== body.items.length
      ) {
        return fail(
          'Cantitatea trebuie să fie un număr întreg între 1 și 999.'
        );
      }
    }

    const order = await database(
      'rpc/order_operation',
      {
        method: 'POST',

        body: JSON.stringify({
          p_round_id: body.id,
          p_order_id: body.orderId,
          p_action: body.action,
          p_name: body.name || null,
          p_items: body.items || null,

          p_edit_hash: tokenValid
            ? createHash('sha256')
                .update(body.editToken)
                .digest('hex')
            : null,

          p_admin: admin,
          p_revision: body.revision ?? null,
        }),
      }
    );

    return Response.json(
      {
        ok: true,
        total: order.total,
        order,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : 'Salvarea a eșuat. Încearcă din nou.',
      503
    );
  }
}