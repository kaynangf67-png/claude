package br.dev.aurora.ui.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.Note
import br.dev.aurora.core.text.PtText
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class MemoryTab { NOTES, MEMORY }

class MemoryViewModel(private val c: AppContainer) : ViewModel() {
    val query = MutableStateFlow("")
    private val _tab = MutableStateFlow(MemoryTab.NOTES)
    val tab: StateFlow<MemoryTab> = _tab.asStateFlow()

    private fun matches(text: String, q: String) = q.isBlank() || PtText.fold(text).contains(PtText.fold(q.trim()))

    val notes: StateFlow<List<Note>> = combine(c.notes.observeAll(), query) { all, q ->
        all.filter { matches(it.title + " " + it.content, q) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val memories: StateFlow<List<MemoryEntry>> = combine(c.memory.observeAll(), query) { all, q ->
        all.filter { matches(it.content, q) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setTab(t: MemoryTab) {
        _tab.value = t
    }

    fun saveNote(id: Long, title: String, content: String) {
        if (content.isBlank() && title.isBlank()) return
        viewModelScope.launch {
            val now = Instant.now()
            val existing = if (id != 0L) c.notes.get(id) else null
            val finalTitle = title.trim().ifEmpty { content.trim().split(Regex("\\s+")).take(6).joinToString(" ") }
            c.notes.upsert(
                existing?.copy(title = finalTitle, content = content.trim(), updatedAt = now)
                    ?: Note(title = finalTitle, content = content.trim(), createdAt = now, updatedAt = now),
            )
        }
    }

    fun deleteNote(note: Note) {
        viewModelScope.launch { c.notes.delete(note.id) }
    }

    /** Entradas criadas ou editadas aqui são, por definição, aprovadas pelo usuário. */
    fun saveMemory(entry: MemoryEntry?, content: String, category: MemoryCategory) {
        if (content.isBlank()) return
        viewModelScope.launch {
            val now = Instant.now()
            c.memory.upsert(
                entry?.copy(content = content.trim(), category = category, updatedAt = now, userApproved = true)
                    ?: MemoryEntry(category = category, content = content.trim(), createdAt = now, updatedAt = now, userApproved = true),
            )
        }
    }

    fun deleteMemory(entry: MemoryEntry) {
        viewModelScope.launch { c.memory.delete(entry.id) }
    }

    fun clearMemory() {
        viewModelScope.launch { c.memory.clear() }
    }
}
