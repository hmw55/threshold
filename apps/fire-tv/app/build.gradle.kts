import java.util.Properties

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")

    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use(::load)
    }
}

val sessionServiceUrl =
    localProperties.getProperty("SESSION_SERVICE_URL")
        ?: "http://localhost:3001"

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.thresholdtv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.thresholdtv"
        minSdk = 25
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField(
            "String",
            "SESSION_SERVICE_URL",
            "\"$sessionServiceUrl\""
        )
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
