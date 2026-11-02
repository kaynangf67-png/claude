
# ─── CONFIGURAÇÃO ───────────────────────────────────────────────
BROKER_URL      = "https://safirion.com"           # URL da corretora
ENTRY_AMOUNT    = 1000                              # valor por entrada (R$ 1.000)
EXPIRY_MINUTES  = 1                                 # expiração M1
ASSET           = "EURUSD"                          # ativo padrão

# credenciais (preencha antes de rodar)
EMAIL           = "SEU_EMAIL_AQUI"
PASSWORD        = "SUA_SENHA_AQUI"

# seletores CSS/XPath da Safirion (inspecione e ajuste se necessário)
SEL_EMAIL       = 'input[name="email"], input[type="email"]'
SEL_PASSWORD    = 'input[name="password"], input[type="password"]'
SEL_LOGIN_BTN   = 'button[type="submit"]'
SEL_AMOUNT      = 'input[data-testid="amount"], .trade-amount input, input[placeholder*="valor"], input[placeholder*="amount"]'
SEL_CALL_BTN    = 'button.call-btn, button[data-direction="call"], .btn-up, button:has-text("CALL"), button:has-text("COMPRA"), button:has-text("CIMA")'
SEL_PUT_BTN     = 'button.put-btn,  button[data-direction="put"],  .btn-down, button:has-text("PUT"),  button:has-text("VENDA"), button:has-text("BAIXO")'
SEL_EXPIRY      = 'select[name="expiry"], .expiry-select, [data-testid="expiry"]'

# parâmetros de indicadores
EMA_FAST        = 9
EMA_SLOW        = 21
RSI_PERIOD      = 14
RSI_OB          = 70
RSI_OS          = 30
STOCH_K         = 5
STOCH_D         = 3
STOCH_OB        = 80
STOCH_OS        = 20
BB_PERIOD       = 20
BB_STD          = 2.0
ATR_PERIOD      = 14
MIN_ATR_RATIO   = 0.0003  # volatilidade mínima (filtro de mercado lateral)

# quantas confirmações simultâneas para entrar
MIN_SIGNALS     = 3       # de 5 indicadores disponíveis
