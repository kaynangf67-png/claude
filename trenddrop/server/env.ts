// Lê variáveis de ambiente do servidor. Nunca importar a partir de src/.
const read = (key: string) => {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
};

export const serverEnv = {
  get serpApiKey() { return read('SERPAPI_KEY'); },
  get mlClientId() { return read('ML_CLIENT_ID'); },
  get mlClientSecret() { return read('ML_CLIENT_SECRET'); },
  get mlRefreshToken() { return read('ML_REFRESH_TOKEN'); },
  get mlAccessToken() { return read('ML_ACCESS_TOKEN'); },
  get shopeeAppId() { return read('SHOPEE_AFFILIATE_APP_ID'); },
  get shopeeSecret() { return read('SHOPEE_AFFILIATE_SECRET'); },
  get supabaseUrl() { return read('SUPABASE_URL') ?? read('VITE_SUPABASE_URL'); },
  get supabaseServiceKey() { return read('SUPABASE_SERVICE_ROLE_KEY'); },
  get cronSecret() { return read('CRON_SECRET'); },
  get syncTerms() {
    return (read('SYNC_TERMS') ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);
  },
};
