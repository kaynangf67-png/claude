import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { Camera } from "../componentes/Camera";
import { formatarValor } from "../lib/formatar";
import { Area, CenaProps, Rotulo, useEntrada, useFrameGlobal } from "./comum";

const contar = (frame: number, de: number, valor: number) =>
  interpolate(frame, [de, de + 26], [0, valor], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

/**
 * Cena 3: cálculo passo a passo com contadores subindo.
 * O último item é o resultado. Se o 2º item for uma quantidade pequena (ex.: 5 clientes),
 * aparece uma barra com um bloco por unidade, enchendo junto com o contador.
 */
export const Numeros: React.FC<CenaProps> = ({ cena, config, cor, inicioSeq, duracaoSeq }) => {
  const { fps } = useVideoConfig();
  const frame = useFrameGlobal(inicioSeq);
  const ini = cena.inicioFrame;
  const fala = Math.max(fps * 2, cena.fimFrame - ini);

  const itens = config.numeros;
  const n = itens.length;
  const ops = itens.map((it, i) => it.operador ?? (i === 0 ? "" : i === n - 1 && n > 1 ? "=" : "×"));
  const passo = n > 1 ? (fala * 0.62) / (n - 1) : 0;
  const quando = itens.map((_, i) => Math.round(ini + 8 + i * passo));

  const rotulo = useEntrada(inicioSeq, ini);
  const nota = useEntrada(inicioSeq, quando[n - 1] + 20);

  const corpo = itens.slice(0, n > 1 ? n - 1 : 1);
  const resultado = n > 1 ? itens[n - 1] : null;
  const unidades = n >= 3 && ops[1] === "×" && Number.isInteger(itens[1].valor) && itens[1].valor <= 12 ? itens[1].valor : 0;

  const entradaDe = (i: number) =>
    interpolate(frame, [quando[i], quando[i] + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Camera duracao={duracaoSeq} brilho={cor}>
      <Area>
        <Rotulo texto="Exemplo de cálculo" cor={cor} progresso={rotulo} />

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18 }}>
          {corpo.map((it, i) => {
            const e = entradaDe(i);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  opacity: e,
                  transform: `translateX(${interpolate(e, [0, 1], [-40, 0])}px)`,
                  borderBottom: "2px solid rgba(255,255,255,0.08)",
                  paddingBottom: 18,
                }}
              >
                <div style={{ width: 54, fontSize: 64, fontWeight: 800, color: cor, textAlign: "center" }}>{ops[i]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 32, color: "#9A9A96", fontWeight: 600 }}>{it.rotulo}</div>
                  <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
                    {formatarValor(contar(frame, quando[i], it.valor), it.formato)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {resultado && (
          <div
            style={{
              marginTop: 34,
              padding: "30px 36px",
              borderRadius: 28,
              border: `3px solid ${cor}`,
              background: `linear-gradient(135deg, ${cor}22, transparent 70%)`,
              boxShadow: `0 0 60px ${cor}33`,
              opacity: entradaDe(n - 1),
              transform: `scale(${interpolate(entradaDe(n - 1), [0, 1], [0.9, 1])})`,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 600, color: cor }}>
              {ops[n - 1]} {resultado.rotulo}
            </div>
            <div
              style={{
                fontSize: 124,
                fontWeight: 800,
                letterSpacing: -4,
                color: cor,
                lineHeight: 1.05,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatarValor(contar(frame, quando[n - 1], resultado.valor), resultado.formato)}
            </div>
            {unidades > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                {Array.from({ length: unidades }).map((_, u) => {
                  const cheio = interpolate(
                    frame,
                    [quando[n - 1] + (u * 26) / unidades, quando[n - 1] + ((u + 1) * 26) / unidades],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  return (
                    <div key={u} style={{ flex: 1, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                      <div style={{ width: `${cheio * 100}%`, height: "100%", background: cor }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 26, fontSize: 27, color: "#8A8A86", opacity: nota }}>
          Potencial estimado. Não é promessa de ganho.
        </div>
      </Area>
    </Camera>
  );
};
