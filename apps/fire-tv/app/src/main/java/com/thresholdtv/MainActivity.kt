
package com.thresholdtv

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.session.ExpeditionSession
import com.thresholdtv.session.SessionController
import com.thresholdtv.session.ThresholdState
import com.thresholdtv.session.ConnectedThreshold
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.screens.HomeScreen
import com.thresholdtv.ui.screens.JoinExpeditionScreen
import com.thresholdtv.ui.screens.LobbyScreen

class MainActivity : Activity() {

    private lateinit var home: HomeScreen
    private lateinit var join: JoinExpeditionScreen
    private lateinit var lobby: LobbyScreen
    private lateinit var sessions: SessionController

    private var state: ThresholdState = ThresholdState.Idle
    private var showingJoin = false
    private var connecting = false
    private var leaving = false

    private var sessionCode: String? = null
    private var connectedThresholds: List<ConnectedThreshold> = emptyList()
    private var playerNames: List<String> = emptyList()
    private var localZone: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessions = SessionController(
            context = this,
            onUpdate = ::onSessionUpdate,
            onError = ::onSessionError
        )

        home = HomeScreen(
            context = this,
            onCreateExpedition = ::createExpedition,
            onJoinExpedition = ::showJoinScreen,
            onAboutThreshold = {}
        )

        join = JoinExpeditionScreen(
            context = this,
            onJoin = ::joinExpedition,
            onCancel = ::cancelJoin
        )

        lobby = LobbyScreen(
            context = this,
            onLeave = ::leaveExpedition,
            onContinue = ::advance
        )

        showHome()
    }

    private fun createExpedition() {
        if (state != ThresholdState.Idle || connecting) return

        connecting = true
        home.deactivate()
        state = ThresholdState.AwaitingPlayers
        showLobby()
        sessions.create()
    }

    private fun showJoinScreen() {
        if (state != ThresholdState.Idle) return

        home.deactivate()
        showingJoin = true
        setContentView(join)
        join.activate()
    }

    private fun joinExpedition(code: String) {
        if (state != ThresholdState.Idle || connecting) return

        connecting = true
        sessions.join(code)
    }

    private fun cancelJoin() {
        if (connecting) return

        showingJoin = false
        join.deactivate()
        showHome()
    }

    private fun onSessionUpdate(
        session: ExpeditionSession,
        zone: String
    ) {
        connecting = false

        if (state == ThresholdState.Idle && !showingJoin) {
            return
        }

        if (showingJoin) {
            showingJoin = false
            join.deactivate()
            state = ThresholdState.AwaitingPlayers
        }

        sessionCode = session.code
        playerNames = session.playerNames
        connectedThresholds = session.thresholds
        localZone = zone

        if (state == ThresholdState.AwaitingPlayers) {
            showLobby()
        }
    }

    private fun onSessionError(message: String) {
        connecting = false

        if (showingJoin) {
            join.showError(message)
            return
        }

        if (state == ThresholdState.AwaitingPlayers) {
            reset()
            showHome()
            android.widget.Toast.makeText(
                this,
                message,
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun showHome() {
        state = ThresholdState.Idle
        setContentView(home)
        home.activate()
    }

    private fun showLobby() {
        lobby.updateSession(
            code = sessionCode,
            players = playerNames,
            thresholds = connectedThresholds,
            localZone = localZone
        )

        if (lobby.parent == null) {
            setContentView(lobby)
        }

        lobby.start()
    }

    override fun onKeyDown(
        keyCode: Int,
        event: KeyEvent?
    ): Boolean {
        if (
            state != ThresholdState.Idle &&
            state != ThresholdState.AwaitingPlayers &&
            (keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                keyCode == KeyEvent.KEYCODE_ENTER)
        ) {
            advance()
            return true
        }

        return super.onKeyDown(keyCode, event)
    }

    private fun advance() {
        state = when (val current = state) {
            ThresholdState.Idle -> return

            ThresholdState.AwaitingPlayers ->
                ThresholdState.Calibrating

            ThresholdState.Calibrating ->
                ThresholdState.ExpeditionReady(
                    expeditionId = sessionCode.orEmpty(),
                    sectorCount = 1,
                    playerCount = playerNames.size
                )

            is ThresholdState.ExpeditionReady ->
                ThresholdState.Playing(current.expeditionId)

            is ThresholdState.Playing ->
                ThresholdState.Results(current.expeditionId)

            is ThresholdState.Results -> {
                reset()
                showHome()
                return
            }
        }

        lobby.stop()
        sessions.stop()
        renderState()
    }

    private fun renderState() {
        when (val current = state) {
            ThresholdState.Calibrating ->
                showState(
                    "CALIBRATING",
                    "Observe your environment.",
                    "PRESS SELECT WHEN COMPLETE"
                )

            is ThresholdState.ExpeditionReady ->
                showState(
                    "ENVIRONMENT ACCEPTED",
                    "${current.sectorCount} sector.\n" +
                        "${current.playerCount} player.\n" +
                        "Architect connection established.",
                    "PRESS SELECT TO BEGIN EXPEDITION"
                )

            is ThresholdState.Playing ->
                showState(
                    "EXPEDITION ${current.expeditionId}",
                    "Something in this room\ndoes not belong here.",
                    "PRESS SELECT TO CONTINUE"
                )

            is ThresholdState.Results ->
                showState(
                    "EXPEDITION COMPLETE",
                    "The Architect has recorded your performance.",
                    "PRESS SELECT TO RETURN"
                )

            else -> Unit
        }
    }

    private fun showState(
        title: String,
        message: String,
        action: String
    ) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(ThresholdTheme.Colors.Background)
            setPadding(64, 48, 64, 48)
        }

        fun addText(value: String, size: Float, color: Int) {
            layout.addView(TextView(this).apply {
                text = value
                textSize = size
                setTextColor(color)
                gravity = Gravity.CENTER
                typeface = ThresholdTheme.Typography.Interface
                setPadding(32, 20, 32, 20)
            })
        }

        addText(title, 48f, ThresholdTheme.Colors.Primary)
        addText(message, 20f, ThresholdTheme.Colors.Secondary)
        addText(action, 18f, ThresholdTheme.Colors.Primary)

        setContentView(layout)
    }

    private fun leaveExpedition() {
        if (leaving || connecting) return
        if (state != ThresholdState.AwaitingPlayers) return

        leaving = true
        lobby.setLeaving(true)

        sessions.leave(
            onSuccess = {
                leaving = false
                lobby.setLeaving(false)
                reset()
                showHome()
            },
            onFailure = { message ->
                leaving = false
                lobby.setLeaving(false)

                android.widget.Toast.makeText(
                    this,
                    message,
                    android.widget.Toast.LENGTH_LONG
                ).show()
            }
        )
    }

    private fun reset() {
        sessions.stop()
        lobby.stop()
        sessionCode = null
        connectedThresholds = emptyList()
        playerNames = emptyList()
        localZone = ""
        connecting = false
        showingJoin = false
        leaving = false
        lobby.setLeaving(false)
        state = ThresholdState.Idle
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        when {
            showingJoin -> cancelJoin()

            state == ThresholdState.AwaitingPlayers -> {
                leaveExpedition()
            }

            else -> super.onBackPressed()
        }
    }

    override fun onDestroy() {
        sessions.stop()
        home.deactivate()
        join.deactivate()
        lobby.stop()
        super.onDestroy()
    }
}
