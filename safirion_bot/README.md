# Safirion Auto-Bot — M1

## Setup

```bash
cd safirion_bot
pip install -r requirements.txt
playwright install chromium
```

## Configuração

Abra `config.py` e preencha:

```python
EMAIL    = "seu@email.com"
PASSWORD = "sua_senha"
ASSET    = "EURUSD"        # ou GBPUSD, BTCUSD, XAUUSD...
```

Se os botões não aparecerem, inspecione o HTML da Safirion (F12)
e atualize os seletores `SEL_CALL_BTN` / `SEL_PUT_BTN` / `SEL_AMOUNT`.

## Rodar

```bash
python main.py
```

## Indicadores (5 camadas)

| # | Indicador | CALL | PUT |
|---|-----------|------|-----|
| 1 | EMA 9/21 crossover | cruza pra cima | cruza pra baixo |
| 2 | RSI 14 | < 30 (sobrevend.) | > 70 (sobrecomp.) |
| 3 | Estocástico 5,3 | K cruza D pra cima na zona OS | K cruza D pra baixo na zona OB |
| 4 | Bollinger Bands 20 | preço toca banda inferior | preço toca banda superior |
| 5 | Preço vs EMAs | preço > EMA9 > EMA21 | preço < EMA9 < EMA21 |

**Mínimo 3 de 5** confirmações para entrar.
