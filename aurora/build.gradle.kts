plugins {
    alias(libs.plugins.android.application) apply false
    // Fixa a versão do Kotlin usada pelo Kotlin embutido do AGP 9.
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.room) apply false
}
