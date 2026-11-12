//+------------------------------------------------------------------+
//| ZyonBridge.mq5 — ponte entre a mesa Zyon (Trade AI) e o MT5      |
//| Executa SOMENTE ordens aprovadas pelo Risk Guard da mesa.        |
//| SOMENTE CONTA DEMO: recusa iniciar e operar em conta real.       |
//| Não guarda nem envia a senha da conta: usa o terminal já logado. |
//+------------------------------------------------------------------+
#property copyright "Trade AI / Zyon"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

input string ApiBase       = "https://trade-ai-five.vercel.app"; // Endereço do Trade AI (liberar em Ferramentas > Opções > Expert Advisors)
input string BridgeToken   = "";      // Token da ponte (o mesmo valor de MT5_BRIDGE_TOKEN na Vercel)
input string SymbolSuffix  = "";      // Sufixo dos símbolos da corretora (ex.: ".m", "-ECN"); vazio se não houver
input int    PollSeconds   = 10;      // Intervalo de consulta à mesa (segundos)
input double MaxSpreadPips = 2.5;     // Spread máximo aceito para entrar (pips)
input double MaxSlipPips   = 3.0;     // Distância máxima entre o preço atual e o da análise (pips)
input double MaxLots       = 1.0;     // Teto de lote por ordem (proteção extra)
input long   Magic         = 20261112;

#define EA_VERSION "1.0"
CTrade trade;

//--- utilidades ------------------------------------------------------
double PipOf(const string sym) { int d = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS); double p = SymbolInfoDouble(sym, SYMBOL_POINT); return (d == 3 || d == 5) ? p * 10.0 : p; }
bool   IsDemo() { return (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO; }
string ModeName() { ENUM_ACCOUNT_TRADE_MODE m = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE); return m == ACCOUNT_TRADE_MODE_DEMO ? "DEMO" : (m == ACCOUNT_TRADE_MODE_CONTEST ? "CONTEST" : "REAL"); }
string GvDone(const string id) { return "ZY_" + id; }   // ordem já tratada (idempotência, sobrevive a reinício do terminal)
string GvHold(const string id) { return "ZYH_" + id; }  // prazo máximo da posição

string UrlEncode(const string s)
{
   string out = ""; uchar b[]; int n = StringToCharArray(s, b, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   for(int i = 0; i < n; i++)
   {
      uchar c = b[i];
      if((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '-' || c == '_' || c == '.') out += CharToString(c);
      else out += StringFormat("%%%02X", c);
   }
   return out;
}

// POST em texto (application/x-www-form-urlencoded). Devolve o código HTTP; -1 = WebRequest falhou (URL não liberada, sem rede).
int Post(const string action, const string body, string &response)
{
   string url = ApiBase + "/api/agent?action=" + action;
   string headers = "Content-Type: application/x-www-form-urlencoded\r\nAuthorization: Bearer " + BridgeToken + "\r\n";
   uchar data[]; int n = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8); if(n > 0) ArrayResize(data, n - 1);
   uchar result[]; string resHeaders;
   ResetLastError();
   int code = WebRequest("POST", url, headers, 8000, data, result, resHeaders);
   if(code == -1) { PrintFormat("ZyonBridge: WebRequest falhou (erro %d). Libere %s em Ferramentas > Opções > Expert Advisors.", GetLastError(), ApiBase); response = ""; return -1; }
   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return code;
}

void Report(const string id, const string type, const string extra)
{
   string res; int code = Post("mt5-report", "id=" + UrlEncode(id) + "&type=" + type + extra, res);
   if(code != 200) PrintFormat("ZyonBridge: relatório %s de %s respondeu %d: %s", type, id, code, res);
}

int CountMine()
{
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if(t > 0 && PositionGetInteger(POSITION_MAGIC) == Magic) n++; }
   return n;
}

