// ---------- Entrada (o JSON que você edita) ----------

export type Formato = "moeda" | "numero" | "percentual";

export type Numero = {
  rotulo: string;
  valor: number;
  /** "moeda" => R$ 1.500 | "numero" => 1.500 | "percentual" => 15% (padrão: "numero") */
  formato?: Formato;
  /** Símbolo exibido antes deste item: "×", "+", "−", "=". Padrão: × nos do meio, = no último. */
  operador?: string;
};

export type Passo = string | { texto: string; icone?: NomeIcone };

export type NomeTransicao = "split" | "zoom" | "wipe" | "glitch";

export type ConfigVideo = {
  gancho: string;
  ideia: { nome: string; descricao: string };
  numeros: Numero[];
  passos: [Passo, Passo, Passo];
  erro: string;
  /** Chamada para seguir o perfil */
  fechamento: string;
  /** Frase de gancho do próximo vídeo (aparece no final) */
  proximoGancho?: string;
  /** Ex.: "@seuperfil" */
  perfil?: string;
  audio: string;
  timestamps: string;
  /** Trilha de fundo (opcional). Fica em loop, -22dB sob a voz. */
  trilha?: string;
  /** "limao" | "dourado" | qualquer cor hex */
  cor?: string;
  /** 5 transições (entre as 6 cenas). Sem repetir duas seguidas. */
  transicoes?: NomeTransicao[];
  /**
   * Texto EXATO que foi narrado em cada cena. É o que permite cortar a narração em cenas.
   * Se omitido, usa o texto da tela (funciona só se a narração for igual ao texto exibido).
   */
  roteiro?: {
    gancho: string;
    ideia: string;
    numeros: string;
    passos: [string, string, string];
    erro: string;
    fechamento: string;
  };
};

export type NomeIcone =
  | "alvo"
  | "lista"
  | "mensagem"
  | "camera"
  | "loja"
  | "dinheiro"
  | "telefone"
  | "check"
  | "mapa"
  | "pessoas"
  | "calendario"
  | "foguete";

// ---------- Dados calculados (a partir dos timestamps) ----------

export type Palavra = {
  texto: string;
  /** segundos */
  inicio: number;
  fim: number;
};

export type NomeCena = "gancho" | "ideia" | "numeros" | "passos" | "erro" | "fechamento";

export type Cena = {
  nome: NomeCena;
  /** Frame global em que a narração da cena começa */
  inicioFrame: number;
  /** Frame global em que a próxima cena começa */
  fimFrame: number;
  palavras: Palavra[];
  /** Marcos internos em frames globais (início de cada passo, início do próximo gancho, ...) */
  marcos: number[];
};

export type DadosVideo = {
  config: ConfigVideo;
  palavras: Palavra[];
  cenas: Cena[];
  transicoes: NomeTransicao[];
  duracaoFrames: number;
  temAudio: boolean;
  temTrilha: boolean;
  avisos: string[];
};

export type PropsVideo = {
  /** Caminho do JSON de configuração dentro de /public */
  config: string;
  dados?: DadosVideo;
};
