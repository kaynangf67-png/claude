"""Leitura de capturas de gráfico (TradingView ou outro) com Claude.

Regras: só extrair o que está visível; campos que não aparecem voltam null. O servidor
cruza o resultado com os dados que já tem (timeframe, preço ao vivo, horário) e pede
nova captura quando a imagem está desatualizada, incompleta ou não é M5.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

import anthropic

from .config import settings

ALLOWED = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_BYTES = 5 * 1024 * 1024

SYSTEM = (
    "Você lê capturas de tela de gráficos financeiros para uma plataforma de análise. "
    "Extraia SOMENTE informações legíveis na imagem. Se um dado não aparece ou não dá para ler com "
    "segurança, devolva null: nunca estime nem complete preços, horários, ativos ou timeframe. "
    "Preços devem ser copiados como aparecem na escala ou no rótulo, convertidos para número. "
    "Para visible_datetime_utc, só preencha se a imagem mostrar data e hora completas; converta para ISO 8601 "
    "apenas se o fuso estiver visível, senão devolva o texto em visible_datetime_text e deixe o ISO null. "
    "Marque request_new_capture=true se faltarem ativo, timeframe, escala de preço ou os candles mais recentes, "
    "ou se a imagem estiver cortada, borrada ou não for um gráfico. Responda em português."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "is_chart": {"type": "boolean"},
        "platform": {"type": ["string", "null"]},
        "symbol": {"type": ["string", "null"]},
        "exchange": {"type": ["string", "null"]},
        "timeframe": {"type": ["string", "null"], "description": "Como aparece, ex: 5, 5m, M5, 1h"},
        "last_price": {"type": ["number", "null"]},
        "visible_datetime_text": {"type": ["string", "null"]},
        "visible_datetime_utc": {"type": ["string", "null"]},
        "indicators_visible": {"type": "array", "items": {"type": "string"}},
        "levels_visible": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"label": {"type": "string"}, "price": {"type": ["number", "null"]}},
                "required": ["label", "price"],
                "additionalProperties": False,
            },
        },
        "trend_read": {"type": "string", "enum": ["alta", "baixa", "lateral", "indefinida"]},
        "observations": {"type": "array", "items": {"type": "string"}},
        "missing": {"type": "array", "items": {"type": "string"}},
        "request_new_capture": {"type": "boolean"},
        "new_capture_reason": {"type": ["string", "null"]},
    },
    "required": ["is_chart", "platform", "symbol", "exchange", "timeframe", "last_price", "visible_datetime_text",
                 "visible_datetime_utc", "indicators_visible", "levels_visible", "trend_read", "observations",
                 "missing", "request_new_capture", "new_capture_reason"],
    "additionalProperties": False,
}


class VisionUnavailable(RuntimeError):
    pass


def _is_m5(tf: str | None) -> bool:
    return bool(tf) and tf.strip().lower().replace(" ", "") in {"5", "5m", "m5", "5min", "5minutos"}


def post_check(result: dict, live_price: float | None, now: float) -> dict:
    """Validações do servidor sobre o que a IA leu."""
    issues: list[str] = []
    if not result.get("is_chart"):
        issues.append("A imagem não parece ser um gráfico de preços.")
    if not result.get("symbol"):
        issues.append("Ativo não identificado na imagem.")
    if not result.get("timeframe"):
        issues.append("Timeframe não visível.")
    elif not _is_m5(result["timeframe"]):
        issues.append(f"Timeframe {result['timeframe']} — o Trade AI analisa M5. Capture no gráfico de 5 minutos.")
    iso = result.get("visible_datetime_utc")
    if iso:
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            age = now - dt.timestamp()
            if age > 15 * 60:
                issues.append(f"Captura desatualizada: horário visível de {int(age // 60)} min atrás.")
        except ValueError:
            pass
    else:
        issues.append("Horário não verificável na imagem: inclua a escala de tempo e o relógio do gráfico.")
    lp = result.get("last_price")
    if lp and live_price:
        dev = abs(lp - live_price) / live_price
        if dev > 0.01:
            issues.append(f"Preço da imagem ({lp:g}) difere {dev:.1%} do preço ao vivo ({live_price:g}): "
                          "captura provavelmente antiga.")
    result["server_checks"] = issues
    result["request_new_capture"] = bool(result.get("request_new_capture")) or bool(issues)
    return result


def analyze_image(data: bytes, media_type: str) -> dict:
    if not settings.anthropic_api_key:
        raise VisionUnavailable("Análise de imagem desativada: defina ANTHROPIC_API_KEY no servidor")
    if media_type not in ALLOWED:
        raise ValueError("Formato não suportado (use PNG, JPEG, WEBP ou GIF)")
    if len(data) > MAX_BYTES:
        raise ValueError("Imagem acima de 5 MB")
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.beta.messages.create(
        model=settings.vision_model,
        max_tokens=4000,
        system=SYSTEM,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type,
                                             "data": base64.standard_b64encode(data).decode()}},
                {"type": "text", "text": "Leia este gráfico e preencha o JSON."},
            ],
        }],
    )
    if response.stop_reason == "refusal":
        raise VisionUnavailable("A IA recusou analisar esta imagem")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise VisionUnavailable("Resposta vazia da IA")
    return json.loads(text)
