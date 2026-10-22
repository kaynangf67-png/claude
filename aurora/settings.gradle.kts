pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "aurora"

// Domínio puro (Kotlin/JVM). Build separada para poder ser compilada e testada sem o Android SDK:
//   ./gradlew -p core test
includeBuild("core")
include(":app")
