
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
                        if (active && generation == currentGeneration) {
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

    fun stop() {
        active = false
        generation++
        code = null
        zone = null
        handler.removeCallbacks(poll)
    }
}
