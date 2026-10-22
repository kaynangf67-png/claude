package br.dev.aurora

import br.dev.aurora.data.db.FtsQuery
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FtsQueryTest {
    @Test fun `palavras viram prefixos em minusculas`() {
        assertEquals("reunião* vendas*", FtsQuery.build("Reunião, VENDAS!"))
    }

    @Test fun `operadores e aspas sao neutralizados`() {
        assertEquals("a1* or* not*", FtsQuery.build("\"a1\" OR NOT -"))
        assertEquals("x1*", FtsQuery.build("x1 * ( ) ^"))
    }

    @Test fun `texto sem palavras uteis`() {
        assertNull(FtsQuery.build("  ?! a "))
    }
}
