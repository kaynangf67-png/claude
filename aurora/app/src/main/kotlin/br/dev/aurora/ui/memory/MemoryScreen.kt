@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.memory

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.Note
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.ConfirmDialog
import br.dev.aurora.ui.components.EmptyText

private sealed interface Editing {
    data class NoteEdit(val note: Note?) : Editing
    data class MemoryEdit(val entry: MemoryEntry?) : Editing
}

@Composable
fun MemoryScreen(openNewNote: Boolean) {
    val vm = appViewModel { MemoryViewModel(it) }
    val tab by vm.tab.collectAsStateWithLifecycle()
    val query by vm.query.collectAsStateWithLifecycle()
    val notes by vm.notes.collectAsStateWithLifecycle()
    val memories by vm.memories.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var editing by remember { mutableStateOf<Editing?>(null) }
    var deleteNote by remember { mutableStateOf<Note?>(null) }
    var deleteMemory by remember { mutableStateOf<MemoryEntry?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    var openedNew by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(openNewNote) {
        if (openNewNote && !openedNew) {
            openedNew = true
            vm.setTab(MemoryTab.NOTES)
            editing = Editing.NoteEdit(null)
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Memória") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
        floatingActionButton = {
            FloatingActionButton(onClick = { editing = if (tab == MemoryTab.NOTES) Editing.NoteEdit(null) else Editing.MemoryEdit(null) }) {
                Icon(Icons.Filled.Add, if (tab == MemoryTab.NOTES) "Nova nota" else "Novo fato")
            }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = tab == MemoryTab.NOTES, onClick = { vm.setTab(MemoryTab.NOTES) }, label = { Text("Notas") })
                    FilterChip(selected = tab == MemoryTab.MEMORY, onClick = { vm.setTab(MemoryTab.MEMORY) }, label = { Text("Fatos e preferências") })
                }
            }
            item {
                OutlinedTextField(
                    value = query, onValueChange = { vm.query.value = it }, modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Buscar") }, singleLine = true, leadingIcon = { Icon(Icons.Filled.Search, null) },
                )
            }
            if (tab == MemoryTab.NOTES) {
                if (notes.isEmpty()) item { EmptyText("Nenhuma nota. Diga \"anota: …\" ou toque em +.") }
                items(notes, key = { it.id }) { note ->
                    Card(
                        Modifier.fillMaxWidth().clickable { editing = Editing.NoteEdit(note) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Row(Modifier.padding(start = 16.dp, top = 10.dp, bottom = 10.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(note.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(note.content, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = {
                                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, note.content)
                                context.startActivity(Intent.createChooser(send, "Compartilhar nota").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                            }) { Icon(Icons.Filled.Share, "Compartilhar") }
                            IconButton(onClick = { deleteNote = note }) { Icon(Icons.Filled.Delete, "Excluir") }
                        }
                    }
                }
            } else {
                item {
                    Text(
                        "Só fica guardado aqui o que você pediu para lembrar. Quando a IA é usada, apenas os itens relacionados ao pedido são enviados.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (memories.isEmpty()) item { EmptyText("Nada guardado. Diga \"lembra que eu prefiro…\".") }
                items(memories, key = { it.id }) { entry ->
                    Card(
                        Modifier.fillMaxWidth().clickable { editing = Editing.MemoryEdit(entry) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Row(Modifier.padding(start = 16.dp, top = 10.dp, bottom = 10.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(entry.content, style = MaterialTheme.typography.bodyLarge)
                                Text(entry.category.label.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = { deleteMemory = entry }) { Icon(Icons.Filled.Delete, "Excluir") }
                        }
                    }
                }
                if (memories.isNotEmpty()) {
                    item { TextButton(onClick = { confirmClear = true }) { Text("Apagar toda a memória", color = MaterialTheme.colorScheme.error) } }
                }
            }
        }
    }

    when (val e = editing) {
        is Editing.NoteEdit -> NoteDialog(e.note, onDismiss = { editing = null }) { title, content ->
            vm.saveNote(e.note?.id ?: 0L, title, content)
            editing = null
        }
        is Editing.MemoryEdit -> MemoryDialog(e.entry, onDismiss = { editing = null }) { content, category ->
            vm.saveMemory(e.entry, content, category)
            editing = null
        }
        null -> Unit
    }
    deleteNote?.let { n -> ConfirmDialog("Excluir nota?", "\"${n.title}\" será apagada.", "Excluir", { vm.deleteNote(n) }, { deleteNote = null }) }
    deleteMemory?.let { m -> ConfirmDialog("Esquecer isto?", "\"${m.content}\" será apagado da memória.", "Apagar", { vm.deleteMemory(m) }, { deleteMemory = null }) }
    if (confirmClear) {
        ConfirmDialog("Apagar toda a memória?", "Todos os fatos e preferências guardados serão apagados. Notas não são afetadas.", "Apagar tudo", vm::clearMemory) { confirmClear = false }
    }
}

@Composable
private fun NoteDialog(note: Note?, onDismiss: () -> Unit, onSave: (String, String) -> Unit) {
    var title by remember { mutableStateOf(note?.title.orEmpty()) }
    var content by remember { mutableStateOf(note?.content.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (note == null) "Nova nota" else "Editar nota") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("Título (opcional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(content, { content = it }, label = { Text("Conteúdo") }, modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp))
            }
        },
        confirmButton = { TextButton(onClick = { onSave(title, content) }, enabled = content.isNotBlank()) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun MemoryDialog(entry: MemoryEntry?, onDismiss: () -> Unit, onSave: (String, MemoryCategory) -> Unit) {
    var content by remember { mutableStateOf(entry?.content.orEmpty()) }
    var category by remember { mutableStateOf(entry?.category ?: MemoryCategory.FACT) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (entry == null) "Guardar na memória" else "Editar memória") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(content, { content = it }, label = { Text("O que lembrar") }, modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(MemoryCategory.FACT, MemoryCategory.PREFERENCE, MemoryCategory.PROJECT).forEach { c ->
                        FilterChip(selected = category == c, onClick = { category = c }, label = { Text(c.label.replaceFirstChar { it.uppercase() }) })
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(content, category) }, enabled = content.isNotBlank()) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
