import { createClient } from '@supabase/supabase-js';
import { createCaktoHandler } from './handler.ts';

// This server-to-server webhook has its own HMAC authentication, not Google OAuth/CORS.
// Keep it disabled until the database, product IDs and webhook secret are configured.
const enabled = Deno.env.get('CAKTO_CAPTURE_ENABLED') === 'true';
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const service =
  enabled && url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

Deno.serve(
  createCaktoHandler({
    enabled: enabled && service !== null,
    secret: Deno.env.get('CAKTO_WEBHOOK_SECRET') ?? '',
    productIds: (Deno.env.get('CAKTO_PRODUCT_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    capture: async (events) => {
      const { error } = await service!.rpc('cakto_capture_events', { events });
      if (error) throw new Error('Capture failed');
    },
    ...(Deno.env.get('CAKTO_PROCESSING_ENABLED') === 'true'
      ? {
          process: async () => {
            const { error } = await service!.rpc('cakto_process_pending', {
              apply_changes: true,
              batch_limit: 20,
            });
            if (error) throw new Error('Processing pending');
          },
        }
      : {}),
  }),
);
