//+------------------------------------------------------------------+
//| M5Retracao.mq5                                                    |
//| Indicador da retracao M5 (aulas 1 a 3) direto no grafico do MT5. |
//|                                                                   |
//| SOMENTE LEITURA: nao abre, fecha nem modifica ordens; nao usa     |
//| DLL, internet, chaves ou senhas. Desenha zonas e mostra o sinal.  |
//|                                                                   |
//| E uma versao SIMPLIFICADA do motor do app M5 Smart Analyzer:      |
//| zonas, toques com retracao, zona armada (2 toques), cronometro    |
//| 2:30, fluxo de 3 velas (F3), reversao (F1), vela nascendo perto   |
//| (F2), velas anteriores e 2 toques com pavio. NAO avalia a vela    |
//| lenta/parada (F4) nem os filtros de contexto do app. Em caso de   |
//| duvida, o app e a referencia.                                     |
//+------------------------------------------------------------------+
#property copyright   "M5 Smart Analyzer"
#property version     "1.00"
#property description "Retracao M5: zonas e sinal (somente leitura, sem ordens). Nao garante resultado."
#property indicator_chart_window
#property indicator_plots 0

//--- Valores da aula
input int    InpMinPrior      = 2;     // Toques validos anteriores (aula 1)
input int    InpMaxRun        = 3;     // Fluxo da mesma cor que bloqueia (aula 2)
input int    InpMinRemaining  = 150;   // Tempo restante minimo em segundos (aula 3: 2:30)
//--- Valores EXPLORATORIOS (nao vem da aula)
input int    InpContext       = 60;    // Janela de contexto (candles M5)
input int    InpLookback      = 2;     // Vizinhos para topo/fundo
input double InpZoneTolMult   = 0.75;  // Tolerancia da zona (x amplitude media)
input double InpRetrMinMult   = 1.5;   // Retracao minima (x amplitude media)
input int    InpRetrWindow    = 6;     // Janela para a retracao (candles)
input double InpWickRatio     = 0.35;  // Pavio relevante (fracao da amplitude)
input int    InpPrevNeed      = 2;     // Velas anteriores com forca a favor (1 ou 2)
input double InpApproachATR   = 0.3;   // F2: distancia minima abertura->zona (x ATR)
input double InpReversalATR   = 0.15;  // F1: movimento contra maximo (x ATR)
//--- Filtro de media movel (hipotese, desligado)
input bool   InpUseMA         = false; // Exigir medias moveis a favor (hipotese)
input int    InpMaFast        = 9;     // EMA rapida
input int    InpMaSlow        = 21;    // EMA lenta
//--- Aviso
input bool   InpAlert         = true;  // Alerta (som + janela) quando der ENTRADA

#define PFX "M5R_"
#define SPFX "M5RS_"   // sinais: ficam no grafico ao trocar de tempo grafico
#define NBARS 300

struct Zone
{
   bool   res;        // true = resistencia, false = suporte
   double lower;
   double upper;
   int    firstIdx;
   int    priors;     // toques anteriores com retracao confirmada
   int    wickTouches;// toques anteriores com pavio relevante
};

MqlRates g_r[];       // [0] = mais antigo ... [n-1] = candle em formacao
Zone     g_z[];
string   g_lastAlert = "";

//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
   if(reason == REASON_REMOVE) ObjectsDeleteAll(0, SPFX);   // tirou o indicador: limpa os sinais tambem
   Comment("");
}

int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],
                const double &open[], const double &high[], const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[])
{
   Update();
   return(rates_total);
}

void OnTimer() { Update(); }

//+------------------------------------------------------------------+
double MeanRange(int from, int to)
{
   double s = 0; int n = 0;
   for(int i = MathMax(0, from); i <= to; i++) { s += g_r[i].high - g_r[i].low; n++; }
   return(n > 0 ? s / n : 0);
}

double Atr(int last, int n = 14)
{
   double s = 0; int k = 0;
   for(int i = MathMax(1, last - n + 1); i <= last; i++)
   {
      double pc = g_r[i - 1].close;
      s += MathMax(g_r[i].high - g_r[i].low, MathMax(MathAbs(g_r[i].high - pc), MathAbs(g_r[i].low - pc)));
      k++;
   }
   return(k > 0 ? s / k : 0);
}

