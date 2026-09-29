import {
  customDailyVariants,
  dailyVariants,
} from '@/lib/griff-daily';
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
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

const ownerToken = (req: Request) =>
  req.headers.get('x-owner-token')?.trim() || '';

const hashOwnerToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const sameHex = (left: string, right: string) => {
  if (
    !/^[a-f0-9]{64}$/i.test(left) ||
    !/^[a-f0-9]{64}$/i.test(right)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(left, 'hex'),
    Buffer.from(right, 'hex')
  );
};

const hasOwnerAccess = (
  req: Request,
  expectedHash: unknown
) => {
  const token = ownerToken(req);

  if (
    !/^[a-f0-9]{64}$/i.test(token) ||
    typeof expectedHash !== 'string'
  ) {
    return false;
  }

  return sameHex(
    hashOwnerToken(token),
    expectedHash
  );
};

async function canManageRound(
  req: Request,
  id: string,
  admin = isAdmin(req)
) {
  if (admin) {
    return true;
  }

  const records = await database(
    'rounds?id=eq.' +
      id +
      '&select=owner_token_hash'
  );

  return (
    Array.isArray(records) &&
    records.length > 0 &&
    hasOwnerAccess(
      req,
      records[0]?.owner_token_hash
    )
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const checkOnly =
      url.searchParams.get('check') === '1';
    const admin = isAdmin(req);

    if (!id) {
      const rounds = admin
        ? await database(
            'rounds?select=id,title,currency,closed,created,organizer_name&order=created.desc'
          )
        : [];

      return Response.json(
        {
          rounds,
          isAdmin: admin,
        },
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

    if (checkOnly) {
      const records = await database(
        'rounds?id=eq.' +
          id +
          '&select=id,title,currency,created,organizer_name,owner_token_hash'
      );

      if (!records.length) {
        return fail(
          'Comanda nu a fost găsită.',
          404
        );
      }

      const record = records[0];

      const creator = hasOwnerAccess(
        req,
        record.owner_token_hash
      );

      if (!admin && !creator) {
        return fail(
          'Nu mai ai acces de organizator la această comandă.',
          403
        );
      }

      return Response.json(
        {
          exists: true,
          isAdmin: admin,
          isOwner: admin || creator,
          round: {
            id: record.id,
            title: record.title,
            currency: record.currency,
            created: record.created,
            organizer_name:
              record.organizer_name,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const records = await database(
      'rounds?id=eq.' +
        id +
        '&select=id,title,currency,closed,products,payment_recipient,payment_link,organizer_name,owner_token_hash'
    );

    if (!records.length) {
      return fail('Comanda nu a fost găsită.', 404);
    }

    const record = records[0];

    const creator =
      hasOwnerAccess(
        req,
        record.owner_token_hash
      );

    const canManage = admin || creator;

    const orders = canManage
      ? await database(
          'orders?round_id=eq.' +
            id +
            '&deleted=eq.false&select=id,name,items,total,created,revision,paid&order=created.desc'
        )
      : [];

    const {
      owner_token_hash: _ownerTokenHash,
      ...publicRound
    } = record;

    return Response.json(
      {
        round: publicRound,
        orders,
        isOwner: canManage,
        isAdmin: admin,
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
      const organizerName =
        typeof body.organizerName === 'string'
          ? body.organizerName.trim()
          : '';

      if (
        !organizerName ||
        organizerName.length > 80
      ) {
        return fail(
          'Completează numele organizatorului (maximum 80 de caractere).'
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

      const paymentRecipient =
        typeof body.paymentRecipient === 'string'
          ? body.paymentRecipient.trim()
          : '';

      const paymentLink =
        typeof body.paymentLink === 'string'
          ? body.paymentLink.trim()
          : '';

      if (
        (paymentRecipient && !paymentLink) ||
        (!paymentRecipient && paymentLink)
      ) {
        return fail(
          'Completează atât numele beneficiarului, cât și linkul Revolut.'
        );
      }

      if (
        paymentRecipient.length > 80 ||
        paymentLink.length > 500
      ) {
        return fail(
          'Datele pentru plată sunt prea lungi.'
        );
      }

      if (paymentLink) {
        let paymentUrl: URL;

        try {
          paymentUrl = new URL(paymentLink);
        } catch {
          return fail(
            'Linkul Revolut nu este valid.'
          );
        }

        const hostname =
          paymentUrl.hostname.toLowerCase();

        if (
          paymentUrl.protocol !== 'https:' ||
          !(
            hostname === 'revolut.me' ||
            hostname.endsWith('.revolut.me')
          )
        ) {
          return fail(
            'Folosește un link Revolut.me valid, de forma https://revolut.me/nume.'
          );
        }
      }

      const customDailyMenus =
        body.products.filter(
          (product: any) =>
            product.customDailyMenu
        );

      if (customDailyMenus.length > 1) {
        return fail(
          'Poți configura un singur Meniu al zilei personalizat.'
        );
      }

      if (
        customDailyMenus.some(
          (product: any) => {
            const menu =
              product.customDailyMenu;

            const validPrice = (
              value: unknown
            ): value is number =>
              typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= 10000000;

            const validOptions = (
              value: unknown,
              required: boolean
            ) =>
              Array.isArray(value) &&
              value.length <= 8 &&
              (!required ||
                value.length >= 1) &&
              value.every(
                (option: unknown) =>
                  typeof option === 'string' &&
                  !!option.trim() &&
                  option.length <= 120
              );

            return (
              !menu ||
              !validPrice(menu.fullPrice) ||
              !validPrice(menu.firstPrice) ||
              !validPrice(menu.secondPrice) ||
              !validOptions(
                menu.firstOptions,
                true
              ) ||
              !validOptions(
                menu.secondOptions,
                true
              ) ||
              !validOptions(
                menu.dessertOptions,
                false
              )
            );
          }
        )
      ) {
        return fail(
          'Configurația Meniului zilei nu este validă.'
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
          product.customDailyMenu
            ? customDailyVariants(
                product.customDailyMenu
              )
            : product.dailyMenu
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
      const roundOwnerToken =
        randomBytes(32).toString('hex');
      const roundOwnerTokenHash =
        hashOwnerToken(roundOwnerToken);

      await database('rounds', {
        method: 'POST',

        body: JSON.stringify({
          id,
          title: body.title.trim(),
          organizer_name: organizerName,
          currency: body.currency,
          payment_recipient: paymentRecipient || null,
          payment_link: paymentLink || null,
          owner_token_hash: roundOwnerTokenHash,

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

              ...(product.customDailyChoices
                ? {
                    customDailyChoices:
                      product.customDailyChoices,
                  }
                : {}),

              ...(product.customDailyPrices
                ? {
                    customDailyPrices:
                      product.customDailyPrices,
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

      return Response.json({
        id,
        ownerToken: roundOwnerToken,
      });
    }

    if (!uuid(body.id)) {
      return fail('Link de comandă nevalid.');
    }

    const admin = isAdmin(req);
    const canManage = await canManageRound(
      req,
      body.id,
      admin
    );

    if (body.action === 'toggle') {
      if (!canManage) {
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

    if (body.action === 'set_paid') {
  if (!canManage) {
    return fail(
      'Doar organizatorul poate modifica starea plății.',
      403
    );
  }

  if (!uuid(body.orderId)) {
    return fail('Comanda nu este validă.');
  }

  const result = await database(
    'orders?id=eq.' +
      body.orderId +
      '&round_id=eq.' +
      body.id +
      '&deleted=eq.false',
    {
      method: 'PATCH',
      body: JSON.stringify({
        paid: !!body.paid,
      }),
    }
  );

  if (!Array.isArray(result) || !result.length) {
    return fail(
      'Comanda nu a fost găsită.',
      404
    );
  }

  return Response.json(
    {
      ok: true,
      paid: !!body.paid,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

    const tokenValid =
      typeof body.editToken === 'string' &&
      /^[a-f0-9]{64}$/.test(body.editToken);

    if (
      body.action === 'delete_order' &&
      !canManage
    ) {
      return fail(
        'Doar organizatorul poate șterge comanda.',
        403
      );
    }

    if (
      (body.action === 'order' || !canManage) &&
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

          p_admin: canManage,
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