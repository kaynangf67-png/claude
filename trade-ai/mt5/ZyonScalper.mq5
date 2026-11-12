//+------------------------------------------------------------------+
//| ZyonScalper.mq5 — scalper de rompimento da faixa de abertura     |
//| (Trade AI / Zyon). Roda DENTRO do MT5, com os ticks da corretora.|
//|                                                                  |
//| Regra (objetiva, testável no Testador de Estratégias):           |
//|  1. Em cada sessão (Londres e Nova York) marca a máxima e a      |
//|     mínima dos primeiros RangeMinutes minutos.                   |
//|  2. Depois disso, se uma vela de M1 FECHAR acima da máxima       |
//|     (+ folga) compra; abaixo da mínima (- folga) vende.          |
//|  3. Stop no meio da faixa; alvo = TargetR x risco.               |
//|  4. Uma entrada por sessão; zera tudo no fim da janela.          |
//|                                                                  |
//| Proteções: só conta DEMO (o Testador é liberado), spread máximo, |
//| faixa mínima/máxima, limite de operações e de perda por dia,     |
//| lote calculado pelo risco %, teto de lote.                       |
//|                                                                  |
//| HORÁRIOS SÃO DO SERVIDOR DA CORRETORA (o relógio do Market Watch)|
//| Padrão para servidores GMT+2/+3 (a maioria, inclusive            |
//| MetaQuotes-Demo): Londres 10:00, Nova York 16:30.                |
//+------------------------------------------------------------------+
#property copyright "Trade AI / Zyon"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

input group "Sessões (horário do SERVIDOR, HH:MM)"
input bool   UseLondon      = true;
input string LondonStart    = "10:00";  // Abertura de Londres no relógio do servidor
input bool   UseNewYork     = true;
input string NewYorkStart   = "16:30";  // Abertura de Nova York (ações) no relógio do servidor
input int    RangeMinutes   = 15;       // Minutos que formam a faixa de abertura
input int    TradeWindowMin = 90;       // Minutos após a abertura em que ainda pode entrar
input int    FlatAfterMin   = 180;      // Minutos após a abertura em que zera qualquer posição

input group "Entrada e saída"
input double BufferPips     = 0.5;      // Folga além da faixa para confirmar o rompimento
input double MinRangePips   = 5.0;      // Faixa menor que isto = sem operação (ruído)
input double MaxRangePips   = 25.0;     // Faixa maior que isto = stop grande demais para scalp
input double TargetR        = 1.5;      // Alvo em múltiplos do risco

input group "Risco"
input double RiskPct        = 0.5;      // Risco por operação (% do saldo)
input double MaxLots        = 1.0;      // Teto de lote
input double MaxSpreadPips  = 1.5;      // Spread máximo para entrar (pips)
input int    MaxTradesDay   = 2;        // Máximo de entradas por dia
input double DailyLossPct   = 1.5;      // Para de entrar no dia se perder isto (% do saldo do início do dia)
input long   Magic          = 20261113;

CTrade trade;

struct Session { bool on; int startMin; datetime day; double hi, lo; bool rangeOk, traded; string name; };
Session ses[2];
datetime lastBar = 0;
datetime curDay = 0;
double   dayStartBalance = 0;

//--- utilidades ------------------------------------------------------
double PipOf() { int d = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS); return (d == 3 || d == 5) ? _Point * 10.0 : _Point; }
bool   IsTester() { return (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION); }
bool   IsDemo() { return (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO; }
datetime DayOf(const datetime t) { return t - (t % 86400); }

int ParseHM(const string s)
{
   string p[]; if(StringSplit(s, ':', p) != 2) return -1;
   int h = (int)StringToInteger(p[0]), m = (int)StringToInteger(p[1]);
   if(h < 0 || h > 23 || m < 0 || m > 59) return -1;
   return h * 60 + m;
}

bool HasPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   { ulong t = PositionGetTicket(i); if(t > 0 && PositionGetInteger(POSITION_MAGIC) == Magic && PositionGetString(POSITION_SYMBOL) == _Symbol) return true; }
   return false;
}

void CloseAll(const string why)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionGetInteger(POSITION_MAGIC) == Magic && PositionGetString(POSITION_SYMBOL) == _Symbol)
      { if(trade.PositionClose(t)) PrintFormat("ZyonScalper: posição %I64u zerada (%s)", t, why); }
   }
}