double WickRatio(const MqlRates &c, bool upper)
{
   double range = c.high - c.low;
   if(range <= 0) return(-1);
   double top = MathMax(c.open, c.close), bot = MathMin(c.open, c.close);
   return(upper ? (c.high - top) / range : (bot - c.low) / range);
}

int Dir(const MqlRates &c) { return(c.close > c.open ? 1 : (c.close < c.open ? -1 : 0)); }

double Ema(int last, int period)
{
   int from = MathMax(0, last - 199);
   if(last - from + 1 < period * 3) return(EMPTY_VALUE);
   double k = 2.0 / (period + 1), e = 0;
   for(int i = from; i < from + period; i++) e += g_r[i].close;
   e /= period;
   for(int i = from + period; i <= last; i++) e = g_r[i].close * k + e * (1 - k);
   return(e);
}

//+------------------------------------------------------------------+
//| Zonas: pivos do mesmo lado a menos de 'tol' entre si.             |
//+------------------------------------------------------------------+
void BuildZones(int ctxStart, int last, double tol, double retrMin)
{
   ArrayResize(g_z, 0);
   for(int side = 0; side < 2; side++)
   {
      bool res = (side == 0);
      double price[]; int idx[]; int np = 0;
      for(int i = MathMax(ctxStart, InpLookback); i <= last - InpLookback; i++)
      {
         bool ok = true;
         for(int k = 1; k <= InpLookback && ok; k++)
         {
            if(res) ok = (g_r[i].high > g_r[i - k].high && g_r[i].high >= g_r[i + k].high);
            else    ok = (g_r[i].low  < g_r[i - k].low  && g_r[i].low  <= g_r[i + k].low);
         }
         if(!ok) continue;
         ArrayResize(price, np + 1); ArrayResize(idx, np + 1);
         price[np] = res ? g_r[i].high : g_r[i].low; idx[np] = i; np++;
      }
      // ordena por preco (insercao)
      for(int a = 1; a < np; a++)
      {
         double p = price[a]; int ix = idx[a]; int b = a - 1;
         while(b >= 0 && price[b] > p) { price[b + 1] = price[b]; idx[b + 1] = idx[b]; b--; }
         price[b + 1] = p; idx[b + 1] = ix;
      }
      int s = 0;
      while(s < np)
      {
         int e = s;
         while(e + 1 < np && price[e + 1] - price[s] <= tol) e++;
         Zone z;
         z.res = res;
         z.lower = price[s] - tol / 2;
         z.upper = price[e] + tol / 2;
         z.firstIdx = idx[s];
         for(int q = s; q <= e; q++) z.firstIdx = MathMin(z.firstIdx, idx[q]);
         CountTouches(z, last, tol, retrMin);
         int n = ArraySize(g_z); ArrayResize(g_z, n + 1); g_z[n] = z;
         s = e + 1;
      }
   }
}

//+------------------------------------------------------------------+
//| Toques anteriores com retracao confirmada e com pavio relevante.  |
//+------------------------------------------------------------------+
void CountTouches(Zone &z, int last, double tol, double retrMin)
{
   z.priors = 0; z.wickTouches = 0;
   int i = z.firstIdx;
   while(i <= last)
   {
      int rel = Rel(z, g_r[i], tol);           // 0 distante, 1 aproximacao, 2 toque, 3 rompimento
      if(rel == 0) { i++; continue; }
      if(rel == 3) { while(i <= last && Rel(z, g_r[i], tol) == 3) i++; continue; }
      int start = i; bool touch = false;
      while(i <= last)
      {
         int r = Rel(z, g_r[i], tol);
         if(r != 1 && r != 2) break;
         if(r == 2) touch = true;
         i++;
      }
      int end = i - 1;
      if(!touch) continue;
      int ext = start;
      for(int j = start; j <= end; j++)
         if(z.res ? g_r[j].high > g_r[ext].high : g_r[j].low < g_r[ext].low) ext = j;
      double extreme = z.res ? g_r[ext].high : g_r[ext].low;
      if(WickRatio(g_r[ext], z.res) >= InpWickRatio) z.wickTouches++;
      if(end >= last) continue;               // contato que chega ao ultimo candle: retracao ainda em andamento
      double mag = MathMax(0, z.res ? extreme - g_r[end].close : g_r[end].close - extreme);
      bool ok = (mag >= retrMin);
      for(int j = end + 1; !ok && j <= MathMin(end + InpRetrWindow, last); j++)
      {
         if(z.res ? g_r[j].close > z.upper : g_r[j].close < z.lower) break;   // rompida
         mag = MathMax(mag, z.res ? extreme - g_r[j].low : g_r[j].high - extreme);
         if(mag >= retrMin) ok = true;
      }
      if(ok) z.priors++;
   }
}

