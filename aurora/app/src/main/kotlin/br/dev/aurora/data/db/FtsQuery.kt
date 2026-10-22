package br.dev.aurora.data.db

/**
 * Converte texto livre em consulta FTS4 segura: cada palavra (só letras e números, em minúsculas) vira uma busca
 * por prefixo e todas são obrigatórias. Minúsculas impedem que "or"/"not" virem operadores do FTS.
 */
object FtsQuery {
    fun build(text: String): String? {
        val words = text.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 2 }.take(8)
        if (words.isEmpty()) return null
        return words.joinToString(" ") { "${it.lowercase()}*" }
    }
}