/** Resultado do dia (fechadas + abertas) e quantas entradas o robô fez hoje. */
void DayStats(double &pnl, int &entries)
{
   pnl = 0; entries = 0;
   if(HistorySelect(curDay, TimeCurrent() + 60))
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
      {
         ulong d = HistoryDealGetTicket(i);
         if(d == 0 || HistoryDealGetInteger(d, DEAL_MAGIC) != Magic || HistoryDealGetString(d, DEAL_SYMBOL) != _Symbol) continue;
         long e = HistoryDealGetInteger(d, DEAL_ENTRY);
         if(e == DEAL_ENTRY_IN) entries++;
         pnl += HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_COMMISSION) + HistoryDealGetDouble(d, DEAL_SWAP);
      }
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   { ulong t = PositionGetTicket(i); if(t > 0 && PositionGetInteger(POSITION_MAGIC) == Magic && PositionGetString(POSITION_SYMBOL) == _Symbol) pnl += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP); }
}

//--- ciclo de vida ---------------------------------------------------
int OnInit()
{
   if(!IsTester() && !IsDemo()) { Alert("ZyonScalper: conta REAL detectada. Este robô só opera em conta DEMO (ou no Testador de Estratégias)."); return INIT_FAILED; }
   ses[0].on = UseLondon;  ses[0].startMin = ParseHM(LondonStart);  ses[0].name = "Londres";
   ses[1].on = UseNewYork; ses[1].startMin = ParseHM(NewYorkStart); ses[1].name = "Nova York";
   for(int i = 0; i < 2; i++) if(ses[i].on && ses[i].startMin < 0) { Alert("ZyonScalper: horário inválido em ", ses[i].name, " (use HH:MM)."); return INIT_PARAMETERS_INCORRECT; }
   if(RangeMinutes < 5 || TradeWindowMin <= RangeMinutes || FlatAfterMin < TradeWindowMin || TargetR <= 0 || RiskPct <= 0 || RiskPct > 2 || MinRangePips >= MaxRangePips)
   { Alert("ZyonScalper: parâmetros inconsistentes (veja os limites no docs/MT5-SCALPER.md)."); return INIT_PARAMETERS_INCORRECT; }
   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(20);
   PrintFormat("ZyonScalper: iniciado em %s (%s). Sessões no horário do servidor.", _Symbol, IsTester() ? "Testador" : "DEMO");
   return INIT_SUCCEEDED;
}

void OnTick()
{
   datetime now = TimeCurrent();
   datetime today = DayOf(now);
   if(today != curDay) { curDay = today; dayStartBalance = AccountInfoDouble(ACCOUNT_BALANCE); }

   // zerar no fim da janela de cada sessão
   for(int i = 0; i < 2; i++)
      if(ses[i].on && now >= today + ses[i].startMin * 60 + FlatAfterMin * 60 && now < today + ses[i].startMin * 60 + FlatAfterMin * 60 + 300 && HasPosition())
         CloseAll("fim da janela de " + ses[i].name);

   // decisões só no fechamento de cada vela de M1
   datetime bar = iTime(_Symbol, PERIOD_M1, 0);
   if(bar == 0 || bar == lastBar) return;
   lastBar = bar;

   for(int i = 0; i < 2; i++)
   {
      if(!ses[i].on) continue;
      datetime start = today + ses[i].startMin * 60, rangeEnd = start + RangeMinutes * 60, tradeEnd = start + TradeWindowMin * 60;
      if(ses[i].day != today) { ses[i].day = today; ses[i].rangeOk = false; ses[i].traded = false; ses[i].hi = 0; ses[i].lo = 0; }
      if(now < rangeEnd || now >= tradeEnd || ses[i].traded) continue;

      // monta a faixa uma vez por sessão
      if(!ses[i].rangeOk)
      {
         MqlRates r[]; int n = CopyRates(_Symbol, PERIOD_M1, start, rangeEnd - 1, r);
         if(n < (int)(RangeMinutes * 0.8)) { ses[i].traded = true; PrintFormat("ZyonScalper: %s sem velas suficientes na faixa (%d).", ses[i].name, n); continue; }
         double hi = r[0].high, lo = r[0].low;
         for(int k = 1; k < n; k++) { hi = MathMax(hi, r[k].high); lo = MathMin(lo, r[k].low); }
         double sizePips = (hi - lo) / PipOf();
         if(sizePips < MinRangePips || sizePips > MaxRangePips) { ses[i].traded = true; PrintFormat("ZyonScalper: %s faixa de %.1f pips fora de %.1f–%.1f: sem operação.", ses[i].name, sizePips, MinRangePips, MaxRangePips); continue; }
         ses[i].hi = hi; ses[i].lo = lo; ses[i].rangeOk = true;
      }

      // vela de M1 que acabou de fechar
      MqlRates c[]; if(CopyRates(_Symbol, PERIOD_M1, 1, 1, c) != 1 || c[0].time < rangeEnd) continue;
      double pip = PipOf(), buf = BufferPips * pip;
      bool up = c[0].close > ses[i].hi + buf, down = c[0].close < ses[i].lo - buf;
      if(!up && !down) continue;
      Enter(i, up);
   }
}