int Rel(const Zone &z, const MqlRates &c, double tol)
{
   if(z.res)
   {
      if(c.close > z.upper) return(3);
      if(c.high >= z.lower) return(2);
      if(c.high >= z.lower - tol) return(1);
      return(0);
   }
   if(c.close < z.lower) return(3);
   if(c.low <= z.upper) return(2);
   if(c.low <= z.upper + tol) return(1);
   return(0);
}

//+------------------------------------------------------------------+
void Update()
{
   int got = CopyRates(_Symbol, PERIOD_M5, 0, NBARS, g_r);
   if(got < InpContext + 20) { Comment("M5 Retracao: carregando historico M5..."); return; }
   int n = got;
   int last = n - 2;                                   // ultimo candle FECHADO
   MqlRates f = g_r[n - 1];                            // candle em formacao
   int ctxStart = MathMax(0, last - InpContext + 1);
   double ref = MeanRange(ctxStart, last);
   double atr = Atr(last);
   if(ref <= 0 || atr <= 0) return;
   Comment("");
   double tol = InpZoneTolMult * ref;
   BuildZones(ctxStart, last, tol, InpRetrMinMult * ref);

   // zona em contato com o candle em formacao (a de mais toques validos)
   int best = -1;
   for(int i = 0; i < ArraySize(g_z); i++)
   {
      bool touching = g_z[i].res ? (f.high >= g_z[i].lower && f.close <= g_z[i].upper)
                                 : (f.low <= g_z[i].upper && f.close >= g_z[i].lower);
      if(touching && (best < 0 || g_z[i].priors > g_z[best].priors)) best = i;
   }

   long remaining = (long)f.time + 300 - (long)TimeTradeServer();
   if(remaining < 0) remaining = 0;
   if(remaining > 300) remaining = 300;

   // F3: fluxo da mesma cor terminando no ultimo candle fechado
   int d = Dir(g_r[last]), run = 0;
   if(d != 0) for(int i = last; i >= 0 && Dir(g_r[i]) == d; i--) run++;
   bool f3 = (run >= InpMaxRun);

   string titulo, detalhe, lado = "";
   string chk = "";
   color cor = clrSilver;
   bool entrada = false;

   if(best < 0)
   {
      titulo = f3 ? "NAO ENTRE" : "AGUARDE";
      detalhe = f3 ? StringFormat("Fluxo de %d velas da mesma cor.", run) : "Preco longe das zonas.";
      cor = f3 ? clrTomato : clrSilver;
   }
   else
   {
      Zone z = g_z[best];
      lado = z.res ? "VENDA" : "COMPRA";
      double edge = z.res ? z.lower : z.upper;
      double entry = z.res ? MathMax(f.close, edge) : MathMin(f.close, edge);
      bool armed = (z.priors >= InpMinPrior);
      bool tempo = (remaining >= InpMinRemaining);
      double counter = z.res ? MathMax(0, f.open - f.low) : MathMax(0, f.high - f.open);
      bool f1 = (counter / atr > InpReversalATR);
      double dist = (z.res ? entry - f.open : f.open - entry) / atr;
      bool f2 = (dist < InpApproachATR);
      int favor = 0;
      for(int i = last - 1; i <= last; i++)
         if(WickRatio(g_r[i], z.res) >= InpWickRatio || Dir(g_r[i]) == (z.res ? -1 : 1)) favor++;
      bool prev = (favor >= InpPrevNeed);
      bool wicks = (z.wickTouches >= 2);
      bool ma = true;
      if(InpUseMA)
      {
         double ef = Ema(last, InpMaFast), es = Ema(last, InpMaSlow);
         ma = (ef != EMPTY_VALUE && es != EMPTY_VALUE && (z.res ? ef < es : ef > es));
      }

      chk = StringFormat("%s Zona com %d toques\n%s Tempo >= %d:%02d\n%s Velas anteriores\n%s Sem reversao (F1)\n%s Nao nasceu na zona (F2)\n%s Sem 3 velas iguais (F3)\n%s 2 toques com pavio%s",
                         Mk(armed), z.priors, Mk(tempo), InpMinRemaining / 60, InpMinRemaining % 60, Mk(prev), Mk(!f1), Mk(!f2), Mk(!f3), Mk(wicks),
                         InpUseMA ? StringFormat("\n%s Medias a favor (hipotese)", Mk(ma)) : "");

      if(f1 || f2 || f3)
      {
         titulo = "NAO ENTRE"; cor = clrTomato;
         detalhe = f3 ? "Fluxo de velas da mesma cor." : (f1 ? "Reversao contra a operacao." : "Vela nasceu perto da zona.");
      }
      else if(armed && tempo && prev && wicks && ma)
      {
         titulo = lado + " AGORA"; cor = clrLimeGreen; entrada = true;
         detalhe = StringFormat("%s com %d toques anteriores.", z.res ? "Resistencia" : "Suporte", z.priors);
      }
      else
      {
         titulo = "ZONA TOCADA"; cor = clrGold;
         detalhe = !armed ? "Zona ainda sem 2 toques validos." : (!tempo ? "Menos de 2:30: espere o proximo candle." : "Faltam criterios.");
      }

      if(entrada) MarkSignal(f.time, z.res, entry);

      if(entrada && InpAlert)
      {
         string key = StringFormat("%s|%d|%d", _Symbol, z.firstIdx, (int)f.time);
         if(key != g_lastAlert)
         {
            g_lastAlert = key;
            Alert(StringFormat("M5 Retracao %s: %s (restam %d:%02d). Confira antes de entrar.", _Symbol, titulo, (int)(remaining / 60), (int)(remaining % 60)));
            PlaySound("alert.wav");
         }
      }
   }

   DrawZones(last, f.time);
   int ganhos = 0, perdas = 0, empates = 0;
   ResolveSignals(f.time, ganhos, perdas, empates);
   if(ganhos + perdas + empates > 0)
      chk += StringFormat("%sSinais no grafico: %d ganharam, %d perderam%s (fechamento do M5)", chk == "" ? "" : "\n",
                          ganhos, perdas, empates > 0 ? StringFormat(", %d empate(s)", empates) : "");
   DrawPanel(titulo, detalhe, chk, cor, remaining);
}

