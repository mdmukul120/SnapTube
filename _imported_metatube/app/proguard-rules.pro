# MetaTube Release ProGuard / R8 Rules
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Kotlinx Serialization & Type-Safe Navigation Routes
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.example.model.**$$serializer { *; }
-keepclassmembers class com.example.model.** {
    *** Companion;
}
-keep,includedescriptorclasses class com.example.ui.navigation.**$$serializer { *; }
-keep class com.example.ui.navigation.** { *; }
-keep class com.example.model.** { *; }

# Room Database & Entities
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class com.example.data.local.** { *; }
-dontwarn androidx.room.**

# OkHttp & Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Media3 ExoPlayer & DataSource
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Coil Image Loading
-keep class coil.** { *; }
-dontwarn coil.**

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-dontwarn kotlinx.coroutines.**

# WebView JS compatibility (used by embedded fallback player)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