void Enter(const int i, const bool buy)
{
   if(HasPosition()) return;
   double pnl; int entries; DayStats(pnl, entries);
   if(entries >= MaxTradesDay) { ses[i].traded = true; Print("ZyonScalper: limite de entradas do dia atingido."); return; }
   if(dayStartBalance > 0 && pnl <= -dayStartBalance * DailyLossPct / 100.0) { ses[i].traded = true; Print("ZyonScalper: limite de perda do dia atingido."); return; }

   MqlTick t; if(!SymbolInfoTick(_Symbol, t) || t.ask <= 0 || t.bid <= 0) return;
   double pip = PipOf(), spread = (t.ask - t.bid) / pip;
   if(spread > MaxSpreadPips) { PrintFormat("ZyonScalper: spread %.1f pips acima de %.1f; aguardando.", spread, MaxSpreadPips); return; } // tenta de novo na próxima vela

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double price = buy ? t.ask : t.bid;
   double sl = (ses[i].hi + ses[i].lo) / 2.0;
   double risk = buy ? price - sl : sl - price;
   if(risk <= 0) return;
   // rompimento que já correu demais (ex.: spread atrasou a entrada): o stop ficaria grande para um scalp
   if(risk / pip > MaxRangePips) { ses[i].traded = true; PrintFormat("ZyonScalper: preço já %.1f pips longe do stop; entrada perdida.", risk / pip); return; }
   double tp = buy ? price + TargetR * risk : price - TargetR * risk;
   double stopsLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   if(risk < stopsLevel || TargetR * risk < stopsLevel) { ses[i].traded = true; Print("ZyonScalper: stop mais perto do que a corretora permite."); return; }

   double lossPerLot = 0;
   if(!OrderCalcProfit(buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, _Symbol, 1.0, price, sl, lossPerLot) || lossPerLot >= 0) { Print("ZyonScalper: não consegui calcular o risco por lote."); return; }
   double riskMoney = AccountInfoDouble(ACCOUNT_BALANCE) * RiskPct / 100.0;
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP), vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), vmax = MathMin(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX), MaxLots);
   double lots = MathFloor((riskMoney / MathAbs(lossPerLot)) / step) * step;
   if(lots < vmin) { ses[i].traded = true; PrintFormat("ZyonScalper: lote mínimo arriscaria mais que %.2f%%.", RiskPct); return; }
   lots = NormalizeDouble(MathMin(lots, vmax), (int)MathMax(0, MathCeil(-MathLog10(step))));

   string cm = StringFormat("ZS %s", ses[i].name);
   bool ok = buy ? trade.Buy(lots, _Symbol, 0.0, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits), cm)
                 : trade.Sell(lots, _Symbol, 0.0, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits), cm);
   uint rc = trade.ResultRetcode();
   ses[i].traded = true; // uma tentativa por sessão, mesmo se a corretora recusar
   if(!ok || (rc != TRADE_RETCODE_DONE && rc != TRADE_RETCODE_PLACED && rc != TRADE_RETCODE_DONE_PARTIAL))
      PrintFormat("ZyonScalper: corretora recusou (%u: %s)", rc, trade.ResultRetcodeDescription());
   else
      PrintFormat("ZyonScalper: %s %s %.2f lote(s) a %s, stop %s, alvo %s (faixa %.1f pips, spread %.1f)", ses[i].name, buy ? "COMPRA" : "VENDA", lots,
                  DoubleToString(trade.ResultPrice(), digits), DoubleToString(sl, digits), DoubleToString(tp, digits), (ses[i].hi - ses[i].lo) / pip, spread);
}
