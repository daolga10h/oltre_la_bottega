-- Traccia quando un promemoria è stato completato, per tenerlo visibile
-- (con spunta verde) fino a fine giornata e nasconderlo automaticamente il giorno dopo.
alter table public.reminders
  add column if not exists completed_at timestamptz;
