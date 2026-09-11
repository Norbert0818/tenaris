// app/page.tsx
'use client';

import { useEffect, useState } from 'react';

import {
  RestaurantPicker,
  DailyMenu,
  type DraftProduct,
} from '@/components/restaurant-picker';

import {
  restaurants,
  getRestaurant,
  initialRestaurantProducts,
} from '@/lib/restaurants';

import { GroupedProductList } from '@/components/grouped-product-list';
import { DailyMenuPicker } from '@/components/daily-menu-picker';

import {
  dailyGroups,
  type OrderProduct,
} from '@/lib/griff-daily';

import { prepareProducts } from '@/lib/prepare-products';
import { OrderEditor } from '@/components/order-editor';

import {
  Plus,
  ArrowLeft,
  ShoppingBag,
  ClipboardList,
  Copy,
  Check,
  Trash2,
  Users,
  Package,
  RefreshCw,
} from 'lucide-react';

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const newEditToken = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    value => value.toString(16).padStart(2, '0')
  ).join('');

type Product = OrderProduct;

const examples = [
  'Clătite cu cacao',
  'Clătite cu scorțișoară',
  'Clătite cu gem',
  'Clătite cu brânză dulce',
  'Clătite cu Nutella',
  'Clătite cu Nutella și banane',
  'Clătite cu nucă',
  'Clătite cu mac',
];

