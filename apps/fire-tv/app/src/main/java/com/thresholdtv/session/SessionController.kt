
package com.thresholdtv.session

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.thresholdtv.BuildConfig

class SessionController(
    context: Context,
    private val onUpdate: (ExpeditionSession, String) -> Unit,
    private val onError: (String) -> Unit
) {
    private val client = SessionClient(
        context.applicationContext,
        BuildConfig.SESSION_SERVICE_URL
    )

    private val handler = Handler(Looper.getMainLooper())

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

                    handler.post {
                        if (active && !leaving && generation == currentGeneration) {
                            onUpdate(session, zone.orEmpty())
                        }
                    }
                } catch (e: Exception) {
                    Log.w("Threshold", "Polling failed", e)
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

    private fun connect(
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

                    onUpdate(connection.session, zone.orEmpty())
                    handler.post(poll)
                }
            } catch (e: Exception) {
                Log.e("Threshold", "Connection failed", e)

                handler.post {
                    if (!active || generation != currentGeneration) {
                        return@post
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
                    client.returnToLobby(currentCode)

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
                    client.restartExpedition(currentCode)

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
