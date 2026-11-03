//+------------------------------------------------------------------+
//| M5Exportador.mq5                                                  |
//| Exporta candles de 1 minuto para um arquivo CSV. SOMENTE LEITURA. |
//|                                                                   |
//| Este script NAO abre, fecha nem modifica ordens e NAO usa chaves, |
//| senhas, DLLs nem internet. Ele so le o historico do terminal e    |
//| escreve arquivos na pasta comum do MetaTrader (FILE_COMMON).      |
//|                                                                   |
//| Arquivo gerado por simbolo: m5exp_<SIMBOLO>_M1.csv                 |
//| Colunas: timestamp (Unix, segundos, UTC), open, high, low, close, |
//|          volume (ticks), forming (1 = candle ainda em formacao)   |
//+------------------------------------------------------------------+
#property copyright "M5 Smart Analyzer"
#property version   "1.00"
#property description "Exporta candles M1 para CSV (somente leitura, sem ordens)."
#property script_show_inputs

input string InpSymbols   = "EURUSD";  // Simbolos separados por virgula (como aparecem no seu MT5)
input int    InpBars      = 720;       // Quantidade de candles M1 exportados (min. 300)
input int    InpRefreshMs = 1000;      // Intervalo entre atualizacoes (ms)

string g_symbols[];

//+------------------------------------------------------------------+
//| Exporta um simbolo. Retorna true se gravou o arquivo.            |
//+------------------------------------------------------------------+
bool ExportSymbol(const string symbolRaw)
{
   string sym = symbolRaw;
   StringTrimLeft(sym);
   StringTrimRight(sym);
   if(sym == "")
      return(false);

   if(!SymbolSelect(sym, true))
   {
      Print("M5Exportador: simbolo nao encontrado no MT5: ", sym);
      return(false);
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, false);               // [0] = mais antigo, [n-1] = candle em formacao
   int got = CopyRates(sym, PERIOD_M1, 0, InpBars, rates);
   if(got <= 0)
      return(false);                             // historico ainda carregando: tenta de novo no proximo ciclo

   // O MT5 usa o horario do SERVIDOR da corretora; converte para UTC.
   long offset = (long)(TimeTradeServer() - TimeGMT());

   string tmp = "m5exp_" + sym + ".tmp";
   string dst = "m5exp_" + sym + "_M1.csv";

   int h = FileOpen(tmp, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
   {
      Print("M5Exportador: nao consegui abrir ", tmp, " (erro ", GetLastError(), ")");
      return(false);
   }

   FileWriteString(h, "timestamp,open,high,low,close,volume,forming\n");
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   for(int i = 0; i < got; i++)
   {
      long t = (long)rates[i].time - offset;
      string line = StringFormat("%I64d,%s,%s,%s,%s,%I64d,%d\n",
                                 t,
                                 DoubleToString(rates[i].open,  digits),
                                 DoubleToString(rates[i].high,  digits),
                                 DoubleToString(rates[i].low,   digits),
                                 DoubleToString(rates[i].close, digits),
                                 (long)rates[i].tick_volume,
                                 (i == got - 1) ? 1 : 0);
      FileWriteString(h, line);
   }
   FileClose(h);

   // Troca o arquivo de uma vez, para o leitor nunca ver um arquivo pela metade.
   if(!FileMove(tmp, FILE_COMMON, dst, FILE_COMMON | FILE_REWRITE))
   {
      Print("M5Exportador: nao consegui gravar ", dst, " (erro ", GetLastError(), ")");
      return(false);
   }
   return(true);
}

//+------------------------------------------------------------------+
//| Script: repete ate ser interrompido (remova o script do grafico). |
//+------------------------------------------------------------------+
void OnStart()
{
   if(InpBars < 300)
   {
      Alert("M5Exportador: InpBars precisa ser pelo menos 300.");
      return;
   }
   int n = StringSplit(InpSymbols, ',', g_symbols);
   if(n <= 0)
   {
      Alert("M5Exportador: informe ao menos um simbolo em InpSymbols.");
      return;
   }

   Print("M5Exportador iniciado (somente leitura). Pasta dos arquivos: ",
         TerminalInfoString(TERMINAL_COMMONDATA_PATH), "\\Files");

   while(!IsStopped())
   {
      for(int i = 0; i < n; i++)
         ExportSymbol(g_symbols[i]);
      Sleep(InpRefreshMs);
   }
   Print("M5Exportador encerrado.");
}
//+------------------------------------------------------------------+
