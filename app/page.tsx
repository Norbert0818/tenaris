// app/page.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  Printer,
  FileSpreadsheet,
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

type ExcelCell = string | number;

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelWorksheet(
  name: string,
  rows: ExcelCell[][]
) {
  const body = rows
    .map(row => {
      const cells = row
        .map(value => {
          const isNumber =
            typeof value === 'number' &&
            Number.isFinite(value);

          return (
            '<Cell><Data ss:Type="' +
            (isNumber ? 'Number' : 'String') +
            '">' +
            xmlEscape(value) +
            '</Data></Cell>'
          );
        })
        .join('');

      return '<Row>' + cells + '</Row>';
    })
    .join('');

  return (
    '<Worksheet ss:Name="' +
    xmlEscape(name.slice(0, 31)) +
    '"><Table>' +
    body +
    '</Table></Worksheet>'
  );
}

function safeFileName(value: string) {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

  return cleaned || 'comanda';
}

function PrintPortal({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    children,
    document.body
  );
}

export default function Home() {
  const [view, setView] = useState('home');
  const [rounds, setRounds] = useState<any[]>([]);
  const [round, setRound] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [owner, setOwner] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [myRounds, setMyRounds] = useState<any[]>([]);
  const [tab, setTab] = useState('order');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [title, setTitle] = useState('');
  const [organizerName, setOrganizerName] =
    useState('');
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
  const [paymentRecipient, setPaymentRecipient] =
    useState('');
  const [paymentLink, setPaymentLink] =
    useState('');
  const [paymentCopied, setPaymentCopied] =
    useState(false);
  const [printMode, setPrintMode] = useState<
    'people' | 'restaurant' | null
  >(null);

  const selectedRestaurant = getRestaurant(source);

  const money = (
    value: number,
    selectedCurrency = round?.currency || currency
  ) =>
    new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: selectedCurrency,
    }).format(value / 100);

  function readRoundOwnerToken(
    roundId?: string | null
  ) {
    if (!roundId) {
      return '';
    }

    try {
      const token =
        localStorage.getItem(
          'comanda:owner:' + roundId
        ) || '';

      return /^[a-f0-9]{64}$/i.test(token)
        ? token
        : '';
    } catch {
      return '';
    }
  }

  function readCreatedRounds() {
    try {
      const value = JSON.parse(
        localStorage.getItem(
          'comanda:created-rounds'
        ) || '[]'
      );

      return Array.isArray(value)
        ? value.filter(
            item =>
              item &&
              typeof item.id === 'string' &&
              typeof item.title === 'string'
          )
        : [];
    } catch {
      return [];
    }
  }

  function forgetCreatedRound(id: string) {
    try {
      localStorage.removeItem(
        'comanda:owner:' + id
      );

      localStorage.removeItem(
        'comanda:edit:' + id
      );

      const next =
        readCreatedRounds().filter(
          item => item.id !== id
        );

      localStorage.setItem(
        'comanda:created-rounds',
        JSON.stringify(next)
      );

      setMyRounds(next);

      return next;
    } catch {
      return [];
    }
  }

  async function syncCreatedRounds() {
    const saved = readCreatedRounds();

    if (!saved.length) {
      setMyRounds([]);
      return [];
    }

    const results = await Promise.all(
      saved.map(async item => {
        const token =
          readRoundOwnerToken(item.id);

        const headers:
          Record<string, string> = {};

        if (token) {
          headers['X-Owner-Token'] =
            token;
        }

        try {
          const response = await fetch(
            '/api/rounds?id=' +
              encodeURIComponent(
                item.id
              ) +
              '&check=1',
            {
              cache: 'no-store',
              headers,
            }
          );

          if (
            response.status === 404 ||
            response.status === 403
          ) {
            return {
              keep: false,
              id: item.id,
              item,
            };
          }

          if (!response.ok) {
            // Temporary backend/network problem:
            // keep the local entry instead of
            // deleting it by mistake.
            return {
              keep: true,
              id: item.id,
              item,
            };
          }

          const data =
            await response.json();

          if (
            !data?.exists ||
            !data?.round
          ) {
            return {
              keep: false,
              id: item.id,
              item,
            };
          }

          return {
            keep: true,
            id: item.id,
            item: {
              ...item,
              title:
                data.round.title ||
                item.title,
              currency:
                data.round.currency ||
                item.currency,
              organizerName:
                data.round.organizer_name ||
                item.organizerName ||
                '',
              created:
                data.round.created ||
                item.created,
            },
          };
        } catch {
          // Offline / temporary failure:
          // do not delete local data.
          return {
            keep: true,
            id: item.id,
            item,
          };
        }
      })
    );

    const staleIds = results
      .filter(result => !result.keep)
      .map(result => result.id);

    try {
      for (const id of staleIds) {
        localStorage.removeItem(
          'comanda:owner:' + id
        );

        localStorage.removeItem(
          'comanda:edit:' + id
        );
      }

      const next = results
        .filter(result => result.keep)
        .map(result => result.item)
        .slice(0, 30);

      localStorage.setItem(
        'comanda:created-rounds',
        JSON.stringify(next)
      );

      setMyRounds(next);

      return next;
    } catch {
      const next = results
        .filter(result => result.keep)
        .map(result => result.item)
        .slice(0, 30);

      setMyRounds(next);
      return next;
    }
  }

  function rememberCreatedRound(
    id: string,
    ownerToken: string,
    roundTitle: string,
    roundCurrency: string,
    organizer: string
  ) {
    try {
      localStorage.setItem(
        'comanda:owner:' + id,
        ownerToken
      );

      const previous = readCreatedRounds().filter(
        item => item.id !== id
      );

      const next = [
        {
          id,
          title: roundTitle,
          currency: roundCurrency,
          organizerName: organizer,
          created: new Date().toISOString(),
        },
        ...previous,
      ].slice(0, 30);

      localStorage.setItem(
        'comanda:created-rounds',
        JSON.stringify(next)
      );

      setMyRounds(next);
    } catch {}
  }

  function requestRoundId(
    path: string,
    body?: any
  ) {
    if (
      body &&
      typeof body.id === 'string'
    ) {
      return body.id;
    }

    if (path.startsWith('?')) {
      return new URLSearchParams(
        path.slice(1)
      ).get('id');
    }

    return null;
  }

  async function api(path = '', body?: any) {
    const roundId = requestRoundId(
      path,
      body
    );

    const ownerToken =
      readRoundOwnerToken(roundId);

    const headers: Record<string, string> = {};

    if (body) {
      headers['Content-Type'] =
        'application/json';
    }

    if (ownerToken) {
      headers['X-Owner-Token'] =
        ownerToken;
    }

    const response = await fetch(
      '/api/rounds' + path,
      body
        ? {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          }
        : {
            cache: 'no-store',
            headers,
          }
    );

    const data = await response.json();

    if (!response.ok) {
      const requestError: Error & {
        status?: number;
      } = new Error(
        data.error || 'A apărut o eroare.'
      );

      requestError.status =
        response.status;

      throw requestError;
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
      setAdmin(!!data.isAdmin);

      if (id) {
        setRound(data.round);
        setOrders(data.orders);
        setOwner(data.isOwner);
        setView('round');
      } else {
        setRounds(data.rounds || []);
        await syncCreatedRounds();
        setOwner(false);
        setView('home');
      }
    } catch (e: any) {
      if (
        id &&
        (e?.status === 404 ||
          e?.status === 403)
      ) {
        forgetCreatedRound(id);

        history.replaceState(
          {},
          '',
          '/'
        );

        setRound(null);
        setOrders([]);
        setOwner(false);
        setView('home');

        setNotice(
          e?.status === 404
            ? 'Comanda nu mai există și a fost eliminată din lista locală.'
            : 'Nu mai ai acces de organizator la această comandă. A fost eliminată din lista ta.'
        );

        await syncCreatedRounds();
      } else {
        setError(e.message);
      }
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
    setPaymentCopied(false);
    setOrderId(crypto.randomUUID());
    setEditToken(newEditToken());

    history.replaceState({}, '', '?r=' + round.id);
  }

  async function copyPaymentAmount() {
    const amount = (total / 100).toFixed(2);

    await navigator.clipboard.writeText(amount);
    setPaymentCopied(true);

    window.setTimeout(() => {
      setPaymentCopied(false);
    }, 1600);
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

  function startCreate() {
    setView('create');
    setError('');
    setNotice('');
    setOrganizerName('');
    setPaymentRecipient('');
    setPaymentLink('');
    setPaymentCopied(false);
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
    const currentCurrency =
      selectedRestaurant?.currency || currency;

    const targetProducts = selectedRestaurant
      ? restaurantProducts
      : products;

    let existing = targetProducts.filter(
      product =>
        product.name.trim() ||
        product.price !== ''
    );

    const containsCustomDailyMenu =
      imported.some(
        product => !!product.customDailyMenu
      );

    if (containsCustomDailyMenu) {
      existing = existing.filter(
        product => !product.customDailyMenu
      );
    }

    if (
      existing.length &&
      importCurrency !== currentCurrency
    ) {
      return 'Moneda diferă de lista existentă. Creează o listă nouă sau schimbă moneda; nu există conversie automată.';
    }

    const fresh = imported.filter(
      product =>
        !!product.customDailyMenu ||
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

    const next = [...existing, ...fresh];

    if (selectedRestaurant) {
      setRestaurantProducts(next);
    } else {
      setProducts(next);
      setCurrency(importCurrency);
    }

    return null;
  }

  useEffect(() => {
    const clearPrintMode = () =>
      setPrintMode(null);

    window.addEventListener(
      'afterprint',
      clearPrintMode
    );

    return () =>
      window.removeEventListener(
        'afterprint',
        clearPrintMode
      );
  }, []);

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

  function getProductAmount(productId: string) {
    return orders.reduce(
      (sum, order) =>
        sum +
        order.items
          .filter((item: any) => item.id === productId)
          .reduce(
            (itemSum: number, item: any) =>
              itemSum + item.qty,
            0
          ),
      0
    );
  }

  function getSummaryGroups() {
    const groups = new Map<
      string,
      {
        section: string;
        category: string;
        products: Product[];
      }
    >();

    for (const product of round?.products || []) {
      if (
        product.dailyChoices ||
        product.customDailyChoices
      ) {
        continue;
      }

      const amount = getProductAmount(product.id);

      if (!amount) {
        continue;
      }

      const section =
        typeof product.section === 'string'
          ? product.section
          : '';

      const category =
        typeof product.category === 'string'
          ? product.category
          : '';

      const key = `${section}||${category}`;
      const existing = groups.get(key);

      if (existing) {
        existing.products.push(product);
      } else {
        groups.set(key, {
          section,
          category,
          products: [product],
        });
      }
    }

    return Array.from(groups.values());
  }

  function getCustomDailyChoiceTotals(
    key: 'first' | 'second' | 'dessert'
  ) {
    const totals = new Map<string, number>();

    for (const order of orders) {
      for (const item of order.items || []) {
        const product =
          productById.get(item.id);

        const option =
          product?.customDailyChoices?.[key];

        if (!option) {
          continue;
        }

        totals.set(
          option,
          (totals.get(option) || 0) +
            item.qty
        );
      }
    }

    return Array.from(totals.entries());
  }

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

  function getRestaurantSummaryGroups() {
    const groups = new Map<
      string,
      Map<string, number>
    >();

    function add(
      group: string,
      itemName: string,
      qtyValue: number
    ) {
      if (!itemName || qtyValue <= 0) {
        return;
      }

      const items =
        groups.get(group) ||
        new Map<string, number>();

      items.set(
        itemName,
        (items.get(itemName) || 0) +
          qtyValue
      );

      groups.set(group, items);
    }

    for (const order of orders) {
      for (const item of order.items || []) {
        const product =
          productById.get(item.id);

        if (!product) {
          continue;
        }

        if (product.dailyChoices) {
          for (const group of dailyGroups) {
            const option =
              product.dailyChoices[group.key];

            if (option) {
              add(
                `Meniul zilei · ${group.label}`,
                option,
                item.qty
              );
            }
          }

          continue;
        }

        if (product.customDailyChoices) {
          if (
            product.customDailyChoices.first
          ) {
            add(
              'Meniul zilei · Felul 1',
              product.customDailyChoices.first,
              item.qty
            );
          }

          if (
            product.customDailyChoices.second
          ) {
            add(
              'Meniul zilei · Felul 2',
              product.customDailyChoices.second,
              item.qty
            );
          }

          if (
            product.customDailyChoices.dessert
          ) {
            add(
              'Meniul zilei · Desert',
              product.customDailyChoices.dessert,
              item.qty
            );
          }

          continue;
        }

        const groupName =
          [
            product.section,
            product.category,
          ]
            .filter(Boolean)
            .join(' · ') || 'Produse';

        add(
          groupName,
          product.name,
          item.qty
        );
      }
    }

    return Array.from(
      groups.entries()
    ).map(([label, items]) => ({
      label,
      items: Array.from(items.entries())
        .map(([name, qtyValue]) => ({
          name,
          qty: qtyValue,
        }))
        .sort((left, right) =>
          left.name.localeCompare(
            right.name,
            'ro'
          )
        ),
    }));
  }

  function buildRestaurantMessage() {
    const lines: string[] = [
      '*COMANDĂ PENTRU RESTAURANT*',
      `*${round.title}*`,
    ];

    if (round.organizer_name) {
      lines.push(
        `Organizator: ${round.organizer_name}`
      );
    }

    lines.push(
      `Persoane: ${orders.length}`,
      ''
    );

    for (
      const group of getRestaurantSummaryGroups()
    ) {
      lines.push(
        `*${group.label.toUpperCase()}*`
      );

      for (const item of group.items) {
        lines.push(
          `• ${item.name} — ${item.qty} buc.`
        );
      }

      lines.push('');
    }

    lines.push(
      `*Total comandă: ${money(allTotal)}*`
    );

    return lines.join('\n').trim();
  }

  async function copyRestaurantMessage() {
    const message =
      buildRestaurantMessage();

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          message
        );
      } else {
        const textarea =
          document.createElement('textarea');

        textarea.value = message;
        textarea.setAttribute(
          'readonly',
          ''
        );

        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(
          textarea
        );

        textarea.select();

        const copied =
          document.execCommand('copy');

        textarea.remove();

        if (!copied) {
          throw new Error(
            'Copierea nu a reușit.'
          );
        }
      }

      setNotice(
        'Rezumatul pentru restaurant a fost copiat. Îl poți lipi acum în WhatsApp.'
      );
    } catch {
      throw Error(
        'Nu am putut copia textul. Încearcă din nou.'
      );
    }
  }

  function startPrint(
    mode: 'people' | 'restaurant'
  ) {
    setPrintMode(mode);

    window.setTimeout(() => {
      window.print();
    }, 80);
  }

  function exportExcel() {
    const peopleRows: ExcelCell[][] = [
      [
        'Nume',
        'Produs',
        'Cantitate',
        'Preț unitar',
        'Subtotal',
        'Monedă',
        'Plătit',
      ],
    ];

    for (const order of orders) {
      for (const item of order.items || []) {
        const product =
          productById.get(item.id);

        const unitPrice =
          product?.price || 0;

        peopleRows.push([
          order.name,
          product?.name ||
            item.name ||
            'Produs',
          item.qty,
          unitPrice / 100,
          (unitPrice * item.qty) / 100,
          round.currency,
          order.paid ? 'Da' : 'Nu',
        ]);
      }
    }

    const restaurantRows: ExcelCell[][] = [
      ['Categorie', 'Produs / preparat', 'Cantitate'],
    ];

    for (
      const group of getRestaurantSummaryGroups()
    ) {
      for (const item of group.items) {
        restaurantRows.push([
          group.label,
          item.name,
          item.qty,
        ]);
      }
    }

    const summaryRows: ExcelCell[][] = [
      ['Comandă', round.title],
      [
        'Organizator',
        round.organizer_name || '',
      ],
      ['Monedă', round.currency],
      ['Persoane', orders.length],
      ['Cantitate totală', count],
      ['Total', allTotal / 100],
      ['Plătit', paidTotal / 100],
      [
        'Rămas de plată',
        remainingTotal / 100,
      ],
    ];

    const workbook =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      excelWorksheet(
        'Rezumat',
        summaryRows
      ) +
      excelWorksheet(
        'Pe persoane',
        peopleRows
      ) +
      excelWorksheet(
        'Pentru restaurant',
        restaurantRows
      ) +
      '</Workbook>';

    const blob = new Blob(
      ['\ufeff' + workbook],
      {
        type:
          'application/vnd.ms-excel;charset=utf-8',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;
    link.download =
      'centralizator-' +
      safeFileName(round.title) +
      '.xls';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
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

        {admin && view === 'home' && (
          <button
            className="text-button"
            onClick={() =>
              action(async () => {
                await fetch('/api/auth', {
                  method: 'DELETE',
                });

                setAdmin(false);
                setNeedLogin(false);
                await load();
              })
            }
          >
            Ieșire administrator
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
            Înapoi la pagina principală
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
                onClick={startCreate}
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
                <h2>Acces administrator</h2>

                <p className="muted">
                  Parola este doar pentru administrator.
                  Administratorul vede toate comenzile și
                  toate centralizatoarele. Oricine poate
                  crea o comandă fără parolă.
                </p>

                <label>
                  Parola administratorului

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

                <div
                  className="editor-buttons"
                  style={{ marginTop: 20 }}
                >
                  <button
                    className="primary"
                    disabled={busy}
                  >
                    {busy
                      ? 'Se verifică…'
                      : 'Intră ca administrator'}
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setNeedLogin(false);
                      setPassword('');
                      setError('');
                    }}
                  >
                    Renunță
                  </button>
                </div>
              </form>
            ) : loading ? (
              <div className="panel muted">
                Se încarcă…
              </div>
            ) : admin ? (
              rounds.length ? (
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

                      {item.organizer_name && (
                        <p className="round-organizer">
                          Organizator: {item.organizer_name}
                        </p>
                      )}

                      <span className="card-link">
                        Comandă și centralizator →
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="empty panel">
                  <span className="empty-icon">
                    <ClipboardList size={36} />
                  </span>

                  <h2>
                    Nu există încă nicio comandă.
                  </h2>

                  <p>
                    Poți crea prima comandă de grup fără
                    alte setări.
                  </p>

                  <button
                    className="primary"
                    onClick={startCreate}
                  >
                    <Plus size={18} />
                    Creează comanda de grup
                  </button>
                </section>
              )
            ) : (
              <>
                {myRounds.length > 0 ? (
                  <>
                    <div className="section-heading">
                      <div>
                        <h2>Comenzile create de tine</h2>
                        <p className="muted">
                          Aceste comenzi pot fi administrate
                          de pe acest browser.
                        </p>
                      </div>
                    </div>

                    <div className="round-grid">
                      {myRounds.map(item => (
                        <button
                          className="round-card"
                          key={item.id}
                          onClick={() => open(item.id)}
                        >
                          <span className="round-icon">
                            <ClipboardList />
                          </span>

                          <span className="badge">
                            Creată de tine
                          </span>

                          <h2>{item.title}</h2>

                          <p>
                            {item.created
                              ? new Date(
                                  item.created
                                ).toLocaleDateString(
                                  'ro-RO'
                                )
                              : ''}
                            {item.currency
                              ? ` · ${item.currency}`
                              : ''}
                          </p>

                          {item.organizerName && (
                            <p className="round-organizer">
                              Organizator: {item.organizerName}
                            </p>
                          )}

                          <span className="card-link">
                            Deschide centralizatorul →
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <section className="empty panel">
                    <span className="empty-icon">
                      <ClipboardList size={36} />
                    </span>

                    <h2>
                      Prima comandă de grup începe aici.
                    </h2>

                    <p>
                      Creezi comanda fără cont și fără
                      parolă. După creare, acest browser
                      primește automat acces la
                      centralizator.
                    </p>

                    <button
                      className="primary"
                      onClick={startCreate}
                    >
                      <Plus size={18} />
                      Creează comanda de grup
                    </button>

                    <div className="steps">
                      <span>
                        <b>01</b> Produse și prețuri
                      </span>

                      <span>
                        <b>02</b> Distribuie linkul
                      </span>

                      <span>
                        <b>03</b> Vezi centralizatorul
                      </span>
                    </div>
                  </section>
                )}

                <section
                  className="panel"
                  style={{
                    maxWidth: 520,
                    marginTop: 24,
                  }}
                >
                  <h2>Administrator</h2>

                  <p className="muted">
                    Autentificarea este necesară doar
                    pentru accesul la toate comenzile
                    create în aplicație.
                  </p>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setNeedLogin(true);
                      setError('');
                    }}
                  >
                    Acces administrator
                  </button>
                </section>
              </>
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

                  if (!organizerName.trim()) {
                    throw Error(
                      'Completează numele organizatorului.'
                    );
                  }

                  if (
                    (paymentRecipient.trim() &&
                      !paymentLink.trim()) ||
                    (!paymentRecipient.trim() &&
                      paymentLink.trim())
                  ) {
                    throw Error(
                      'Completează atât numele beneficiarului, cât și linkul Revolut.'
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
                    organizerName,
                    currency: orderCurrency,
                    paymentRecipient,
                    paymentLink,
                    products:
                      prepareProducts(orderProducts),
                  });

                  if (
                    typeof data.ownerToken !== 'string' ||
                    !/^[a-f0-9]{64}$/i.test(
                      data.ownerToken
                    )
                  ) {
                    throw Error(
                      'Comanda a fost creată, dar accesul organizatorului nu a putut fi salvat.'
                    );
                  }

                  rememberCreatedRound(
                    data.id,
                    data.ownerToken,
                    title.trim(),
                    orderCurrency,
                    organizerName.trim()
                  );

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

                <DailyMenu
                  currency={
                    selectedRestaurant?.currency ||
                    currency
                  }
                  onApply={applyProducts}
                />

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

                <label className="organizer-field">
                  Numele organizatorului

                  <input
                    required
                    maxLength={80}
                    value={organizerName}
                    onChange={event =>
                      setOrganizerName(
                        event.target.value
                      )
                    }
                    placeholder="Ex. Andrei"
                  />

                  <span className="small muted organizer-help">
                    Va apărea în comandă, astfel încât colegii
                    să știe cine o organizează.
                  </span>
                </label>

                <div className="payment-setup">
                  <div className="section-heading">
                    <div>
                      <h2>Plată prin Revolut</h2>
                      <p className="muted">
                        Opțional. Persoana care plasează comanda
                        finală poate introduce propriul link Revolut.me.
                      </p>
                    </div>
                  </div>

                  <div className="payment-setup-grid">
                    <label>
                      Numele beneficiarului

                      <input
                        maxLength={80}
                        value={paymentRecipient}
                        onChange={event =>
                          setPaymentRecipient(
                            event.target.value
                          )
                        }
                        placeholder="Ex. Gheorghe"
                      />
                    </label>

                    <label>
                      Link Revolut.me

                      <input
                        maxLength={500}
                        type="url"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={paymentLink}
                        onChange={event =>
                          setPaymentLink(
                            event.target.value
                          )
                        }
                        placeholder="https://revolut.me/nume"
                      />
                    </label>
                  </div>

                  <p className="small muted">
                    Dacă completezi plata, introdu ambele câmpuri.
                    După trimiterea comenzii, fiecare coleg va vedea
                    suma sa exactă, codul QR și butonul pentru Revolut.
                  </p>
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
                              product.dailyMenu ||
                              !!product.customDailyMenu
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
                              product.dailyMenu ||
                              !!product.customDailyMenu
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

                    {round.organizer_name && (
                      <p className="round-organizer-header">
                        <strong>Organizator:</strong>{' '}
                        {round.organizer_name}
                      </p>
                    )}

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
                            !product.dailyChoices &&
                            !product.customDailyChoices
                        ).length +
                          (round.products.some(
                            (product: Product) =>
                              product.dailyChoices
                          )
                            ? 1
                            : 0) +
                          (round.products.some(
                            (product: Product) =>
                              product.customDailyChoices
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

                          {round.payment_link && (
                            <div className="payment-box">
                              <div className="payment-box-heading">
                                <div>
                                  <span className="payment-kicker">
                                    PLATĂ
                                  </span>

                                  <h3>
                                    Plătește
                                    {round.payment_recipient
                                      ? ` către ${round.payment_recipient}`
                                      : ''}
                                  </h3>
                                </div>

                                <strong>
                                  {money(total)}
                                </strong>
                              </div>

                              <div className="payment-box-body">
                                <div className="payment-qr">
                                  <img
                                    src={
                                      'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' +
                                      encodeURIComponent(
                                        round.payment_link
                                      )
                                    }
                                    alt="Cod QR pentru linkul Revolut"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>

                                <div className="payment-details">
                                  <p>
                                    Scanează codul QR de pe alt telefon
                                    sau deschide direct linkul Revolut.
                                  </p>

                                  <div className="payment-amount">
                                    <span>Suma de trimis</span>
                                    <strong>
                                      {money(total)}
                                    </strong>
                                  </div>

                                  <div className="payment-actions">
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() =>
                                        copyPaymentAmount()
                                      }
                                    >
                                      <Copy size={16} />
                                      {paymentCopied
                                        ? 'Sumă copiată'
                                        : 'Copiază suma'}
                                    </button>

                                    <a
                                      className="primary payment-link-button"
                                      href={round.payment_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Deschide Revolut
                                    </a>
                                  </div>

                                  <p className="small muted">
                                    Linkul deschide beneficiarul.
                                    Introdu în Revolut suma afișată mai sus
                                    și confirmă transferul.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

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

                              setPaymentCopied(false);
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
                              currency={
                                round.currency
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

                            <button
                              className="secondary print-orders-button"
                              type="button"
                              disabled={
                                busy ||
                                !orders.length
                              }
                              onClick={() =>
                                startPrint('people')
                              }
                            >
                              <Printer size={16} />
                              Tipărește comenzile
                            </button>

                            <button
                              className="secondary"
                              type="button"
                              disabled={
                                busy ||
                                !orders.length
                              }
                              onClick={() =>
                                action(
                                  copyRestaurantMessage
                                )
                              }
                            >
                              <Copy size={16} />
                              Copiază pentru WhatsApp
                            </button>

                            <button
                              className="secondary"
                              type="button"
                              disabled={
                                busy ||
                                !orders.length
                              }
                              onClick={exportExcel}
                            >
                              <FileSpreadsheet
                                size={16}
                              />
                              Export Excel
                            </button>
                          </div>
                        </div>

                        {printMode === 'people' && (
                          <PrintPortal>
                            <section
                          className="print-orders-sheet"
                          aria-label="Comenzi pentru tipărire"
                        >
                          <header className="print-orders-header">
                            <div>
                              <p className="print-orders-kicker">
                                COMANDĂ DE GRUP
                              </p>

                              <h1>
                                {round.title}
                              </h1>

                              {round.organizer_name && (
                                <p className="print-restaurant-organizer">
                                  Organizator:{' '}
                                  {round.organizer_name}
                                </p>
                              )}
                            </div>

                            <div className="print-orders-overview">
                              <div>
                                <span>Persoane</span>
                                <strong>
                                  {orders.length}
                                </strong>
                              </div>

                              <div>
                                <span>Cantitate</span>
                                <strong>
                                  {count} buc.
                                </strong>
                              </div>

                              <div>
                                <span>Total</span>
                                <strong>
                                  {money(allTotal)}
                                </strong>
                              </div>
                            </div>
                          </header>

                          <div className="print-orders-list">
                            {orders.map(
                              (order, orderIndex) => (
                                <article
                                  className="print-person-card"
                                  key={
                                    'print-' +
                                    order.id
                                  }
                                >
                                  <div className="print-person-heading">
                                    <div>
                                      <span className="print-person-number">
                                        {orderIndex + 1}
                                      </span>

                                      <h2>
                                        {order.name}
                                      </h2>
                                    </div>

                                    <div className="print-person-meta">
                                      <span
                                        className={
                                          order.paid
                                            ? 'print-payment-status paid'
                                            : 'print-payment-status'
                                        }
                                      >
                                        {order.paid
                                          ? 'Plătit'
                                          : 'Neplătit'}
                                      </span>

                                      <strong>
                                        {money(
                                          order.total
                                        )}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="print-person-items">
                                    {getOrderGroups(
                                      order
                                    ).map(
                                      (
                                        group,
                                        groupIndex
                                      ) => (
                                        <div
                                          className="print-order-group"
                                          key={`${group.section}-${group.category}-${groupIndex}`}
                                        >
                                          {(group.section ||
                                            group.category) && (
                                            <div className="print-order-category">
                                              {group.section && (
                                                <span>
                                                  {
                                                    group.section
                                                  }
                                                </span>
                                              )}

                                              {group.category && (
                                                <b>
                                                  {
                                                    group.category
                                                  }
                                                </b>
                                              )}
                                            </div>
                                          )}

                                          <ul>
                                            {group.items.map(
                                              (
                                                item: any,
                                                itemIndex: number
                                              ) => (
                                                <li
                                                  key={`${item.name}-${itemIndex}`}
                                                >
                                                  <span>
                                                    {
                                                      item.name
                                                    }
                                                  </span>

                                                  <b>
                                                    {
                                                      item.qty
                                                    }{' '}
                                                    ×
                                                  </b>
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </article>
                              )
                            )}
                          </div>

                          <footer className="print-orders-footer">
                            <span>
                              {orders.length}{' '}
                              persoane
                            </span>

                            <strong>
                              Total:{' '}
                              {money(allTotal)}
                            </strong>
                          </footer>
                            </section>
                          </PrintPortal>
                        )}

                        {printMode ===
                          'restaurant' && (
                          <PrintPortal>
                            <section
                              className="print-restaurant-sheet"
                              aria-label="Rezumat pentru restaurant"
                            >
                              <header className="print-restaurant-header">
                                <div>
                                  <p className="print-orders-kicker">
                                    PENTRU RESTAURANT
                                  </p>

                                  <h1>
                                    {round.title}
                                  </h1>

                                  {round.organizer_name && (
                                    <p className="print-restaurant-organizer">
                                      Organizator:{' '}
                                      {
                                        round.organizer_name
                                      }
                                    </p>
                                  )}
                                </div>

                                <div className="print-restaurant-meta">
                                  <span>
                                    {orders.length}{' '}
                                    persoane
                                  </span>

                                  <strong>
                                    {count} buc.
                                  </strong>
                                </div>
                              </header>

                              <div className="print-restaurant-groups">
                                {getRestaurantSummaryGroups().map(
                                  group => (
                                    <section
                                      className="print-restaurant-group"
                                      key={
                                        group.label
                                      }
                                    >
                                      <h2>
                                        {
                                          group.label
                                        }
                                      </h2>

                                      {group.items.map(
                                        item => (
                                          <div
                                            className="print-restaurant-row"
                                            key={
                                              item.name
                                            }
                                          >
                                            <span>
                                              {
                                                item.name
                                              }
                                            </span>

                                            <strong>
                                              {
                                                item.qty
                                              }{' '}
                                              buc.
                                            </strong>
                                          </div>
                                        )
                                      )}
                                    </section>
                                  )
                                )}
                              </div>

                              <footer className="print-orders-footer">
                                <span>
                                  Fără numele colegilor
                                </span>

                                <strong>
                                  Total comandă:{' '}
                                  {money(
                                    allTotal
                                  )}
                                </strong>
                              </footer>
                            </section>
                          </PrintPortal>
                        )}

                        <div className="summary-grid">
                          <section className="panel">
                            <h2>Pe produse</h2>

                            <p className="muted">
                              Folosește această listă
                              pentru comanda finală.
                            </p>

                            {getSummaryGroups().map(
                              (
                                group,
                                groupIndex
                              ) => (
                                <div
                                  className="summary-product-group"
                                  key={`${group.section}-${group.category}-${groupIndex}`}
                                >
                                  {(group.section ||
                                    group.category) && (
                                    <div className="summary-product-category">
                                      {group.section && (
                                        <span className="summary-product-section">
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

                                  {group.products.map(
                                    (product: Product) => {
                                      const amount =
                                        getProductAmount(
                                          product.id
                                        );

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
                                </div>
                              )
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

                            {round.products.some(
                              (product: Product) =>
                                product.customDailyChoices
                            ) && (
                              <div className="daily-course-summary">
                                <h3>
                                  Meniul zilei — total pe feluri
                                </h3>

                                <p className="small muted">
                                  „Niciunul” nu apare în totaluri.
                                </p>

                                {[
                                  {
                                    key: 'first' as const,
                                    label: 'Felul 1',
                                  },
                                  {
                                    key: 'second' as const,
                                    label: 'Felul 2',
                                  },
                                  {
                                    key: 'dessert' as const,
                                    label: 'Desert',
                                  },
                                ].map(group => {
                                  const totals =
                                    getCustomDailyChoiceTotals(
                                      group.key
                                    );

                                  return totals.length ? (
                                    <div key={group.key}>
                                      <h4>
                                        {group.label}
                                      </h4>

                                      {totals.map(
                                        ([
                                          option,
                                          amount,
                                        ]) => (
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
                                        )
                                      )}
                                    </div>
                                  ) : null;
                                })}
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

                          <section className="panel restaurant-summary-panel">
                            <div className="section-heading">
                              <div>
                                <h2>
                                  Rezumat pentru restaurant
                                </h2>

                                <p className="muted">
                                  Doar preparatele și cantitățile,
                                  fără numele colegilor.
                                </p>
                              </div>

                              <button
                                type="button"
                                className="secondary"
                                disabled={
                                  busy ||
                                  !orders.length
                                }
                                onClick={() =>
                                  action(
                                    copyRestaurantMessage
                                  )
                                }
                              >
                                <Copy size={16} />
                                Copiază pentru WhatsApp
                              </button>
                            </div>

                            <div className="restaurant-summary-grid">
                              {getRestaurantSummaryGroups().map(
                                group => (
                                  <div
                                    className="restaurant-summary-group"
                                    key={
                                      group.label
                                    }
                                  >
                                    <h3>
                                      {group.label}
                                    </h3>

                                    {group.items.map(
                                      item => (
                                        <div
                                          className="restaurant-summary-row"
                                          key={
                                            item.name
                                          }
                                        >
                                          <span>
                                            {
                                              item.name
                                            }
                                          </span>

                                          <strong>
                                            {
                                              item.qty
                                            }{' '}
                                            buc.
                                          </strong>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )
                              )}

                              {!orders.length && (
                                <p className="muted">
                                  Nu există încă produse de
                                  centralizat.
                                </p>
                              )}
                            </div>
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