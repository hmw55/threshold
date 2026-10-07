package com.thresholdtv

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.session.ThresholdState
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private lateinit var titleView: TextView
    private lateinit var messageView: TextView
    private lateinit var actionView: TextView

    private var state: ThresholdState = ThresholdState.Idle

    private var sessionCode: String? = null
    private var playerNames: List<String> = emptyList()
    private val sessionServiceUrl = BuildConfig.SESSION_SERVICE_URL

    private val handler = Handler(Looper.getMainLooper())

    private val pollSession = object : Runnable {
        override fun run() {
            if (state != ThresholdState.AwaitingPlayers) {
                return
            }

            val code = sessionCode ?: return

            Thread {
                var connection: HttpURLConnection? = null

                try {
                    val url = URL("$sessionServiceUrl/sessions/$code")
                    connection = url.openConnection() as HttpURLConnection

                    connection.requestMethod = "GET"
                    connection.connectTimeout = 2000
                    connection.readTimeout = 2000

                    if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                        val body = connection.inputStream
                            .bufferedReader()
                            .use { it.readText() }

                        val session = JSONObject(body)
                        val players = session.getJSONArray("players")

                        val names = buildList {
                            for (index in 0 until players.length()) {
                                val player = players.getJSONObject(index)
                                add(player.getString("name"))
                            }
                        }

                        handler.post {
                            if (state == ThresholdState.AwaitingPlayers) {
                                playerNames = names
                                render()
                            }
                        }
                    }
                } catch (_: Exception) {
                    // A failed local development poll should not crash the app.
                } finally {
                    connection?.disconnect()
                }

                handler.post {
                    if (state == ThresholdState.AwaitingPlayers) {
                        handler.postDelayed(this, 1000)
                    }
                }
            }.start()
        }
    }

    private fun createSession() {
        Thread {
            var connection: HttpURLConnection? = null

            try {
                val url = URL("$sessionServiceUrl/sessions")
                connection = url.openConnection() as HttpURLConnection

                connection.requestMethod = "POST"
                connection.connectTimeout = 2000
                connection.readTimeout = 2000
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(0)

                if (connection.responseCode == HttpURLConnection.HTTP_CREATED) {
                    val body = connection.inputStream
                        .bufferedReader()
                        .use { it.readText() }

                    val session = JSONObject(body)
                    val code = session.getString("code")

                    handler.post {
                        sessionCode = code
                        startSessionPolling()
                        render()
                    }
                }
            } catch (_: Exception) {
                // A failed local development request should not crash the app.
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    private fun startSessionPolling() {
        handler.removeCallbacks(pollSession)
        handler.post(pollSession)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        titleView = TextView(this).apply {
            textSize = 48f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            letterSpacing = 0.18f
        }

        messageView = TextView(this).apply {
            textSize = 20f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
            setPadding(64, 24, 64, 0)
        }

        actionView = TextView(this).apply {
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 48, 0, 0)
        }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)

            addView(titleView)
            addView(messageView)
            addView(actionView)
        }

        setContentView(layout)
        render()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER
        ) {
            advance()
            return true
        }

        return super.onKeyDown(keyCode, event)
    }

    private fun advance() {
        state = when (val current = state) {
            ThresholdState.Idle -> {
                createSession()
                ThresholdState.AwaitingPlayers
            }

            ThresholdState.AwaitingPlayers ->
                if (playerNames.isNotEmpty()) {
                    ThresholdState.Calibrating
                } else {
                    ThresholdState.AwaitingPlayers
                }

            ThresholdState.Calibrating ->
                ThresholdState.ExpeditionReady(
                    expeditionId = "EXP-001",
                    sectorCount = 1,
                    playerCount = 1
                )

            is ThresholdState.ExpeditionReady ->
                ThresholdState.Playing(current.expeditionId)

            is ThresholdState.Playing ->
                ThresholdState.Results(current.expeditionId)

            is ThresholdState.Results ->
                ThresholdState.Idle
        }

        if (state == ThresholdState.AwaitingPlayers) {
            startSessionPolling()
        }

        render()
    }

    private fun render() {
        when (val current = state) {
            ThresholdState.Idle -> {
                titleView.text = "THRESHOLD"
                messageView.text = "Reality is playable."
                actionView.text = "PRESS SELECT TO BEGIN"
            }

            ThresholdState.AwaitingPlayers -> {
                titleView.text = "INITIALIZING"

                messageView.text =
                    if (playerNames.isEmpty()) {
                        "Awaiting Lens connection."
                    } else {
                        playerNames.joinToString("\n")
                    }

                actionView.text =
                    sessionCode?.let { code ->
                        if (playerNames.isEmpty()) {
                            "SESSION CODE: $code"
                        } else {
                            "SESSION CODE: $code\n\nPRESS SELECT WHEN ALL PLAYERS ARE HERE"
                        }
                    } ?: "CREATING SESSION..."
            }

            ThresholdState.Calibrating -> {
                titleView.text = "CALIBRATING"
                messageView.text = "Observe your environment."
                actionView.text = "PRESS SELECT WHEN COMPLETE"
            }

            is ThresholdState.ExpeditionReady -> {
                titleView.text = "ENVIRONMENT ACCEPTED"
                messageView.text =
                    "${current.sectorCount} sector.\n" +
                    "${current.playerCount} player.\n" +
                    "Threshold online.\n\n" +
                    "Architect connection established."

                actionView.text = "PRESS SELECT TO BEGIN EXPEDITION"
            }

            is ThresholdState.Playing -> {
                titleView.text = "EXPEDITION 001"
                messageView.text =
                    "Something in this room\ndoes not belong here."

                actionView.text = "PRESS SELECT TO CONTINUE"
            }

            is ThresholdState.Results -> {
                titleView.text = "EXPEDITION COMPLETE"
                messageView.text =
                    "The Architect has recorded your performance."

                actionView.text = "PRESS SELECT TO RETURN"
            }
        }
    }
}