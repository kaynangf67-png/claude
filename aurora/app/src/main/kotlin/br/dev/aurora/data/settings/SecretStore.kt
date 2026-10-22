package br.dev.aurora.data.settings

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.secretsDataStore: DataStore<Preferences> by preferencesDataStore(name = "secrets")

/**
 * Guarda a chave de API cifrada com AES-256-GCM. A chave de cifra fica no Android Keystore e não sai do
 * aparelho. Limite honesto: protege contra leitura casual do armazenamento e backups, não contra quem tem
 * controle total (root) do aparelho com o app em execução.
 */
class SecretStore(private val context: Context) {
    private val store get() = context.secretsDataStore
    private val apiKeyPref = stringPreferencesKey("anthropic_api_key_enc")

    val hasApiKey: Flow<Boolean> = store.data.map { it[apiKeyPref] != null }

    suspend fun saveApiKey(apiKey: String) {
        val clean = apiKey.trim()
        require(clean.isNotEmpty())
        val encrypted = encrypt(clean.toByteArray(Charsets.UTF_8))
        store.edit { it[apiKeyPref] = encrypted }
    }

    /** null se não houver chave ou se ela não puder mais ser decifrada (ex.: chave do Keystore apagada). */
    suspend fun apiKey(): String? {
        val enc = store.data.first()[apiKeyPref] ?: return null
        return runCatching { String(decrypt(enc), Charsets.UTF_8) }.getOrElse {
            clearApiKey()
            null
        }
    }

    suspend fun clearApiKey() {
        store.edit { it.remove(apiKeyPref) }
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val iv = cipher.iv
        val out = iv + cipher.doFinal(plain)
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): ByteArray {
        val data = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = data.copyOfRange(0, IV_SIZE)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        return cipher.doFinal(data, IV_SIZE, data.size - IV_SIZE)
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "aurora_api_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE = 12
    }
}
