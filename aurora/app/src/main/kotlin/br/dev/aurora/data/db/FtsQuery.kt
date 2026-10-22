package br.dev.aurora.data.db

/** Converte texto livre em consulta FTS segura: cada palavra vira prefixo entre aspas, todas obrigatórias. */
object FtsQuery {
    fun build(text: String): String? {
        val words = text.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 2 }.take(8)
        if (words.isEmpty()) return null
        return words.joinToString(" ") { "\"${it.lowercase()}\"*" }
    }
}