//+------------------------------------------------------------------+
//| Seta no candle em que surgiu a ENTRADA (uma por candle), no preco |
//| de entrada. Depois do fechamento, marca o resultado ao lado.      |
//+------------------------------------------------------------------+
string SigName(string kind, datetime t) { return(SPFX + kind + "_" + _Symbol + "_" + IntegerToString((long)t)); }

void MarkSignal(datetime t, bool venda, double price)
{
   string nm = SigName("A", t);
   if(ObjectFind(0, nm) >= 0) return;                 // ja marcado neste candle
   ObjectCreate(0, nm, OBJ_ARROW, 0, t, price);
   ObjectSetInteger(0, nm, OBJPROP_ARROWCODE, venda ? 234 : 233);
   ObjectSetInteger(0, nm, OBJPROP_ANCHOR, venda ? ANCHOR_BOTTOM : ANCHOR_TOP);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, venda ? clrTomato : clrLimeGreen);
   ObjectSetInteger(0, nm, OBJPROP_WIDTH, 3);
   ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, nm, OBJPROP_TOOLTIP, StringFormat("%s em %s", venda ? "VENDA" : "COMPRA", DoubleToString(price, _Digits)));
}

void ResolveSignals(datetime formingT, int &ganhos, int &perdas, int &empates)
{
   string pre = SPFX + "A_" + _Symbol + "_";
   int total = ObjectsTotal(0, 0, OBJ_ARROW);
   for(int i = 0; i < total; i++)
   {
      string nm = ObjectName(0, i, 0, OBJ_ARROW);
      if(StringFind(nm, pre) != 0) continue;
      datetime t = (datetime)ObjectGetInteger(0, nm, OBJPROP_TIME);
      string rn = SigName("R", t);
      if(ObjectFind(0, rn) < 0)
      {
         if(t >= formingT) continue;                   // candle ainda aberto
         int k = -1;
         for(int j = ArraySize(g_r) - 1; j >= 0; j--) if(g_r[j].time == t) { k = j; break; }
         if(k < 0) continue;
         bool venda = (ObjectGetInteger(0, nm, OBJPROP_ARROWCODE) == 234);
         double entry = ObjectGetDouble(0, nm, OBJPROP_PRICE);
         double close = g_r[k].close;
         string res = (close == entry) ? "= empate" : (((venda && close < entry) || (!venda && close > entry)) ? "ganhou" : "perdeu");
         ObjectCreate(0, rn, OBJ_TEXT, 0, t, venda ? g_r[k].high : g_r[k].low);
         ObjectSetString(0, rn, OBJPROP_TEXT, res);
         ObjectSetInteger(0, rn, OBJPROP_ANCHOR, venda ? ANCHOR_LOWER : ANCHOR_UPPER);
         ObjectSetInteger(0, rn, OBJPROP_COLOR, res == "ganhou" ? clrLimeGreen : (res == "perdeu" ? clrTomato : clrSilver));
         ObjectSetInteger(0, rn, OBJPROP_FONTSIZE, 8);
         ObjectSetInteger(0, rn, OBJPROP_SELECTABLE, false);
      }
      string txt = ObjectGetString(0, rn, OBJPROP_TEXT);
      if(txt == "ganhou") ganhos++;
      else if(txt == "perdeu") perdas++;
      else if(txt != "") empates++;
   }
}

