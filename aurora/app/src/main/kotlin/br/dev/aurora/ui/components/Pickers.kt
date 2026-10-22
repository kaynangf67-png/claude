@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.text.PtBrFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

@Composable
fun DateButton(date: LocalDate?, placeholder: String, onChange: (LocalDate?) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = modifier) {
        Text(date?.let { PtBrFormat.day(it, LocalDate.now()) } ?: placeholder)
    }
    if (open) {
        // O DatePicker trabalha com meia-noite UTC.
        val state = rememberDatePickerState(
            initialSelectedDateMillis = (date ?: LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    onChange(state.selectedDateMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() })
                    open = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { onChange(null); open = false }) { Text("Sem data") }
            },
        ) { DatePicker(state = state) }
    }
}

@Composable
fun TimeButton(time: LocalTime?, placeholder: String, onChange: (LocalTime?) -> Unit, modifier: Modifier = Modifier, allowClear: Boolean = true) {
    var open by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = modifier) {
        Text(time?.let { PtBrFormat.time(it) } ?: placeholder)
    }
    if (open) {
        val initial = time ?: LocalTime.now().plusHours(1).withMinute(0)
        val state = rememberTimePickerState(initialHour = initial.hour, initialMinute = initial.minute, is24Hour = true)
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text("Horário") },
            text = { TimePicker(state = state) },
            confirmButton = {
                TextButton(onClick = { onChange(LocalTime.of(state.hour, state.minute)); open = false }) { Text("OK") }
            },
            dismissButton = {
                if (allowClear) TextButton(onClick = { onChange(null); open = false }) { Text("Sem horário") }
                else TextButton(onClick = { open = false }) { Text("Cancelar") }
            },
        )
    }
}

enum class RecurrenceChoice(val label: String) {
    NONE("Não repete"),
    DAILY("Todo dia"),
    WEEKDAYS("Dias úteis"),
    WEEKLY("Toda semana"),
    MONTHLY("Todo mês"),
    ;

    fun toRecurrence(date: LocalDate?): Recurrence? = when (this) {
        NONE -> null
        DAILY -> Recurrence(Frequency.DAILY)
        WEEKDAYS -> Recurrence(Frequency.WEEKLY, 1, Recurrence.WEEKDAYS)
        WEEKLY -> Recurrence(Frequency.WEEKLY, 1, setOf((date ?: LocalDate.now()).dayOfWeek))
        MONTHLY -> Recurrence(Frequency.MONTHLY)
    }

    companion object {
        fun from(r: Recurrence?): RecurrenceChoice = when {
            r == null -> NONE
            r.frequency == Frequency.DAILY -> DAILY
            r.frequency == Frequency.WEEKLY && r.daysOfWeek == Recurrence.WEEKDAYS -> WEEKDAYS
            r.frequency == Frequency.WEEKLY -> WEEKLY
            else -> MONTHLY
        }
    }
}

@Composable
fun RecurrenceSelector(value: RecurrenceChoice, onChange: (RecurrenceChoice) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        RecurrenceChoice.entries.forEach { choice ->
            FilterChip(selected = value == choice, onClick = { onChange(choice) }, label = { Text(choice.label) })
        }
    }
}
