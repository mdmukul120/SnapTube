package com.example.ui.navigation

import kotlinx.serialization.Serializable

@Serializable
sealed interface MetaTubeRoute {
    @Serializable
    data object Splash : MetaTubeRoute

    @Serializable
    data object Home : MetaTubeRoute

    @Serializable
    data class Search(val initialQuery: String = "") : MetaTubeRoute

    @Serializable
    data class Player(val videoId: String) : MetaTubeRoute

    @Serializable
    data class MyFiles(val initialTab: Int = 0) : MetaTubeRoute

    @Serializable
    data object Settings : MetaTubeRoute
}
