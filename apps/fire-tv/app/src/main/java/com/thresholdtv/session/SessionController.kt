package com.thresholdtv.session

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.thresholdtv.BuildConfig

class SessionController(
    context: Context,
    private val onUpdate: (ExpeditionSession, String) -> Unit,
    private val onAdventureUpdate: (String, org.json.JSONObject) -> Unit,
    private val onError: (String) -> Unit
) {
    private val client = SessionClient(
        context.applicationContext,
        BuildConfig.SESSION_SERVICE_URL
    )

    private val handler = Handler(Looper.getMainLooper())

    private val preferences = context.applicationContext.getSharedPreferences(
        "threshold_session",
        Context.MODE_PRIVATE
    )

    private companion object {
        const val ACTIVE_EXPEDITION_CODE = "active_expedition_code"
    }

    private var active = false
    private var leaving = false
    private var generation = 0
    private var code: String? = null
    private var zone: String? = null

    private val poll = object : Runnable {
        override fun run() {
            val currentCode = code ?: return
            val currentGeneration = generation
            if (!active) return

            Thread {
                try {
                    val session = client.getExpedition(currentCode)

                    val adventure = if (
                        session.phase == "playing" ||
                        session.phase == "results"
                    ) {
                        try {
                            client.getAdventureState(currentCode)
                        } catch (e: Exception) {
                            Log.w("Threshold", "Adventure state unavailable", e)
                            null
                        }
                    } else {
                        null
                    }

                    handler.post {
                        if (active && !leaving && generation == currentGeneration) {
                            onUpdate(session, zone.orEmpty())

                            if (adventure != null) {
                                onAdventureUpdate(currentCode, adventure)
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w("Threshold", "Polling failed", e)
                    if (e is SessionException && e.statusCode in listOf(404, 410)) {
                        handler.post {
                            if (active && generation == currentGeneration) {
                                onError("SESSION EXPIRED // RETURNING TO STANDBY")
                            }
                        }
                    }
                } finally {
                    handler.post {
                        if (active && generation == currentGeneration) {
                            handler.postDelayed(this, 1000L)
                        }
                    }
                }
            }.start()
        }
    }

    fun create() = connect {
        client.createExpedition()
    }

    fun join(expeditionCode: String) = connect {
        client.joinExpedition(expeditionCode)
    }

    fun hasSavedExpedition(): Boolean =
        preferences.getString(ACTIVE_EXPEDITION_CODE, null) != null

    fun restorePreviousExpedition(): Boolean {
        val previousCode = preferences.getString(
            ACTIVE_EXPEDITION_CODE,
            null
        ) ?: return false

        connect(
            operation = {
                client.reconnectExpedition(previousCode)
            },
            clearSavedCodeOnFailure = true
        )

        return true
    }

    private fun connect(
        clearSavedCodeOnFailure: Boolean = false,
        operation: () -> ThresholdConnection
    ) {
        stop()
        active = true
        val currentGeneration = generation

        Thread {
            try {
                val connection = operation()

                handler.post {
                    if (!active || generation != currentGeneration) {
                        return@post
                    }

                    code = connection.session.code
                    zone = connection.threshold.zoneName

                    preferences.edit()
                        .putString(ACTIVE_EXPEDITION_CODE, connection.session.code)
                        .apply()

                    onUpdate(connection.session, zone.orEmpty())
                    handler.post(poll)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Connection failed", e)

                handler.post {
                    if (!active || generation != currentGeneration) {
                        return@post
                    }

                    if (
                        clearSavedCodeOnFailure &&
                        e is SessionException &&
                        e.statusCode in listOf(404, 409, 410)
                    ) {
                        preferences.edit()
                            .remove(ACTIVE_EXPEDITION_CODE)
                            .apply()
                    }

                    active = false
                    generation++

                    val message = when (e) {
                        is SessionException ->
                            "CONNECTION REJECTED (${e.statusCode})"
                        else -> "CONNECTION FAILED"
                    }

                    onError(message)
                }
            }
        }.start()
    }

    fun getOpeningBriefing(
        expeditionCode: String,
        onSuccess: (org.json.JSONObject) -> Unit,
        onFailure: () -> Unit
    ) {
        val currentGeneration = generation

        Thread {
            try {
                val briefing = client.getOpeningBriefing(expeditionCode)

                handler.post {
                    if (active && !leaving && generation == currentGeneration &&
                        code == expeditionCode
                    ) {
                        onSuccess(briefing)
                    }
                }
            } catch (e: Exception) {
                Log.w("Threshold", "Opening briefing unavailable", e)

                handler.post {
                    if (active && generation == currentGeneration &&
                        code == expeditionCode
                    ) {
                        onFailure()
                    }
                }
            }
        }.start()
    }

    fun submitTerminalDecision(
        choice: Int,
        onSuccess: (org.json.JSONObject) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }
        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }
        val currentGeneration = generation
        Thread {
            try {
                val result = client.submitTerminalDecision(currentCode, choice)
                handler.post {
                    if (active && generation == currentGeneration) onSuccess(result)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Terminal decision failed", e)
                handler.post {
                    if (active && generation == currentGeneration) {
                        onFailure(if (e is SessionException)
                            "SIGNAL REJECTED: ${e.errorCode}"
                        else "UNABLE TO CONTACT SESSION SERVICE")
                    }
                }
            }
        }.start()
    }

    fun submitFieldVerdict(
        choice: String,
        onSuccess: (org.json.JSONObject) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run { onFailure("NO ACTIVE EXPEDITION"); return }
        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }
        val currentGeneration = generation
        Thread {
            try {
                val result = client.submitFieldVerdict(currentCode, choice)
                handler.post { if (active && generation == currentGeneration) onSuccess(result) }
            } catch (e: Exception) {
                handler.post { if (active && generation == currentGeneration) onFailure(if (e is SessionException) "VERDICT REJECTED: ${e.errorCode}" else "UNABLE TO CONTACT SESSION SERVICE") }
            }
        }.start()
    }

    fun chooseEnding(
        ending: String,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }
        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }
        val currentGeneration = generation
        Thread {
            try {
                client.chooseEnding(currentCode, ending)
                handler.post {
                    if (active && generation == currentGeneration) onSuccess()
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Final decision failed", e)
                handler.post {
                    if (active && generation == currentGeneration) {
                        onFailure(if (e is SessionException)
                            "DECISION REJECTED: ${e.errorCode}"
                        else "UNABLE TO CONTACT SESSION SERVICE")
                    }
                }
            }
        }.start()
    }

    fun advance(
        onSuccess: (ExpeditionSession) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }

        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }

        val currentGeneration = generation

        Thread {
            try {
                val updatedSession =
                    client.advanceExpedition(currentCode)

                handler.post {
                    if (!active || generation != currentGeneration) {
                        return@post
                    }

                    onUpdate(updatedSession, zone.orEmpty())
                    onSuccess(updatedSession)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Failed to advance Expedition", e)

                handler.post {
                    if (!active || generation != currentGeneration) {
                        return@post
                    }

                    val message = when (e) {
                        is SessionException ->
                            "ADVANCE FAILED (${e.statusCode})"
                        else ->
                            "UNABLE TO CONTACT SESSION SERVICE"
                    }

                    onFailure(message)
                }
            }
        }.start()
    }


    fun back(
        endActiveExpedition: Boolean = false,
        onSuccess: (ExpeditionSession) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }

        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }

        val currentGeneration = generation

        Thread {
            try {
                val updatedSession =
                    client.returnToLobby(currentCode, endActiveExpedition)

                handler.post {
                    if (!active || leaving || generation != currentGeneration) {
                        return@post
                    }

                    onUpdate(updatedSession, zone.orEmpty())
                    onSuccess(updatedSession)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Failed to return to lobby", e)

                handler.post {
                    if (!active || leaving || generation != currentGeneration) {
                        return@post
                    }

                    val message = when (e) {
                        is SessionException ->
                            "RETURN FAILED (${e.statusCode})"
                        else ->
                            "UNABLE TO CONTACT SESSION SERVICE"
                    }

                    onFailure(message)
                }
            }
        }.start()
    }


    fun restart(
        mode: String = "reuse",
        onSuccess: (ExpeditionSession) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }

        if (!active || leaving) {
            onFailure("EXPEDITION NOT AVAILABLE")
            return
        }

        val currentGeneration = generation

        Thread {
            try {
                val updatedSession =
                    client.restartExpedition(currentCode, mode)

                handler.post {
                    if (!active || leaving || generation != currentGeneration) {
                        return@post
                    }

                    onUpdate(updatedSession, zone.orEmpty())
                    onSuccess(updatedSession)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Failed to restart Expedition", e)

                handler.post {
                    if (!active || leaving || generation != currentGeneration) {
                        return@post
                    }

                    val message = when (e) {
                        is SessionException ->
                            "RESTART FAILED (${e.statusCode})"
                        else ->
                            "UNABLE TO CONTACT SESSION SERVICE"
                    }

                    onFailure(message)
                }
            }
        }.start()
    }

    fun leave(
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit
    ) {
        val currentCode = code ?: run {
            onFailure("NO ACTIVE EXPEDITION")
            return
        }

        if (!active || leaving) return

        leaving = true
        handler.removeCallbacks(poll)

        val currentGeneration = generation

        Thread {
            try {
                client.leaveExpedition(currentCode)

                handler.post {
                    if (generation != currentGeneration) return@post

                    stop()

                    preferences.edit()
                        .remove(ACTIVE_EXPEDITION_CODE)
                        .apply()

                    onSuccess()
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Failed to leave Expedition", e)

                handler.post {
                    if (generation != currentGeneration) return@post

                    leaving = false

                    val message = when (e) {
                        is SessionException ->
                            "LEAVE FAILED (${e.statusCode})"
                        else ->
                            "UNABLE TO CONTACT SESSION SERVICE"
                    }

                    onFailure(message)

                    if (active) {
                        handler.post(poll)
                    }
                }
            }
        }.start()
    }

    fun stop() {
        active = false
        leaving = false
        generation++
        code = null
        zone = null
        handler.removeCallbacks(poll)
    }
}