//--- ciclo de vida ----------------------------------------------------
int OnInit()
{
   if(!IsDemo()) { Alert("ZyonBridge: esta conta NÃO é demo. O robô só opera em conta DEMO e não vai iniciar."); return INIT_FAILED; }
   if(StringLen(BridgeToken) < 12) { Alert("ZyonBridge: informe o BridgeToken (o mesmo valor de MT5_BRIDGE_TOKEN na Vercel)."); return INIT_PARAMETERS_INCORRECT; }
   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(30);
   EventSetTimer(MathMax(5, PollSeconds));
   Print("ZyonBridge ", EA_VERSION, " iniciado em conta DEMO: ", AccountInfoString(ACCOUNT_SERVER));
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer()
{
   if(!IsDemo()) return;          // segunda trava: nunca opera fora de demo
   CloseExpired();
   Poll();
}

//--- consulta a mesa e executa as ordens entregues ---------------------
void Poll()
{
   string body = "mode=" + ModeName() + "&server=" + UrlEncode(AccountInfoString(ACCOUNT_SERVER)) + "&currency=" + AccountInfoString(ACCOUNT_CURRENCY)
               + "&balance=" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + "&equity=" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2)
               + "&open=" + IntegerToString(CountMine()) + "&ea=" + EA_VERSION;
   string res; int code = Post("mt5-poll", body, res);
   if(code != 200) { if(code != -1) PrintFormat("ZyonBridge: a mesa respondeu %d: %s", code, res); return; }
   string lines[]; int n = StringSplit(res, '\n', lines);
   for(int i = 0; i < n; i++)
   {
      string f[]; if(StringSplit(lines[i], '|', f) < 9 || f[0] != "ORDER") continue;
      Execute(f[1], f[2], f[3], StringToDouble(f[4]), StringToDouble(f[5]), StringToDouble(f[6]), StringToDouble(f[7]), (int)StringToInteger(f[8]));
   }
}

void Reject(const string id, const string reason) { GlobalVariableSet(GvDone(id), 2); Print("ZyonBridge: ", id, " rejeitada: ", reason); Report(id, "rejected", "&reason=" + UrlEncode(reason)); }

