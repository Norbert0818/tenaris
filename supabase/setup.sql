-- Rulează o singură dată în SQL Editor, într-un proiect Supabase nou.
begin;
create table public.rounds (
 id uuid primary key,
 title text not null check(char_length(title) between 1 and 100),
 currency text not null check(currency in ('RON','HUF','EUR')),
 products jsonb not null check(jsonb_typeof(products)='array'),
 closed boolean not null default false,
 created timestamptz not null default now()
);
create table public.orders (
 id uuid primary key,
 round_id uuid not null references public.rounds(id),
 name text not null check(char_length(name) between 1 and 80),
 items jsonb not null,
 total bigint not null check(total>=0),
 created timestamptz not null default now()
);
create index idx_orders_round on public.orders(round_id,created desc);
alter table public.rounds enable row level security;
alter table public.orders enable row level security;
revoke all on public.rounds,public.orders from anon,authenticated;
grant select,insert,update,delete on public.rounds,public.orders to service_role;
-- Calculează prețurile pe server și blochează rândul pentru a preveni
-- o comandă simultană cu închiderea listei. Reîncercările nu dublează comanda.
create function public.submit_order(p_round_id uuid,p_order_id uuid,p_name text,p_items jsonb)
returns bigint language plpgsql security invoker set search_path=public as $$
declare r public.rounds%rowtype; existing public.orders%rowtype; item jsonb; product jsonb; quantity integer; amount bigint:=0; saved_items jsonb:='[]'::jsonb; seen text[]:='{}';
begin
 select * into r from public.rounds where id=p_round_id for update;
 if not found then raise exception 'Comanda nu a fost găsită.'; end if;
 select * into existing from public.orders where id=p_order_id;
 if found then
   if existing.round_id<>p_round_id then raise exception 'Identificator de comandă nevalid.'; end if;
   return existing.total;
 end if;
 if r.closed then raise exception 'Această comandă este închisă.'; end if;
 if char_length(trim(p_name)) not between 1 and 80 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Date de comandă nevalide.'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
   if item->>'id'=any(seen) then raise exception 'Produs duplicat.'; end if;
   seen:=array_append(seen,item->>'id');
   select value into product from jsonb_array_elements(r.products) where value->>'id'=item->>'id';
   if product is null then raise exception 'Produsul nu există.'; end if;
   if not coalesce((item->>'qty') ~ '^[0-9]{1,3}$',false) then raise exception 'Cantitate nevalidă.'; end if;
   quantity:=(item->>'qty')::integer;
   if quantity not between 1 and 999 then raise exception 'Cantitatea trebuie să fie între 1 și 999.'; end if;
   amount:=amount+(product->>'price')::bigint*quantity;
   saved_items:=saved_items||jsonb_build_array(product||jsonb_build_object('qty',quantity));
 end loop;
 insert into public.orders(id,round_id,name,items,total) values(p_order_id,p_round_id,trim(p_name),saved_items,amount);
 return amount;
end;
$$;
revoke all on function public.submit_order(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_order(uuid,uuid,text,jsonb) to service_role;
commit;
