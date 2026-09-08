# Comandă de grup — versiune pentru Vercel

Interfață în română pentru comenzi la serviciu. Organizatorul adaugă produse și prețuri, copiază linkul, iar colegii aleg produsele, cantitatea și numele. Centralizatorul arată cantitățile pe produse, sumele pe persoane și totalul general.

**Acesta este un proiect Next.js pentru Vercel, cu salvare în Supabase. Nu este un fișier HTML care funcționează prin dublu clic.** Nu depinde de ChatGPT sau Cloudflare. Descarcă și dezarhivează arhiva înainte de instalare.

## 1. Creează baza de date

1. Deschide https://supabase.com/dashboard și creează un proiect nou.
2. În proiect, deschide **SQL Editor → New query**.
3. Deschide fișierul `supabase/setup.sql` din această arhivă într-un editor de text.
4. Copiază întregul conținut în SQL Editor și apasă **Run**. Rulează fișierul o singură dată, într-un proiect nou; el creează tabelele și funcția de salvare.
5. Copiază **Project URL** din setările API ale proiectului (sau din fereastra Connect).
6. Din setările **API Keys**, copiază o cheie **Secret** (`sb_secret_...`). Este o cheie pentru server; nu folosi cheia Publishable. Este acceptată și o cheie legacy `service_role`.

Numele și comenzile colegilor sunt stocate în acest proiect Supabase. Datele existente în vechea variantă ChatGPT nu se transferă automat.

## 2. Încarcă proiectul în GitHub

1. Creează un repository nou, de exemplu `comanda-grup`.
2. Încarcă fișierele și directoarele **din interiorul** folderului dezarhivat. `package.json`, `README.md`, `app/` și `supabase/` trebuie să fie în rădăcina repository-ului.
3. Nu încărca doar ZIP-ul. Nu încărca `node_modules`, `.next` sau fișiere cu parole.

## 3. Publică pe Vercel

1. Intră în https://vercel.com/new și conectează GitHub.
2. Alege repository-ul creat și apasă **Import**.
3. Framework: **Next.js**. Root Directory: folderul care conține `package.json`.
4. Păstrează comenzile din proiect: Build Command `npm run build`; Output Directory implicit. Nu alege export static.
5. În **Environment Variables**, adaugă:

| Variabilă | Valoare |
|---|---|
| `SUPABASE_URL` | Project URL, de forma `https://...supabase.co` |
| `SUPABASE_SECRET_KEY` | Cheia Secret din Supabase, începând cu `sb_secret_` |
| `ADMIN_PASSWORD` | O parolă unică de minimum 12 caractere; recomandat 20+ caractere aleatoare |
| `SESSION_SECRET` | Un șir aleator de minimum 32 de caractere, diferit de parolă |

Aceste variabile sunt doar pentru server. **Nu adăuga prefixul `NEXT_PUBLIC_` și nu pune valorile în GitHub.** Alege mediul Production; adaugă-le și în Preview dacă dorești să testezi acolo.

Pentru a genera local un secret, dacă ai Node.js instalat:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

6. Apasă **Deploy**. Deschide adresa de producție `https://...vercel.app` după finalizare.
7. Dacă schimbi ulterior variabilele, fă **Redeploy** ca noua versiune să le folosească.
8. Verifică **Settings → Deployment Protection**: adresa de producție destinată colegilor trebuie să permită acces public. Testează linkul într-o fereastră privată; nu ar trebui să ceară cont Vercel.

## 4. Folosire

1. Organizatorul deschide pagina principală și introduce `ADMIN_PASSWORD`.
2. Apasă **Comandă de grup nouă**, completează titlul, produsele și prețurile. Butonul **Adaugă 8 sortimente de clătite** completează numele; prețurile le introduci tu.
3. Salvează, apoi apasă **Copiază linkul de comandă**.
4. Trimite colegilor acest link. Ei nu au nevoie de cont sau parolă: bifează, completează cantitatea și numele, apoi apasă **Trimite comanda**.
5. Organizatorul vede **Centralizator → Pe produse / Pe persoane**. Folosește **Actualizează** pentru comenzile noi.
6. **Închide comanda** oprește comenzile noi; **Redeschide comanda** le permite din nou.
7. La final, pe pagina principală, apasă **Ieșire organizator**, mai ales pe un calculator comun.

Această versiune are **o parolă comună de organizator**. Oricine o cunoaște poate administra toate listele; nu este un sistem cu conturi individuale de organizator. Colegii care au doar linkul nu pot vedea numele și comenzile celorlalți și nu pot schimba lista. Sesiunea organizatorului expiră după 7 zile. Pentru a invalida imediat toate sesiunile, schimbă `SESSION_SECRET` și republică.

Prețurile sunt fixe după crearea listei. Pentru alte prețuri, creează o listă nouă. Numele nu reprezintă identități verificate: doi colegi pot folosi același nume. Reîncercarea aceleiași trimiteri nu dublează comanda, dar o comandă nouă intenționată este înregistrată separat.

## Alternativă: publicare fără GitHub, cu Vercel CLI

După dezarhivare, deschide un terminal în folderul proiectului:

```sh
npm install
npx vercel
```

Autentifică-te și urmează pașii de conectare a proiectului. Prima publicare poate arăta că baza de date nu este configurată. Adaugă cele patru variabile în proiectul Vercel, apoi:

```sh
npx vercel --prod
```

## Rulare locală

Ai nevoie de Node.js 22.13 sau mai nou, compatibil cu Next.js. Copiază `.env.example` ca `.env.local` și completează cele patru valori. Folosește același proiect Supabase configurat la pasul 1.

```sh
npm install
npm run dev
```

Deschide `http://localhost:3000`. Comanda de verificare pentru producție este `npm run build`.

## Verificări și limite

- Compilarea Next.js și verificarea TypeScript au fost executate cu succes.
- Testul opțional `node tests/smoke.mjs` verifică rutele cu un Supabase simulat, după build. Execuția lui nu a putut fi confirmată în mediul de pregătire; nu înlocuiește proba cu baza ta reală.
- Aplicația folosește PostgreSQL/Supabase, fără stocare temporară pe discul Vercel.
- Funcția SQL recalculează totalurile din prețurile salvate și serializează trimiterea cu închiderea comenzii.
- Cheia Supabase rămâne în rutele de server. Accesul direct la tabele și funcție este blocat pentru utilizatorii anonimi.
- Publicarea în contul tău Vercel și conectarea la proiectul tău Supabase trebuie finalizate de tine. Nu au fost testate cu datele tale de conectare.
- Aplicația este destinată unei echipe care primește linkul. Formularele publice nu includ CAPTCHA; nu posta linkurile pe site-uri cu trafic mare fără protecție suplimentară.

## Documentație oficială

- Vercel, import din GitHub: https://vercel.com/docs/git/vercel-for-github
- Vercel, variabile: https://vercel.com/docs/environment-variables/managing-environment-variables
- Vercel CLI: https://vercel.com/docs/cli/deploy
- Supabase, SQL și funcții: https://supabase.com/docs/guides/database/functions
- Supabase, chei API: https://supabase.com/docs/guides/getting-started/api-keys