export default function Home() {
  const [view, setView] = useState('home');
  const [rounds, setRounds] = useState<any[]>([]);
  const [round, setRound] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [owner, setOwner] = useState(false);
  const [tab, setTab] = useState('order');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('RON');
  const [products, setProducts] = useState<DraftProduct[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [editToken, setEditToken] = useState('');
  const [ownAccess, setOwnAccess] = useState<{
    orderId: string;
    token: string;
  } | null>(null);
  const [editing, setEditing] = useState<{
    data: any;
    token?: string;
    nonce: number;
  } | null>(null);

  const [source, setSource] = useState('manual');
  const [restaurantProducts, setRestaurantProducts] =
    useState<DraftProduct[]>([]);

  const selectedRestaurant = getRestaurant(source);

  const money = (
    value: number,
    selectedCurrency = round?.currency || currency
  ) =>
    new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: selectedCurrency,
    }).format(value / 100);

  async function api(path = '', body?: any) {
    const response = await fetch(
      '/api/rounds' + path,
      body
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        : {
            cache: 'no-store',
          }
    );

    const data = await response.json();

    if (response.status === 401) {
      setNeedLogin(true);
    }

    if (!response.ok) {
      throw Error(data.error || 'A apărut o eroare.');
    }

    return data;
  }

  async function load(id?: string) {
    setLoading(true);
    setError('');

    try {
      const data = await api(
        id ? '?id=' + encodeURIComponent(id) : ''
      );

      setNeedLogin(false);

      if (id) {
        setRound(data.round);
        setOrders(data.orders);
        setOwner(data.isOwner);
        setView('round');
      } else {
        setRounds(data.rounds);
        setView('home');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('r');

    if (id) {
      setView('round');
    }

    load(id || undefined);
    setOrderId(crypto.randomUUID());
    setEditToken(newEditToken());

    if (id) {
      restoreAccess(id, true);
    }

    const pop = () => {
      setSent(false);
      setQty({});
      setEditing(null);

      const next = new URLSearchParams(location.search).get('r');

      load(next || undefined);
      setOwnAccess(null);

      if (next) {
        restoreAccess(next, true);
      }
    };

    window.addEventListener('popstate', pop);

    return () => {
      window.removeEventListener('popstate', pop);
    };
  }, []);

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function restoreAccess(id: string, readHash = false) {
    try {
      const hash = new URLSearchParams(
        readHash ? location.hash.slice(1) : ''
      );

      const saved =
        hash.get('order') && hash.get('token')
          ? {
              orderId: hash.get('order')!,
              token: hash.get('token')!,
            }
          : JSON.parse(
              localStorage.getItem('comanda:edit:' + id) ||
                'null'
            );

      if (
        saved &&
        /^[a-f0-9]{64}$/.test(saved.token) &&
        typeof saved.orderId === 'string'
      ) {
        setOwnAccess(saved);

        if (hash.get('order')) {
          editOrder(id, saved.orderId, saved.token).catch(e =>
            setError(e.message)
          );
        }
      }
    } catch {}
  }

  async function editOrder(
    roundId: string,
    id: string,
    token?: string
  ) {
    const data = await api('', {
      action: 'view_order',
      id: roundId,
      orderId: id,
      editToken: token,
    });

    setEditing({
      data: data.order,
      token,
      nonce: Date.now(),
    });
  }

  function saveAccess(
    roundId: string,
    id: string,
    token: string
  ) {
    const access = {
      orderId: id,
      token,
    };

    setOwnAccess(access);

    try {
      localStorage.setItem(
        'comanda:edit:' + roundId,
        JSON.stringify(access)
      );
    } catch {}

    history.replaceState(
      {},
      '',
      '?r=' +
        roundId +
        '#order=' +
        id +
        '&token=' +
        token
    );
  }

  function resetOrder() {
    setSent(false);
    setName('');
    setQty({});
    setOrderId(crypto.randomUUID());
    setEditToken(newEditToken());

    history.replaceState({}, '', '?r=' + round.id);
  }

  async function copyEditLink() {
    if (!ownAccess) {
      return;
    }

    await navigator.clipboard.writeText(
      location.origin +
        '/?r=' +
        round.id +
        '#order=' +
        ownAccess.orderId +
        '&token=' +
        ownAccess.token
    );

    setNotice(
      'Link de editare copiat. Păstrează-l pentru tine: cine îl are poate modifica această comandă.'
    );
  }

  function open(id: string) {
    setEditing(null);
    setOwnAccess(null);
    setEditToken(newEditToken());

    restoreAccess(id);

    history.pushState({}, '', '?r=' + id);

    setQty({});
    setSent(false);
    setTab('order');
    setOrderId(crypto.randomUUID());

    load(id);
  }

  function home() {
    setEditing(null);
    setOwnAccess(null);

    history.pushState({}, '', '/');

    load();
    setNotice('');
  }

  function changeSource(next: string) {
    setSource(next);
    setError('');

    const restaurant = getRestaurant(next);

    if (restaurant) {
      setRestaurantProducts(
        initialRestaurantProducts(restaurant)
      );
      setCurrency(restaurant.currency);
    } else {
      setRestaurantProducts([]);
    }
  }

  function applyProducts(
    imported: DraftProduct[],
    importCurrency: string
  ) {
    const existing = products.filter(
      product =>
        product.name.trim() || product.price !== ''
    );

    if (
      existing.length &&
      importCurrency !== currency
    ) {
      return 'Moneda diferă de lista existentă. Creează o listă nouă sau schimbă moneda; nu există conversie automată.';
    }

    const fresh = imported.filter(
      product =>
        !existing.some(
          existingProduct =>
            existingProduct.name === product.name &&
            existingProduct.price === product.price
        )
    );

    if (existing.length + fresh.length > 100) {
      return 'Lista poate avea maximum 100 de produse.';
    }

    if (!fresh.length) {
      return 'Produsele selectate sunt deja în listă.';
    }

    setProducts([...existing, ...fresh]);
    setCurrency(importCurrency);

    return null;
  }

  const chosen: Product[] =
    round?.products.filter(
      (product: Product) => qty[product.id] > 0
    ) || [];

  const total = chosen.reduce(
    (sum, product) =>
      sum + product.price * qty[product.id],
    0
  );

  const allTotal = orders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const count = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum: number, item: any) =>
          itemSum + item.qty,
        0
      ),
    0
  );

  const paidOrders = orders.filter(
    order => order.paid === true
  );

  const paidCount = paidOrders.length;

  const paidTotal = paidOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const remainingTotal = Math.max(
    0,
    allTotal - paidTotal
  );

  const productById = new Map<string, Product>(
    (round?.products || []).map(
      (product: Product) => [product.id, product]
    )
  );

  function getOrderGroups(order: any) {
    const groups = new Map<
      string,
      {
        section: string;
        category: string;
        items: any[];
      }
    >();

    for (const item of order.items || []) {
      const product = productById.get(item.id);

      const section =
        typeof product?.section === 'string'
          ? product.section
          : '';

      const category =
        typeof product?.category === 'string'
          ? product.category
          : '';

      const key = `${section}||${category}`;
      const existing = groups.get(key);

      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          section,
          category,
          items: [item],
        });
      }
    }

    return Array.from(groups.values());
  }

  return (
    <>
      <header>
        <a
          className="brand"
          href="/"
          onClick={event => {
            event.preventDefault();
            home();
          }}
        >
          <span className="brand-icon">
            <ShoppingBag size={22} />
          </span>

          Comandă de grup

          <span className="brand-divider">/</span>

          <span className="brand-sub">
            Mai simplu împreună.
          </span>
        </a>

        <span className="header-note">
          Comenzile echipei, într-un singur loc
        </span>

        {!needLogin && view === 'home' && (
          <button
            className="text-button"
            onClick={() =>
              action(async () => {
                await fetch('/api/auth', {
                  method: 'DELETE',
                });

                await load();
              })
            }
          >
            Ieșire organizator
          </button>
        )}
      </header>

      <main>
        {view !== 'home' && (
          <button
            className="back"
            onClick={home}
          >
            <ArrowLeft size={16} />
            Comenzile mele de grup
          </button>
        )}

        {error && (
          <div
            className="error"
            role="alert"
          >
            {error}{' '}

            <button
              onClick={() =>
                load(
                  round?.id ||
                    new URLSearchParams(
                      location.search
                    ).get('r') ||
                    undefined
                )
              }
            >
              Reîncarcă
            </button>
          </div>
        )}

        {notice && (
          <div
            className="notice"
            role="status"
          >
            {notice}
          </div>
        )}

        {view === 'home' && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  COMENZI DE GRUP
                </p>

                <h1>Ce comandăm azi?</h1>

                <p>
                  Creează o listă și află ce dorește
                  fiecare.
                </p>
              </div>

              <button
                className="primary"
                disabled={needLogin}
                onClick={() => {
                  setView('create');
                  setError('');
                }}
              >
                <Plus size={19} />
                Comandă de grup nouă
              </button>
            </div>

            {needLogin ? (
              <form
                className="panel"
                style={{ maxWidth: 480 }}
                onSubmit={event => {
                  event.preventDefault();

                  action(async () => {
                    const response = await fetch(
                      '/api/auth',
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type':
                            'application/json',
                        },
                        body: JSON.stringify({
                          password,
                        }),
                      }
                    );

                    const data =
                      await response.json();

                    if (!response.ok) {
                      throw Error(data.error);
                    }

                    setPassword('');
                    setNeedLogin(false);

                    await load();
                  });
                }}
              >
                <h2>Acces organizator</h2>

                <p className="muted">
                  Introdu parola pentru a crea comenzi și
                  a vedea centralizatorul. Colegii
                  comandă direct prin link, fără
                  autentificare.
                </p>

                <label>
                  Parola organizatorului

                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={event =>
                      setPassword(event.target.value)
                    }
                  />
                </label>

                <button
                  className="primary wide"
                  style={{ marginTop: 20 }}
                  disabled={busy}
                >
                  {busy
                    ? 'Se verifică…'
                    : 'Intră'}
                </button>
              </form>
            ) : loading ? (
              <div className="panel muted">
                Se încarcă comenzile de grup…
              </div>
            ) : rounds.length ? (
              <div className="round-grid">
                {rounds.map(item => (
                  <button
                    className="round-card"
                    key={item.id}
                    onClick={() => open(item.id)}
                  >
                    <span className="round-icon">
                      <ClipboardList />
                    </span>

                    <span
                      className={
                        'badge ' +
                        (item.closed ? 'closed' : '')
                      }
                    >
                      {item.closed
                        ? 'Închisă'
                        : 'Deschisă'}
                    </span>

                    <h2>{item.title}</h2>

                    <p>
                      {new Date(
                        item.created
                      ).toLocaleDateString('ro-RO')}{' '}
                      · {item.currency}
                    </p>

                    <span className="card-link">
                      Comandă și centralizator →
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              !error && (
                <section className="empty panel">
                  <span className="empty-icon">
                    <ClipboardList size={36} />
                  </span>

                  <h2>
                    Prima comandă de grup începe aici.
                  </h2>

                  <p>
                    Clătite, prânz sau rechizite de
                    birou?
                    <br />
                    Tu adaugi produsele, fiecare alege ce
                    dorește.
                  </p>

                  <button
                    className="primary"
                    onClick={() =>
                      setView('create')
                    }
                  >
                    <Plus size={18} />
                    Creează comanda de grup
                  </button>

                  <div className="steps">
                    <span>
                      <b>01</b> Produse și prețuri
                    </span>

                    <span>
                      <b>02</b> Nume și cantitate
                    </span>

                    <span>
                      <b>03</b> Centralizator automat
                    </span>
                  </div>
                </section>
              )
            )}
          </>
        )}

        {view === 'create' && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  COMANDĂ DE GRUP NOUĂ
                </p>

                <h1>Pregătește lista.</h1>

                <p>
                  După salvare, vei primi linkul pentru
                  comenzi.
                </p>
              </div>
            </div>

            <form
              noValidate
              className="create-grid"
              onSubmit={event => {
                event.preventDefault();

                action(async () => {
                  if (!title.trim()) {
                    throw Error(
                      'Completează denumirea comenzii.'
                    );
                  }

                  const orderCurrency =
                    selectedRestaurant?.currency ||
                    currency;

                  const orderProducts =
                    selectedRestaurant
                      ? restaurantProducts
                      : products;

                  const data = await api('', {
                    action: 'create',
                    title,
                    currency: orderCurrency,
                    products:
                      prepareProducts(orderProducts),
                  });

                  open(data.id);
                  setTab('summary');
                });
              }}
            >
              <section className="panel">
                <div className="source-picker">
                  <label>
                    De unde comandăm?

                    <Select
                      value={source}
                      onValueChange={changeSource}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="manual">
                          Introducere manuală
                        </SelectItem>

                        {restaurants.map(
                          restaurant => (
                            <SelectItem
                              key={restaurant.id}
                              value={restaurant.id}
                            >
                              {restaurant.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </label>

                  <p className="muted">
                    Alege un restaurant cu meniu salvat
                    sau introdu produsele manual.
                  </p>
                </div>

                {selectedRestaurant && (
                  <RestaurantPicker
                    restaurant={
                      selectedRestaurant
                    }
                    value={restaurantProducts}
                    onChange={
                      setRestaurantProducts
                    }
                  />
                )}

                {source === 'manual' && (
                  <DailyMenu
                    currency={currency}
                    onApply={applyProducts}
                  />
                )}

                <div className="form-top">
                  <label>
                    Denumirea comenzii

                    <input
                      required
                      maxLength={100}
                      value={title}
                      onChange={event =>
                        setTitle(event.target.value)
                      }
                      placeholder="Ex. Prânzul de miercuri"
                    />
                  </label>

                  <label>
                    Monedă

                    <Select
                      value={
                        selectedRestaurant?.currency ||
                        currency
                      }
                      disabled={
                        !!selectedRestaurant
                      }
                      onValueChange={setCurrency}
                    >
                      <SelectTrigger className="currency">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="RON">
                          RON · lei
                        </SelectItem>

                        <SelectItem value="HUF">
                          HUF · forinți
                        </SelectItem>

                        <SelectItem value="EUR">
                          EUR · euro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                {!selectedRestaurant && (
                  <>
                    <div className="section-heading">
                      <h2>Lista pentru comandă</h2>

                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setProducts([
                            ...products.filter(
                              product =>
                                product.name.trim() ||
                                product.price
                            ),
                            ...examples.map(name => ({
                              name,
                              price: '',
                            })),
                          ])
                        }
                      >
                        Adaugă 8 sortimente de clătite
                      </button>
                    </div>

                    <div className="edit-head">
                      <span>Denumirea produsului</span>

                      <span>
                        Preț unitar ({currency})
                      </span>

                      <span />
                    </div>

                    {products.map(
                      (product, index) => (
                        <div
                          className="edit-row"
                          key={index}
                        >
                          <input
                            aria-label={`${
                              index + 1
                            }. produs: denumire`}
                            required
                            maxLength={200}
                            placeholder="Ex. Clătite cu cacao"
                            value={product.name}
                            disabled={
                              product.dailyMenu
                            }
                            onChange={event =>
                              setProducts(
                                products.map(
                                  (
                                    current,
                                    currentIndex
                                  ) =>
                                    index ===
                                    currentIndex
                                      ? {
                                          ...current,
                                          name: event
                                            .target
                                            .value,
                                        }
                                      : current
                                )
                              )
                            }
                          />

                          <input
                            aria-label={`${
                              index + 1
                            }. produs: preț`}
                            required
                            type="number"
                            min="0"
                            max="100000"
                            step="0.01"
                            placeholder="0,00"
                            value={product.price}
                            disabled={
                              product.dailyMenu
                            }
                            onChange={event =>
                              setProducts(
                                products.map(
                                  (
                                    current,
                                    currentIndex
                                  ) =>
                                    index ===
                                    currentIndex
                                      ? {
                                          ...current,
                                          price:
                                            event
                                              .target
                                              .value,
                                        }
                                      : current
                                )
                              )
                            }
                          />

                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`${
                              index + 1
                            }. Șterge produsul`}
                            onClick={() =>
                              setProducts(
                                products.filter(
                                  (
                                    _,
                                    currentIndex
                                  ) =>
                                    index !==
                                    currentIndex
                                )
                              )
                            }
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      className="add-item"
                      disabled={
                        products.length >= 100
                      }
                      onClick={() =>
                        setProducts([
                          ...products,
                          {
                            name: '',
                            price: '',
                          },
                        ])
                      }
                    >
                      <Plus size={18} />
                      Adaugă un produs
                    </button>
                  </>
                )}
              </section>

              <aside className="panel setup-aside">
                <span className="round-icon">
                  <ClipboardList />
                </span>

                <h2>Fiecare comandă se adună.</h2>

                <p>
                  Colegii aleg produsele, introduc
                  cantitățile și numele.
                </p>

                <p>
                  Tu vezi centralizatorul pe produse și
                  pe persoane.
                </p>

                <div className="aside-note">
                  {selectedRestaurant
                    ? `${
                        restaurantProducts.length
                      } opțiuni din ${
                        selectedRestaurant.name
                      } sunt selectate.`
                    : 'Verifică prețurile înainte de salvare. Prețurile listei create rămân fixe.'}
                </div>

                <button
                  className="primary wide"
                  disabled={busy}
                >
                  {busy
                    ? 'Se salvează…'
                    : 'Creează comanda de grup'}
                </button>
              </aside>
            </form>
          </>
        )}

        {view === 'round' &&
          (loading && !round ? (
            <div className="panel">
              Se încarcă comanda…
            </div>
          ) : (
            round && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      COMANDĂ DE GRUP
                    </p>

                    <h1>{round.title}</h1>

                    <p>
                      <span
                        className={
                          'badge ' +
                          (round.closed
                            ? 'closed'
                            : '')
                        }
                      >
                        {round.closed
                          ? 'Închisă'
                          : 'Deschisă'}
                      </span>{' '}

                      <span className="muted">
                        {round.products.filter(
                          (product: Product) =>
                            !product.dailyChoices
                        ).length +
                          (round.products.some(
                            (product: Product) =>
                              product.dailyChoices
                          )
                            ? 1
                            : 0)}{' '}
                        produse disponibile ·{' '}
                        {round.currency}
                      </span>
                    </p>
                  </div>

                  {owner && (
                    <button
                      className="secondary"
                      onClick={() =>
                        action(async () => {
                          await navigator.clipboard.writeText(
                            location.origin +
                              '/?r=' +
                              round.id
                          );

                          setNotice(
                            'Link copiat! Trimite-l colegilor; pot comanda fără cont sau parolă.'
                          );
                        })
                      }
                    >
                      <Copy size={17} />
                      Copiază linkul de comandă
                    </button>
                  )}
                </div>

                {ownAccess && !editing && (
                  <div className="own-order-tools">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        action(() =>
                          editOrder(
                            round.id,
                            ownAccess.orderId,
                            ownAccess.token
                          )
                        )
                      }
                    >
                      Modifică propria comandă
                    </button>

                    <button
                      className="secondary"
                      onClick={() =>
                        action(copyEditLink)
                      }
                    >
                      <Copy size={16} />
                      Copiază linkul meu de editare
                    </button>

                    <span className="muted">
                      Păstrează linkul pentru a reveni de
                      pe alt dispozitiv.
                    </span>
                  </div>
                )}

                {editing && (
                  <OrderEditor
                    key={
                      editing.data.id +
                      '-' +
                      editing.data.revision +
                      '-' +
                      editing.nonce
                    }
                    order={editing.data}
                    products={round.products}
                    currency={round.currency}
                    locked={
                      round.closed && !owner
                    }
                    onCancel={() =>
                      setEditing(null)
                    }
                    onReload={() =>
                      editOrder(
                        round.id,
                        editing.data.id,
                        editing.token
                      )
                    }
                    onSave={async (
                      nextName,
                      items
                    ) => {
                      const data = await api('', {
                        action: 'update_order',
                        id: round.id,
                        orderId: editing.data.id,
                        editToken: editing.token,
                        revision:
                          editing.data.revision,
                        name: nextName,
                        items,
                      });

                      setOrders(previous =>
                        previous.map(order =>
                          order.id === data.order.id
                            ? data.order
                            : order
                        )
                      );

                      if (editing.token) {
                        setName(data.order.name);

                        setQty(
                          Object.fromEntries(
                            data.order.items.map(
                              (item: any) => [
                                item.id,
                                item.qty,
                              ]
                            )
                          )
                        );

                        setSent(true);
                        setTab('order');
                      }

                      setEditing(null);

                      setNotice(
                        'Modificările au fost salvate. Totalurile au fost actualizate.'
                      );
                    }}
                  />
                )}

                <div hidden={!!editing}>
                  <Tabs
                    value={tab}
                    onValueChange={setTab}
                  >
                    <TabsList className="tabs">
                      <TabsTrigger value="order">
                        Plasează o comandă
                      </TabsTrigger>

                      {owner && (
                        <TabsTrigger value="summary">
                          Centralizator{' '}
                          <span className="tab-count">
                            {orders.length}
                          </span>
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="order">
                      {sent ? (
                        <section className="panel success">
                          <span className="success-check">
                            <Check size={30} />
                          </span>

                          <h2>
                            Mulțumim, {name}!
                          </h2>

                          <p>
                            Comanda ta a fost salvată.
                          </p>

                          <strong>
                            {money(total)}
                          </strong>

                          <div className="receipt">
                            {chosen.map(product => (
                              <p key={product.id}>
                                <span>
                                  {qty[product.id]} ×{' '}
                                  {product.name}
                                </span>

                                <b>
                                  {money(
                                    product.price *
                                      qty[
                                        product.id
                                      ]
                                  )}
                                </b>
                              </p>
                            ))}
                          </div>

                          <button
                            className="secondary"
                            onClick={resetOrder}
                          >
                            Plasează o comandă nouă
                          </button>
                        </section>
                      ) : (
                        <form
                          className="order-grid"
                          onSubmit={event => {
                            event.preventDefault();

                            action(async () => {
                              const saved =
                                await api('', {
                                  action: 'order',
                                  id: round.id,
                                  name,
                                  orderId,
                                  editToken,
                                  items: chosen.map(
                                    product => ({
                                      id: product.id,
                                      qty: qty[
                                        product.id
                                      ],
                                    })
                                  ),
                                });

                              saveAccess(
                                round.id,
                                orderId,
                                editToken
                              );

                              setName(
                                saved.order.name
                              );

                              setQty(
                                Object.fromEntries(
                                  saved.order.items.map(
                                    (item: any) => [
                                      item.id,
                                      item.qty,
                                    ]
                                  )
                                )
                              );

                              setSent(true);

                              if (owner) {
                                const data =
                                  await api(
                                    '?id=' +
                                      round.id
                                  );

                                setOrders(
                                  data.orders
                                );
                              }
                            });
                          }}
                        >
                          <section className="panel product-panel">
                            <div className="section-heading">
                              <h2>Ce dorești?</h2>

                              <span className="muted">
                                Bifează și introdu
                                cantitatea.
                              </span>
                            </div>

                            <DailyMenuPicker
                              products={
                                round.products
                              }
                              qty={qty}
                              onChange={setQty}
                              disabled={
                                round.closed ||
                                busy
                              }
                            />

                            <GroupedProductList
                              products={
                                round.products
                              }
                              qty={qty}
                              onChange={setQty}
                              disabled={
                                round.closed ||
                                busy
                              }
                              money={value =>
                                money(value)
                              }
                            />
                          </section>

                          <aside className="panel basket">
                            <h2>Comanda ta</h2>

                            {chosen.length ? (
                              <div className="basket-items">
                                {chosen.map(
                                  product => (
                                    <div
                                      key={
                                        product.id
                                      }
                                    >
                                      <span>
                                        {
                                          qty[
                                            product.id
                                          ]
                                        }{' '}
                                        ×{' '}
                                        {
                                          product.name
                                        }
                                      </span>

                                      <b>
                                        {money(
                                          product.price *
                                            qty[
                                              product
                                                .id
                                            ]
                                        )}
                                      </b>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <p className="muted basket-empty">
                                Nu ai ales încă niciun
                                produs.
                              </p>
                            )}

                            <div className="total">
                              <span>
                                Total de plată
                              </span>

                              <strong>
                                {money(total)}
                              </strong>
                            </div>

                            <label>
                              Numele tău

                              <input
                                required
                                maxLength={80}
                                disabled={
                                  busy ||
                                  round.closed
                                }
                                placeholder="Nume și prenume"
                                value={name}
                                onChange={event =>
                                  setName(
                                    event.target.value
                                  )
                                }
                              />
                            </label>

                            <button
                              className="primary wide"
                              disabled={
                                busy ||
                                round.closed ||
                                !chosen.length
                              }
                            >
                              {round.closed
                                ? 'Comanda este închisă'
                                : busy
                                  ? 'Se trimite…'
                                  : 'Trimite comanda'}
                            </button>

                            <p className="small muted">
                              Comanda apare în
                              centralizator doar după
                              trimitere.
                            </p>
                          </aside>
                        </form>
                      )}
                    </TabsContent>

                    {owner && (
                      <TabsContent value="summary">
                        <div className="stats">
                          <div>
                            <Users />
                            <span>
                              Comenzi primite
                            </span>
                            <strong>
                              {orders.length}
                            </strong>
                          </div>

                          <div>
                            <Package />
                            <span>
                              Cantitate totală
                            </span>
                            <strong>
                              {count}{' '}
                              <small>buc.</small>
                            </strong>
                          </div>

                          <div className="grand">
                            <ShoppingBag />
                            <span>
                              Valoare totală
                            </span>
                            <strong>
                              {money(allTotal)}
                            </strong>
                          </div>
                        </div>

                        <div className="summary-tools">
                          <span className="muted">
                            Centralizatorul comenzilor
                            salvate
                          </span>

                          <div>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                action(
                                  async () => {
                                    const data =
                                      await api(
                                        '?id=' +
                                          round.id
                                      );

                                    setOrders(
                                      data.orders
                                    );

                                    setRound(
                                      data.round
                                    );
                                  }
                                )
                              }
                            >
                              <RefreshCw
                                size={16}
                              />
                              Actualizează
                            </button>

                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                action(
                                  async () => {
                                    await api('', {
                                      action:
                                        'toggle',
                                      id: round.id,
                                      closed:
                                        !round.closed,
                                    });

                                    setRound({
                                      ...round,
                                      closed:
                                        !round.closed,
                                    });
                                  }
                                )
                              }
                            >
                              {round.closed
                                ? 'Redeschide comanda'
                                : 'Închide comanda'}
                            </button>
                          </div>
                        </div>

                        <div className="summary-grid">
                          <section className="panel">
                            <h2>Pe produse</h2>

                            <p className="muted">
                              Folosește această listă
                              pentru comanda finală.
                            </p>

                            {round.products.map(
                              (product: Product) => {
                                const amount =
                                  orders.reduce(
                                    (
                                      sum,
                                      order
                                    ) =>
                                      sum +
                                      order.items
                                        .filter(
                                          (
                                            item: any
                                          ) =>
                                            item.id ===
                                            product.id
                                        )
                                        .reduce(
                                          (
                                            itemSum: number,
                                            item: any
                                          ) =>
                                            itemSum +
                                            item.qty,
                                          0
                                        ),
                                    0
                                  );

                                if (!amount) {
                                  return null;
                                }

                                return (
                                  <div
                                    className="summary-row"
                                    key={
                                      product.id
                                    }
                                  >
                                    <span>
                                      {
                                        product.name
                                      }
                                    </span>

                                    <b>
                                      {amount} buc.
                                    </b>

                                    <strong>
                                      {money(
                                        amount *
                                          product.price
                                      )}
                                    </strong>
                                  </div>
                                );
                              }
                            )}

                            {round.products.some(
                              (product: Product) =>
                                product.dailyChoices
                            ) && (
                              <div className="daily-course-summary">
                                <h3>
                                  Meniul zilei — total
                                  pe feluri
                                </h3>

                                <p className="small muted">
                                  Incluse în prețul
                                  meniului; nu se adaugă
                                  costuri separate.
                                </p>

                                {dailyGroups.map(
                                  group => (
                                    <div
                                      key={group.key}
                                    >
                                      <h4>
                                        {group.label}
                                      </h4>

                                      {group.options.map(
                                        option => {
                                          const amount =
                                            orders.reduce(
                                              (
                                                sum,
                                                order
                                              ) =>
                                                sum +
                                                order.items
                                                  .filter(
                                                    (
                                                      item: Product
                                                    ) =>
                                                      item
                                                        .dailyChoices?.[
                                                        group
                                                          .key
                                                      ] ===
                                                      option
                                                  )
                                                  .reduce(
                                                    (
                                                      itemSum: number,
                                                      item: any
                                                    ) =>
                                                      itemSum +
                                                      item.qty,
                                                    0
                                                  ),
                                              0
                                            );

                                          return amount >
                                            0 ? (
                                            <p
                                              key={
                                                option
                                              }
                                            >
                                              <span>
                                                {
                                                  option
                                                }
                                              </span>

                                              <b>
                                                {
                                                  amount
                                                }{' '}
                                                buc.
                                              </b>
                                            </p>
                                          ) : null;
                                        }
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div className="summary-row total">
                              <b>Total</b>
                              <b>{count} buc.</b>
                              <strong>
                                {money(allTotal)}
                              </strong>
                            </div>
                          </section>

                          <section className="panel">
                            <h2>Pe persoane</h2>

                            <p className="muted">
                              Ce a comandat fiecare și
                              cât are de plătit?
                            </p>

                            {orders.length ? (
                              orders.map(order => (
                                <article
                                  className="person"
                                  key={order.id}
                                >
                                  <div>
                                    <span className="avatar">
                                      {order.name
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </span>

                                    <b>
                                      {order.name}
                                    </b>

                                    <strong>
                                      {money(
                                        order.total
                                      )}
                                    </strong>
                                  </div>

                                  <div className="person-order-groups">
                                    {getOrderGroups(order).map(
                                      (
                                        group,
                                        groupIndex
                                      ) => (
                                        <div
                                          className="person-order-group"
                                          key={`${group.section}-${group.category}-${groupIndex}`}
                                        >
                                          {(group.section ||
                                            group.category) && (
                                            <div className="person-order-category">
                                              {group.section && (
                                                <span className="person-order-section">
                                                  {group.section}
                                                </span>
                                              )}

                                              {group.category && (
                                                <strong>
                                                  {group.category}
                                                </strong>
                                              )}
                                            </div>
                                          )}

                                          <p>
                                            {group.items
                                              .map(
                                                (
                                                  item: any
                                                ) =>
                                                  `${item.qty} × ${item.name}`
                                              )
                                              .join(' · ')}
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  <div className="person-actions">
                                    <button
                                      className={
                                        'secondary payment-toggle ' +
                                        (order.paid
                                          ? 'paid'
                                          : '')
                                      }
                                      disabled={busy}
                                      onClick={() =>
                                        action(async () => {
                                          const nextPaid =
                                            !order.paid;

                                          await api('', {
                                            action:
                                              'set_paid',
                                            id: round.id,
                                            orderId:
                                              order.id,
                                            paid: nextPaid,
                                          });

                                          setOrders(
                                            previous =>
                                              previous.map(
                                                item =>
                                                  item.id ===
                                                  order.id
                                                    ? {
                                                        ...item,
                                                        paid:
                                                          nextPaid,
                                                      }
                                                    : item
                                              )
                                          );
                                        })
                                      }
                                    >
                                      {order.paid ? (
                                        <>
                                          <Check size={15} />
                                          Plătit
                                        </>
                                      ) : (
                                        'Marchează plătit'
                                      )}
                                    </button>

                                    <button
                                      className="secondary"
                                      disabled={busy}
                                      onClick={() =>
                                        action(() =>
                                          editOrder(
                                            round.id,
                                            order.id
                                          )
                                        )
                                      }
                                    >
                                      Modifică
                                    </button>

                                    <button
                                      className="secondary delete-order"
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          !window.confirm(
                                            'Ștergi comanda lui ' +
                                              order.name +
                                              '? Aceasta va fi eliminată din totaluri.'
                                          )
                                        ) {
                                          return;
                                        }

                                        action(
                                          async () => {
                                            await api(
                                              '',
                                              {
                                                action:
                                                  'delete_order',
                                                id: round.id,
                                                orderId:
                                                  order.id,
                                                revision:
                                                  order.revision,
                                              }
                                            );

                                            setOrders(
                                              previous =>
                                                previous.filter(
                                                  item =>
                                                    item.id !==
                                                    order.id
                                                )
                                            );

                                            setNotice(
                                              'Comanda a fost ștearsă. Totalurile au fost actualizate.'
                                            );
                                          }
                                        );
                                      }}
                                    >
                                      <Trash2
                                        size={15}
                                      />
                                      Șterge
                                    </button>
                                  </div>
                                </article>
                              ))
                            ) : (
                              <div className="no-orders">
                                Nu s-a primit încă nicio
                                comandă.
                                <br />
                                Comenzile trimise vor
                                apărea aici.
                              </div>
                            )}

                            {orders.length > 0 && (
                              <div className="payment-summary">
                                <h3>
                                  Situația plăților
                                </h3>

                                <div>
                                  <span>
                                    Total comandă
                                  </span>
                                  <strong>
                                    {money(allTotal)}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Plătit
                                  </span>
                                  <strong>
                                    {money(paidTotal)}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Rămas de plată
                                  </span>
                                  <strong>
                                    {money(
                                      remainingTotal
                                    )}
                                  </strong>
                                </div>

                                <div className="payment-summary-count">
                                  <span>
                                    Persoane care au
                                    plătit
                                  </span>
                                  <strong>
                                    {paidCount} /{' '}
                                    {orders.length}
                                  </strong>
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              </>
            )
          ))}
      </main>

      <footer>
        Comandă de grup{' '}
        <span>
          Mai puține mesaje. Comenzi mai clare.
        </span>
      </footer>
    </>
  );
}