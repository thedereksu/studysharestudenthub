-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the Sage AI automatic posting job
-- This job will call the 'fill-knowledge-gaps' Edge Function
-- Replace '<YOUR_SUPABASE_ANON_KEY_OR_SERVICE_ROLE_KEY>' with a valid key
-- The cron expression '0 */6 * * *' means 'at minute 0 past every 6th hour'
-- You can adjust the schedule as needed.
SELECT cron.schedule(
    'sage-ai-auto-post',
    '0 */6 * * *', -- Example: Run every 6 hours
    'SELECT net.http_post(
        ''https://vanhfllipocroenismcf.supabase.co/functions/v1/fill-knowledge-gaps'',''
        ''{}''::jsonb,
        ARRAY[
            ''Content-Type: application/json'',''
            ''Authorization: Bearer <YOUR_SUPABASE_ANON_KEY_OR_SERVICE_ROLE_KEY>''
        ]
    );'
);
