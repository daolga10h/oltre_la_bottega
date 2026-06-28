-- Run in Supabase Dashboard SQL editor after first login
do $$
declare
  v_customer1 uuid;
  v_customer2 uuid;
begin
  insert into public.customers (name, phone, tags)
  values
    ('Marco Ferretti', '+39 333 1234567', '{ricorrente}'),
    ('Giulia Neri', '+39 345 9876543', '{}');

  select id into v_customer1 from public.customers where name = 'Marco Ferretti';
  select id into v_customer2 from public.customers where name = 'Giulia Neri';

  insert into public.orders (customer_id, title, status, priority, due_date, amount_estimated, payment_status)
  values
    (v_customer1, 'Riparazione borsa pelle', 'in_lavorazione', 'alta', current_date + 2, 80, 'acconto'),
    (v_customer2, 'Cintura su misura', 'nuovo', 'normale', current_date + 7, 120, 'non_pagato'),
    (v_customer1, 'Portafoglio personalizzato', 'pronto', 'urgente', current_date, 60, 'saldato');

  insert into public.reminders (title, due_at)
  values
    ('Chiamare fornitore pelle', now() + interval '2 hours'),
    ('Controllare magazzino fili', now() + interval '1 day');
end;
$$;
