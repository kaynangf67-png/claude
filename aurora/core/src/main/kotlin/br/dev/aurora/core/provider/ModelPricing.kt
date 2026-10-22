package br.dev.aurora.core.provider

/**
 * Preços por milhão de tokens (US$), conforme tabela pública da Anthropic consultada em 10/2026.
 * São estimativas: a cobrança real é a da fatura do provedor.
 */
data class ModelPrice(val inputPerMTok: Double, val outputPerMTok: Double) {
    val cacheReadPerMTok: Double get() = inputPerMTok * 0.1
    val cacheWritePerMTok: Double get() = inputPerMTok * 1.25

    fun cost(u: TokenUsage): Double =
        (u.inputTokens * inputPerMTok + u.outputTokens * outputPerMTok +
            u.cacheReadTokens * cacheReadPerMTok + u.cacheWriteTokens * cacheWritePerMTok) / 1_000_000.0
}

data class ModelOption(val id: String, val label: String, val price: ModelPrice, val description: String)

object ModelCatalog {
    val options = listOf(
        ModelOption("claude-opus-5-5", "Claude Opus 5.5", ModelPrice(4.0, 20.0), "Mais capaz; custo mais alto."),
        ModelOption("claude-sonnet-5-5", "Claude Sonnet 5.5", ModelPrice(2.0, 10.0), "Equilíbrio entre qualidade e custo."),
        // Preço de Haiku 5.5 vale para prompts de até 100 mil tokens (os da Aurora são bem menores).
        ModelOption("claude-haiku-5-5", "Claude Haiku 5.5", ModelPrice(0.10, 0.50), "Mais barato e rápido."),
    )

    /**
     * Padrão = o mais barato. Um assistente pessoal faz muitas chamadas curtas; Opus custa ~40x mais por
     * conversa. Quem quiser mais qualidade escolhe outro modelo em Ajustes, sabendo o custo.
     */
    const val DEFAULT_MODEL = "claude-haiku-5-5"

    fun price(modelId: String): ModelPrice = options.firstOrNull { it.id == modelId }?.price
        // Modelo desconhecido: estima pelo mais caro para não subestimar gastos.
        ?: options.maxBy { it.price.outputPerMTok }.price
}
