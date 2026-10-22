package br.dev.aurora.core.text

/** Utilidades de texto em português. */
object PtText {
    private const val ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüç"
    private const val PLAIN = "aaaaaeeeeiiiiooooouuuuc"

    /**
     * Minúsculas e sem acentos, **preservando o comprimento** (mapeamento 1:1 por caractere).
     * Assim, posições encontradas no texto dobrado valem também para o texto original.
     */
    fun fold(text: String): String {
        val out = CharArray(text.length)
        for (i in text.indices) {
            val c = text[i].lowercaseChar()
            val idx = ACCENTED.indexOf(c)
            out[i] = if (idx >= 0) PLAIN[idx] else c
        }
        return String(out)
    }

    fun collapseSpaces(text: String): String = text.replace(Regex("\\s+"), " ").trim()

    fun capitalizeFirst(text: String): String =
        text.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

    /** Remove os intervalos indicados (posições no texto original) e normaliza espaços. */
    fun removeSpans(text: String, spans: List<IntRange>): String {
        if (spans.isEmpty()) return collapseSpaces(text)
        val keep = BooleanArray(text.length) { true }
        for (span in spans) for (i in span) if (i in text.indices) keep[i] = false
        val sb = StringBuilder()
        for (i in text.indices) sb.append(if (keep[i]) text[i] else ' ')
        return collapseSpaces(sb.toString())
    }

    private val NUMBER_WORDS = mapOf(
        "zero" to 0, "um" to 1, "uma" to 1, "dois" to 2, "duas" to 2, "tres" to 3, "quatro" to 4,
        "cinco" to 5, "seis" to 6, "sete" to 7, "oito" to 8, "nove" to 9, "dez" to 10, "onze" to 11,
        "doze" to 12, "treze" to 13, "quatorze" to 14, "catorze" to 14, "quinze" to 15,
        "dezesseis" to 16, "dezessete" to 17, "dezoito" to 18, "dezenove" to 19, "vinte" to 20,
        "trinta" to 30, "quarenta" to 40, "cinquenta" to 50, "meia" to 30,
    )

    /** Regex (texto dobrado) para números de 0 a 59 por extenso ou em dígitos. */
    const val NUMBER_PATTERN =
        "(?:\\d{1,2}|(?:vinte|trinta|quarenta|cinquenta)(?: e (?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?" +
            "|dezesseis|dezessete|dezoito|dezenove|quatorze|catorze|quinze|treze|doze|onze|dez|nove|oito|sete|seis" +
            "|cinco|quatro|tres|duas|dois|uma|um)"

    /** Converte "23", "vinte e tres" ou "nove" (texto dobrado) em número. */
    fun parseNumber(text: String): Int? {
        val t = text.trim()
        t.toIntOrNull()?.let { return it }
        var total = 0
        for (part in t.split(" e ")) {
            total += NUMBER_WORDS[part.trim()] ?: return null
        }
        return total
    }
}
