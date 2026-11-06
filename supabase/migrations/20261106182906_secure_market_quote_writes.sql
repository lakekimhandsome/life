-- Only server-verified quotes may enter the shared cache.
drop policy if exists life_market_quotes_insert_authenticated on public.life_market_quotes;
drop policy if exists life_market_quotes_update_authenticated on public.life_market_quotes;
drop policy if exists market_quotes_insert_authenticated on public.life_market_quotes;
drop policy if exists market_quotes_update_authenticated on public.life_market_quotes;
revoke insert, update on public.life_market_quotes from public, anon, authenticated;

