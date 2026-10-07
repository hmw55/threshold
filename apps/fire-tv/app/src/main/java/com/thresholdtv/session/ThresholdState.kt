package com.thresholdtv.session

sealed class ThresholdState {

    data object Idle : ThresholdState()

    data object AwaitingPlayers : ThresholdState()

    data object Calibrating : ThresholdState()

    data class ExpeditionReady(
        val expeditionId: String,
        val sectorCount: Int,
        val playerCount: Int
    ) : ThresholdState()

    data class Playing(
        val expeditionId: String
    ) : ThresholdState()

    data class Results(
        val expeditionId: String
    ) : ThresholdState()
}
