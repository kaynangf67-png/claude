//+------------------------------------------------------------------+
//| M5Perfil.mq5                                                      |
//| Perfil de volume das ultimas N velas M5: histograma por faixa de  |
//| preco, POC (preco com mais volume) e area de valor (70%).         |
//|                                                                   |
//| SOMENTE LEITURA: nao abre, fecha nem modifica ordens; nao usa     |
//| DLL, internet, chaves ou senhas. So desenha no grafico.           |
//|                                                                   |
//| Volume = volume de TICKS da sua corretora (forex nao tem volume   |
//| central). Mostra onde o preco negociou mais, nao quem comprou.    |
//| Nao e sinal de entrada: use como contexto para as zonas.          |
//+------------------------------------------------------------------+
#property copyright   "M5 Smart Analyzer"
#property version     "1.00"
#property description "Perfil de volume M5 (somente leitura, sem ordens). Nao garante resultado."
#property indicator_chart_window
#property indicator_plots 0

input int    InpBars       = 288;      // Velas M5 no perfil (288 = 24 horas)
input int    InpBins       = 60;       // Faixas de preco do histograma
input double InpValueArea  = 0.70;     // Area de valor (fracao do volume)
input int    InpWidthBars  = 18;       // Largura maxima do histograma (em velas, a partir da vela atual)
input color  InpColor      = C'32,36,48';    // Cor das barras (escura: fica de fundo)
input color  InpVaColor    = C'40,52,74';    // Cor das barras dentro da area de valor
input color  InpPocColor   = clrGold;        // Cor da linha do POC
input color  InpVaLineColor = clrSilver;     // Cor das linhas VAH / VAL

#define PFX "M5P_"

datetime g_lastBar = 0;

int OnInit()
{
   if(InpBars < 20 || InpBins < 10 || InpValueArea <= 0 || InpValueArea >= 1)
   {
      Alert("M5Perfil: parametros invalidos (InpBars >= 20, InpBins >= 10, 0 < InpValueArea < 1).");
      return(INIT_PARAMETERS_INCORRECT);
   }
   EventSetTimer(5);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
}

int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],
                const double &open[], const double &high[], const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[])
{
   return(rates_total);
}

// Redesenha a cada vela M5 nova (o perfil usa so velas FECHADAS)
void OnTimer()
{
   datetime t[];
   if(CopyTime(_Symbol, PERIOD_M5, 0, 1, t) != 1) return;
   if(t[0] == g_lastBar) return;
   if(Draw()) g_lastBar = t[0];
}

bool Draw()
{
   MqlRates r[];
   ArraySetAsSeries(r, false);
   int n = CopyRates(_Symbol, PERIOD_M5, 1, InpBars, r);   // a partir de 1: so velas fechadas
   if(n < 20) return(false);

   double lo = r[0].low, hi = r[0].high;
   for(int i = 1; i < n; i++) { lo = MathMin(lo, r[i].low); hi = MathMax(hi, r[i].high); }
   if(hi <= lo) return(false);
   double step = (hi - lo) / InpBins;

   // volume de cada vela espalhado igualmente pelas faixas que ela tocou
   double vol[];
   ArrayResize(vol, InpBins);
   ArrayInitialize(vol, 0);
   double total = 0;
   for(int i = 0; i < n; i++)
   {
      int a = (int)MathFloor((r[i].low - lo) / step);
      int b = (int)MathFloor((r[i].high - lo) / step);
      a = MathMax(0, MathMin(InpBins - 1, a));
      b = MathMax(0, MathMin(InpBins - 1, b));
      double v = (double)r[i].tick_volume / (b - a + 1);
      for(int k = a; k <= b; k++) vol[k] += v;
      total += (double)r[i].tick_volume;
   }
   if(total <= 0) return(false);

   int poc = ArrayMaximum(vol);
   // area de valor: parte do POC e soma a faixa vizinha de maior volume ate atingir a fracao pedida
   int va0 = poc, va1 = poc;
   double acc = vol[poc];
   while(acc < InpValueArea * total && (va0 > 0 || va1 < InpBins - 1))
   {
      double down = va0 > 0 ? vol[va0 - 1] : -1;
      double up   = va1 < InpBins - 1 ? vol[va1 + 1] : -1;
      if(up >= down) { va1++; acc += vol[va1]; }
      else           { va0--; acc += vol[va0]; }
   }

   ObjectsDeleteAll(0, PFX);
   datetime t0 = r[0].time;
   datetime tEnd = r[n - 1].time + PeriodSeconds(PERIOD_M5);
   double maxV = vol[poc];
   long width = (long)InpWidthBars * PeriodSeconds(PERIOD_M5);
   for(int k = 0; k < InpBins; k++)
   {
      if(vol[k] <= 0) continue;
      string nm = PFX + "B" + IntegerToString(k);
      // barras coladas na direita (vela atual), crescendo para a esquerda
      datetime t1 = (datetime)((long)tEnd - (long)(width * vol[k] / maxV));
      ObjectCreate(0, nm, OBJ_RECTANGLE, 0, t1, lo + k * step, tEnd, lo + (k + 1) * step);
      ObjectSetInteger(0, nm, OBJPROP_COLOR, (k >= va0 && k <= va1) ? InpVaColor : InpColor);
      ObjectSetInteger(0, nm, OBJPROP_FILL, true);
      ObjectSetInteger(0, nm, OBJPROP_BACK, true);
      ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, nm, OBJPROP_HIDDEN, true);
   }

   double pocPx = lo + (poc + 0.5) * step;
   double vah = lo + (va1 + 1) * step;
   double val = lo + va0 * step;
   Line("POC", t0, tEnd, pocPx, InpPocColor, 2, StringFormat("POC %s", DoubleToString(pocPx, _Digits)));
   Line("VAH", t0, tEnd, vah, InpVaLineColor, 1, StringFormat("VAH %s (topo da area de valor)", DoubleToString(vah, _Digits)));
   Line("VAL", t0, tEnd, val, InpVaLineColor, 1, StringFormat("VAL %s (fundo da area de valor)", DoubleToString(val, _Digits)));
   ChartRedraw();
   return(true);
}

void Line(string id, datetime t0, datetime t1, double px, color c, int w, string tip)
{
   string nm = PFX + id;
   ObjectCreate(0, nm, OBJ_TREND, 0, t0, px, t1, px);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, c);
   ObjectSetInteger(0, nm, OBJPROP_WIDTH, w);
   ObjectSetInteger(0, nm, OBJPROP_STYLE, id == "POC" ? STYLE_SOLID : STYLE_DOT);
   ObjectSetInteger(0, nm, OBJPROP_RAY_RIGHT, true);
   ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, nm, OBJPROP_TOOLTIP, tip);
   string lb = PFX + id + "_T";
   ObjectCreate(0, lb, OBJ_TEXT, 0, t1, px);
   ObjectSetString(0, lb, OBJPROP_TEXT, " " + id);
   ObjectSetInteger(0, lb, OBJPROP_COLOR, c);
   ObjectSetInteger(0, lb, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, lb, OBJPROP_ANCHOR, ANCHOR_LEFT);
   ObjectSetInteger(0, lb, OBJPROP_SELECTABLE, false);
}
//+------------------------------------------------------------------+