void Execute(const string id, const string baseSymbol, const string dir, const double refEntry, const double sl, const double tp, const double riskPct, const int maxHoldS)
{
   if(GlobalVariableCheck(GvDone(id))) return;                       // já tratada: nunca executa duas vezes
   GlobalVariableSet(GvDone(id), 0);                                 // marca ANTES de enviar (se cair no meio, não repete)
   string sym = baseSymbol + SymbolSuffix;
   if(!SymbolSelect(sym, true)) { Reject(id, "símbolo " + sym + " não existe nesta corretora (ajuste o SymbolSuffix)"); return; }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED)) { Reject(id, "negociação automática desligada no terminal (botão Algo Trading)"); return; }
   if(dir != "BUY" && dir != "SELL") { Reject(id, "direção inválida"); return; }
   bool buy = (dir == "BUY");
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   { ulong t = PositionGetTicket(i); if(t > 0 && PositionGetInteger(POSITION_MAGIC) == Magic && PositionGetString(POSITION_SYMBOL) == sym) { Reject(id, "já existe posição do robô em " + sym); return; } }

   MqlTick tick; if(!SymbolInfoTick(sym, tick) || tick.ask <= 0 || tick.bid <= 0) { Reject(id, "sem cotação de " + sym); return; }
   double pip = PipOf(sym), price = buy ? tick.ask : tick.bid;
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double spreadPips = (tick.ask - tick.bid) / pip;
   if(spreadPips > MaxSpreadPips) { Reject(id, StringFormat("spread de %.1f pips acima do máximo %.1f", spreadPips, MaxSpreadPips)); return; }
   if(MathAbs(price - refEntry) / pip > MaxSlipPips) { Reject(id, StringFormat("preço andou %.1f pips desde a análise (máximo %.1f)", MathAbs(price - refEntry) / pip, MaxSlipPips)); return; }
   if(sl <= 0 || tp <= 0 || (buy && !(sl < price && price < tp)) || (!buy && !(tp < price && price < sl))) { Reject(id, "stop ou alvo do lado errado do preço atual"); return; }
   double stopsLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(sym, SYMBOL_POINT);
   if(MathAbs(price - sl) < stopsLevel || MathAbs(tp - price) < stopsLevel) { Reject(id, "stop ou alvo mais perto do que a corretora permite"); return; }

   // lote pelo risco: quanto 1 lote perde se bater no stop (inclui conversão para a moeda da conta)
   double lossPerLot = 0.0;
   if(!OrderCalcProfit(buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, sym, 1.0, price, sl, lossPerLot) || lossPerLot >= 0) { Reject(id, "não consegui calcular o risco por lote"); return; }
   double riskMoney = AccountInfoDouble(ACCOUNT_BALANCE) * riskPct / 100.0;
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), vmin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), vmax = MathMin(SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX), MaxLots);
   double lots = MathFloor((riskMoney / MathAbs(lossPerLot)) / step) * step;
   if(lots < vmin) { Reject(id, StringFormat("o lote mínimo (%.2f) arriscaria mais que %.2f%% do saldo", vmin, riskPct)); return; }
   lots = MathMin(lots, vmax);
   int volDigits = (int)MathMax(0, MathCeil(-MathLog10(step)));
   lots = NormalizeDouble(lots, volDigits);

   bool sent = buy ? trade.Buy(lots, sym, 0.0, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits), id)
                   : trade.Sell(lots, sym, 0.0, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits), id);
   uint rc = trade.ResultRetcode();
   if(!sent || (rc != TRADE_RETCODE_DONE && rc != TRADE_RETCODE_PLACED && rc != TRADE_RETCODE_DONE_PARTIAL))
   { Reject(id, StringFormat("corretora recusou (código %u: %s)", rc, trade.ResultRetcodeDescription())); return; }

   GlobalVariableSet(GvDone(id), 1);
   GlobalVariableSet(GvHold(id), (double)(TimeCurrent() + maxHoldS));
   PrintFormat("ZyonBridge: %s %s %.2f lote(s) de %s a %s", id, dir, trade.ResultVolume(), sym, DoubleToString(trade.ResultPrice(), digits));
   Report(id, "executed", "&ticket=" + IntegerToString((long)trade.ResultOrder()) + "&price=" + DoubleToString(trade.ResultPrice(), digits) + "&volume=" + DoubleToString(trade.ResultVolume(), 2));
}

//--- prazo máximo: fecha posições do robô que passaram do tempo --------
void CloseExpired()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i); if(t == 0 || PositionGetInteger(POSITION_MAGIC) != Magic) continue;
      string id = PositionGetString(POSITION_COMMENT), gv = GvHold(id);
      if(GlobalVariableCheck(gv) && TimeCurrent() >= (datetime)GlobalVariableGet(gv)) { Print("ZyonBridge: prazo de ", id, " acabou; fechando."); trade.PositionClose(t); }
   }
}

//--- fechamento confirmado pela corretora → avisa a mesa ---------------
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if(HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != Magic) return;
   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY) return;
   ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   if(PositionSelectByTicket(posId)) return;                          // fechamento parcial: a posição ainda existe
   if(!HistorySelectByPosition(posId)) return;
   string id = ""; double profit = 0.0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
   {
      ulong d = HistoryDealGetTicket(i); if(d == 0) continue;
      profit += HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_SWAP) + HistoryDealGetDouble(d, DEAL_COMMISSION);
      if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN) id = HistoryDealGetString(d, DEAL_COMMENT);
   }
   if(id == "") return;
   GlobalVariableDel(GvHold(id));
   PrintFormat("ZyonBridge: %s fechada, resultado líquido %.2f %s", id, profit, AccountInfoString(ACCOUNT_CURRENCY));
   Report(id, "closed", "&profit=" + DoubleToString(profit, 2));
}
//+------------------------------------------------------------------+