string Mk(bool ok) { return(ok ? "[v]" : "[x]"); }

//+------------------------------------------------------------------+
void DrawZones(int last, datetime now)
{
   ObjectsDeleteAll(0, PFX + "Z");
   for(int i = 0; i < ArraySize(g_z); i++)
   {
      string nm = PFX + "Z" + IntegerToString(i);
      bool armed = (g_z[i].priors >= InpMinPrior);
      color c = g_z[i].res ? (armed ? C'120,40,40' : C'60,30,30') : (armed ? C'30,100,60' : C'25,50,35');
      ObjectCreate(0, nm, OBJ_RECTANGLE, 0, g_r[g_z[i].firstIdx].time, g_z[i].upper, now + 600, g_z[i].lower);
      ObjectSetInteger(0, nm, OBJPROP_COLOR, c);
      ObjectSetInteger(0, nm, OBJPROP_FILL, true);
      ObjectSetInteger(0, nm, OBJPROP_BACK, true);
      ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
      ObjectSetString(0, nm, OBJPROP_TOOLTIP, StringFormat("%s: %d toque(s) valido(s)", g_z[i].res ? "Resistencia" : "Suporte", g_z[i].priors));
   }
}

void DrawPanel(string titulo, string detalhe, string chk, color cor, long remaining)
{
   Label("T", titulo, 20, cor, 30);
   Label("D", detalhe, 10, clrWhite, 62);
   Label("C", StringFormat("Cronometro M5: %d:%02d", (int)(remaining / 60), (int)(remaining % 60)), 12,
         remaining >= InpMinRemaining ? clrLimeGreen : clrTomato, 82);
   string lines[];
   int k = StringSplit(chk, '\n', lines);
   ObjectsDeleteAll(0, PFX + "K");
   for(int i = 0; i < k; i++) Label("K" + IntegerToString(i), lines[i], 9, clrSilver, 106 + i * 15);
   Label("A", "Somente leitura. Nao garante resultado. Voce entra na corretora.", 8, clrGray, 106 + MathMax(k, 0) * 15 + 6);
   ChartRedraw();
}

void Label(string id, string text, int size, color c, int y)
{
   string nm = PFX + id;
   if(ObjectFind(0, nm) < 0)
   {
      ObjectCreate(0, nm, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nm, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nm, OBJPROP_XDISTANCE, 12);
      ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, nm, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, nm, OBJPROP_FONTSIZE, size);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, c);
   ObjectSetString(0, nm, OBJPROP_FONT, "Arial Bold");
   ObjectSetString(0, nm, OBJPROP_TEXT, text);
}
//+------------------------------------------------------------------+
