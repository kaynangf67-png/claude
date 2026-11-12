/** Nomes das 7 estratégias do usuário (arquivo leve: o navegador importa daqui). */
export type StrategyId = "reversao" | "retracao" | "fluxo" | "tres" | "diminuicao" | "dupla" | "forca";
export const STRATEGY_NAMES: Record<StrategyId, string> = { reversao: "Reversão de preço", retracao: "Retração", fluxo: "Fluxo de vela (região)", tres: "Três velas + região", diminuicao: "Diminuição de vela + região", dupla: "Dupla posição", forca: "Vela de força + reteste" };
