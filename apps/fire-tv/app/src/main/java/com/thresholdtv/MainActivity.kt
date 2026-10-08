package com.thresholdtv

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.session.ThresholdState
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.screens.HomeScreen
import com.thresholdtv.ui.screens.LobbyScreen
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private lateinit var homeScreen: HomeScreen
    private lateinit var lobbyScreen: LobbyScreen

    private var state: ThresholdState = ThresholdState.Idle

    private var sessionCode: String? = null
    private var playerNames: List<String> = emptyList()

    private val sessionServiceUrl =
        BuildConfig.SESSION_SERVICE_URL

    private val handler =
        Handler(Looper.getMainLooper())

    private val pollSession = object : Runnable {
        override fun run() {
            if (state != ThresholdState.AwaitingPlayers) {
                return
            }

            val code = sessionCode ?: return

            Thread {
                var connection: HttpURLConnection? = null

                try {
                    val url =
                        URL("$sessionServiceUrl/sessions/$code")

                    connection =
                        url.openConnection() as HttpURLConnection

                    connection.requestMethod = "GET"
                    connection.connectTimeout = 2000
                    connection.readTimeout = 2000

                    if (
                        connection.responseCode ==
                        HttpURLConnection.HTTP_OK
                    ) {
                        val body =
                            connection.inputStream
                                .bufferedReader()
                                .use { it.readText() }

                        val session = JSONObject(body)
                        val players =
                            session.getJSONArray("players")

                        val names = buildList {
                            for (
                                index in
                                0 until players.length()
                            ) {
                                val player =
                                    players.getJSONObject(index)

                                add(
                                    player.getString("name")
                                )
                            }
                        }

                        handler.post {
                            if (
                                state ==
                                ThresholdState.AwaitingPlayers
                            ) {
                                playerNames = names
                                render()
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Development polling failures
                    // should not crash Threshold.
                } finally {
                    connection?.disconnect()
                }

                handler.post {
                    if (
                        state ==
                        ThresholdState.AwaitingPlayers
                    ) {
                        handler.postDelayed(
                            this,
                            SESSION_POLL_INTERVAL_MS
                        )
                    }
                }
            }.start()
        }
    }

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(savedInstanceState)

        homeScreen = HomeScreen(
            context = this,
            onBeginExpedition = {
                beginExpedition()
            },
            onAboutThreshold = {
                showAboutThreshold()
            }
        )

        lobbyScreen = LobbyScreen(this)

        render()
    }

    private fun beginExpedition() {
        if (state != ThresholdState.Idle) {
            return
        }

        homeScreen.deactivate()

        state = ThresholdState.AwaitingPlayers

        render()
        createSession()
    }

    private fun showAboutThreshold() {
        // Terminal overlay will live in TerminalView.
    }

    private fun createSession() {
        Thread {
            var connection: HttpURLConnection? = null

            try {
                val url =
                    URL("$sessionServiceUrl/sessions")

                connection =
                    url.openConnection() as HttpURLConnection

                connection.requestMethod = "POST"
                connection.connectTimeout = 2000
                connection.readTimeout = 2000
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(0)

                if (
                    connection.responseCode ==
                    HttpURLConnection.HTTP_CREATED
                ) {
                    val body =
                        connection.inputStream
                            .bufferedReader()
                            .use { it.readText() }

                    val session = JSONObject(body)
                    val code =
                        session.getString("code")

                    handler.post {
                        sessionCode = code

                        startSessionPolling()
                        render()
                    }
                }
            } catch (_: Exception) {
                // Development session failures
                // should not crash Threshold.
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    private fun startSessionPolling() {
        handler.removeCallbacks(pollSession)
        handler.post(pollSession)
    }

    override fun onKeyDown(
        keyCode: Int,
        event: KeyEvent?
    ): Boolean {
        if (state == ThresholdState.Idle) {
            return super.onKeyDown(
                keyCode,
                event
            )
        }

        if (
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER
        ) {
            advance()
            return true
        }

        return super.onKeyDown(
            keyCode,
            event
        )
    }

    private fun advance() {
        state = when (val current = state) {
            ThresholdState.Idle ->
                ThresholdState.Idle

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
                    playerCount =
                        playerNames.size.coerceAtLeast(1)
                )

            is ThresholdState.ExpeditionReady ->
                ThresholdState.Playing(
                    current.expeditionId
                )

            is ThresholdState.Playing ->
                ThresholdState.Results(
                    current.expeditionId
                )

            is ThresholdState.Results ->
                ThresholdState.Idle
        }

        if (state != ThresholdState.AwaitingPlayers) {
            lobbyScreen.stop()
            handler.removeCallbacks(pollSession)
        }

        if (
            state ==
            ThresholdState.AwaitingPlayers
        ) {
            startSessionPolling()
        }

        if (state == ThresholdState.Idle) {
            resetSession()
        }

        render()
    }

    private fun resetSession() {
        handler.removeCallbacks(pollSession)

        sessionCode = null
        playerNames = emptyList()
    }

    private fun render() {
        when (val current = state) {
            ThresholdState.Idle -> {
                setContentView(homeScreen)
                homeScreen.activate()
            }

            ThresholdState.AwaitingPlayers -> {
                lobbyScreen.updateSession(
                    code = sessionCode,
                    players = playerNames
                )

                if (lobbyScreen.parent == null) {
                    setContentView(lobbyScreen)
                }

                lobbyScreen.start()
            }

            ThresholdState.Calibrating -> {
                showTemporaryStateScreen(
                    title = "CALIBRATING",
                    message =
                        "Observe your environment.",
                    action =
                        "PRESS SELECT WHEN COMPLETE"
                )
            }

            is ThresholdState.ExpeditionReady -> {
                showTemporaryStateScreen(
                    title = "ENVIRONMENT ACCEPTED",
                    message =
                        "${current.sectorCount} sector.\n" +
                            "${current.playerCount} player.\n" +
                            "Threshold online.\n\n" +
                            "Architect connection established.",
                    action =
                        "PRESS SELECT TO BEGIN EXPEDITION"
                )
            }

            is ThresholdState.Playing -> {
                showTemporaryStateScreen(
                    title = "EXPEDITION 001",
                    message =
                        "Something in this room\n" +
                            "does not belong here.",
                    action =
                        "PRESS SELECT TO CONTINUE"
                )
            }

            is ThresholdState.Results -> {
                showTemporaryStateScreen(
                    title = "EXPEDITION COMPLETE",
                    message =
                        "The Architect has recorded " +
                            "your performance.",
                    action =
                        "PRESS SELECT TO RETURN"
                )
            }
        }
    }

    /*
     * Transitional renderer.
     *
     * These states will move into their dedicated
     * screen classes as the experience UI is built.
     */
    private fun showTemporaryStateScreen(
        title: String,
        message: String,
        action: String
    ) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER

            setBackgroundColor(
                ThresholdTheme.Colors.Background
            )

            setPadding(64, 48, 64, 48)

            addView(
                createStateText(
                    title,
                    48f,
                    ThresholdTheme.Colors.Primary
                )
            )

            addView(
                createStateText(
                    message,
                    20f,
                    ThresholdTheme.Colors.Secondary
                ).apply {
                    setPadding(64, 24, 64, 0)
                }
            )

            addView(
                createStateText(
                    action,
                    18f,
                    ThresholdTheme.Colors.Primary
                ).apply {
                    setPadding(0, 48, 0, 0)
                }
            )
        }

        setContentView(layout)
    }

    private fun createStateText(
        value: String,
        size: Float,
        color: Int
    ): TextView {
        return TextView(this).apply {
            text = value
            textSize = size

            setTextColor(color)

            gravity = Gravity.CENTER

            typeface =
                ThresholdTheme.Typography.Interface
        }
    }

    override fun onDestroy() {
        homeScreen.deactivate()
        lobbyScreen.stop()
        handler.removeCallbacks(pollSession)

        super.onDestroy()
    }

    companion object {
        private const val SESSION_POLL_INTERVAL_MS =
            1000L
    }
}