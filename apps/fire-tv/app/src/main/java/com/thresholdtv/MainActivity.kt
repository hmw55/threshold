
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
import com.thresholdtv.ui.screens.CalibrationScreen
import com.thresholdtv.ui.screens.ExpeditionScreen
import com.thresholdtv.ui.screens.OpeningBriefingScreen
import com.thresholdtv.ui.screens.LobbyScreen
import android.view.WindowManager

class MainActivity : Activity() {

    private lateinit var home: HomeScreen
    private lateinit var join: JoinExpeditionScreen
    private lateinit var lobby: LobbyScreen
    private lateinit var calibration: CalibrationScreen
    private lateinit var expedition: ExpeditionScreen
    private lateinit var openingScreen: OpeningBriefingScreen
    private lateinit var sessions: SessionController

    private var state: ThresholdState = ThresholdState.Idle
    private var showingJoin = false
    private var connecting = false
    private var leaving = false
    private var restoring = false
    private var advancing = false
    private var returningToLobby = false
    private var restarting = false


    private var sessionCode: String? = null
    private var connectedThresholds: List<ConnectedThreshold> = emptyList()
    private var playerNames: List<String> = emptyList()
    private var localZone: String = ""

    private var openingBriefing: org.json.JSONObject? = null
    private var openingRequestedFor: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessions = SessionController(
            context = this,
            onUpdate = ::onSessionUpdate,
            onAdventureUpdate = ::onAdventureUpdate,
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

        calibration = CalibrationScreen(
            context = this,
            onBack = ::returnToLobby,
            onContinue = ::advance
        )

        expedition = ExpeditionScreen(this)
        openingScreen = OpeningBriefingScreen(this, ::advance)

        if (sessions.hasSavedExpedition()) {
            restoring = true
            connecting = true
            state = ThresholdState.AwaitingPlayers

            showLobby()
            sessions.restorePreviousExpedition()
        } else {
            showHome()
        }

    }

    private fun updateScreenAwake(keepAwake: Boolean) {
        if (keepAwake) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
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
        if (state == ThresholdState.Idle && !showingJoin && !restoring) {
            return
        }

        connecting = false
        restoring = false

        if (showingJoin) {
            showingJoin = false
            join.deactivate()
            state = ThresholdState.AwaitingPlayers
        }

        if (state == ThresholdState.Idle) {
            state = ThresholdState.AwaitingPlayers
        }

        sessionCode = session.code
        playerNames = session.playerNames
        connectedThresholds = session.thresholds
        localZone = zone

        if (state == ThresholdState.AwaitingPlayers) {
            showLobby()
        }

        if (!advancing && !returningToLobby && !restarting) {
            applySessionPhase(session)
        }
    }

    private var latestAdventure: org.json.JSONObject? = null

    private fun onAdventureUpdate(
        code: String,
        adventure: org.json.JSONObject
    ) {
        if (sessionCode != code) return

        latestAdventure = adventure

        if (state is ThresholdState.Playing || state is ThresholdState.Results) {
            expedition.update(adventure)
        }

        val game = adventure.optJSONObject("game")
        val phase = game?.optString("timelinePhase")?.takeIf { it.isNotBlank() }
            ?: game?.optString("phase", "unknown")
            ?: "unknown"

        android.util.Log.d(
            "Threshold",
            "Adventure phase updated: $phase"
        )
    }

    private fun onSessionError(message: String) {
        connecting = false
        restoring = false

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

    private var submittingEnding = false

    private fun submitEnding() {
        if (submittingEnding) return
        val ending = expedition.selectedDecision() ?: return
        submittingEnding = true
        sessions.chooseEnding(
            ending = ending,
            onSuccess = { submittingEnding = false },
            onFailure = { message ->
                submittingEnding = false
                android.widget.Toast.makeText(
                    this, message, android.widget.Toast.LENGTH_LONG
                ).show()
            }
        )
    }

    private var submittingTerminal = false

    private var submittingFieldVerdict = false

    private fun submitFieldVerdict() {
        if (submittingFieldVerdict) return
        val choice = expedition.selectedFieldVerdict() ?: return
        submittingFieldVerdict = true
        sessions.submitFieldVerdict(choice, onSuccess = { submittingFieldVerdict = false; expedition.update(it) }, onFailure = { message -> submittingFieldVerdict = false; android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show() })
    }

    private fun submitTerminal() {
        if (submittingTerminal) return
        val choice = expedition.selectedTerminalChoice() ?: return
        submittingTerminal = true
        sessions.submitTerminalDecision(
            choice = choice,
            onSuccess = { result ->
                submittingTerminal = false
                expedition.terminalResult(
                    result.optBoolean("correct"),
                    result.optString("narration")
                )
            },
            onFailure = { message ->
                submittingTerminal = false
                expedition.terminalResult(false, message)
            }
        )
    }

    override fun onKeyDown(
        keyCode: Int,
        event: KeyEvent?
    ): Boolean {
        if (state is ThresholdState.Playing && expedition.isChoosingFieldVerdict()) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP -> { expedition.moveFieldVerdict(-1); return true }
                KeyEvent.KEYCODE_DPAD_DOWN -> { expedition.moveFieldVerdict(1); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { submitFieldVerdict(); return true }
            }
        }
        if (state is ThresholdState.Playing && expedition.isChoosingEnding()) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP -> {
                    expedition.moveDecision(-1)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    expedition.moveDecision(1)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                    submitEnding()
                    return true
                }
            }
        }
        if (state is ThresholdState.Playing && expedition.isChoosingTerminal()) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP -> {
                    expedition.moveTerminalSelection(-1)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    expedition.moveTerminalSelection(1)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                    submitTerminal()
                    return true
                }
            }
        }
        if (state is ThresholdState.Playing) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP,
                KeyEvent.KEYCODE_DPAD_DOWN ->
                    return expedition.moveMonitor(0)

                KeyEvent.KEYCODE_DPAD_LEFT,
                KeyEvent.KEYCODE_DPAD_RIGHT ->
                    return expedition.moveMonitor(1)

                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER ->
                    return expedition.expandMonitor()

                KeyEvent.KEYCODE_BACK ->
                    if (expedition.collapseMonitor()) return true
            }
        }

        if (
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER
        ) {
            if (state is ThresholdState.Playing) {
                // Narrative progression is controlled by the game engine,
                // not by advancing the expedition session lifecycle.
                return true
            }

            if (
                state != ThresholdState.Idle &&
                state != ThresholdState.AwaitingPlayers
            ) {
                advance()
                return true
            }
        }

        return super.onKeyDown(keyCode, event)
    }


    private fun advance() {
        if (advancing || restarting || returningToLobby || leaving || connecting) return

        val currentCode = sessionCode ?: return

        if (state == ThresholdState.Idle) return

        if (state is ThresholdState.Results) {
            restartExpedition()
            return
        }

        advancing = true

        sessions.advance(
            onSuccess = { session ->
                advancing = false

                if (sessionCode != currentCode) return@advance

                applySessionPhase(session)
            },
            onFailure = { message ->
                advancing = false

                android.widget.Toast.makeText(
                    this,
                    message,
                    android.widget.Toast.LENGTH_LONG
                ).show()
            }
        )
    }


    private fun returnToLobby() {
        if (returningToLobby || advancing || leaving || connecting) return
        if (state != ThresholdState.Calibrating) return

        val currentCode = sessionCode ?: return

        returningToLobby = true

        sessions.back(
            onSuccess = { session ->
                returningToLobby = false

                if (sessionCode != currentCode) return@back

                applySessionPhase(session)
            },
            onFailure = { message ->
                returningToLobby = false

                android.widget.Toast.makeText(
                    this,
                    message,
                    android.widget.Toast.LENGTH_LONG
                ).show()
            }
        )
    }


    private fun restartExpedition() {
        if (restarting || advancing || returningToLobby || leaving || connecting) return
        if (state !is ThresholdState.Results) return

        val currentCode = sessionCode ?: return

        restarting = true

        sessions.restart(
            onSuccess = { session ->
                restarting = false

                if (sessionCode != currentCode) return@restart

                applySessionPhase(session)
            },
            onFailure = { message ->
                restarting = false

                android.widget.Toast.makeText(
                    this,
                    message,
                    android.widget.Toast.LENGTH_LONG
                ).show()
            }
        )
    }

    private fun applySessionPhase(session: ExpeditionSession) {
        val nextState = when (session.phase) {
            "lobby" -> ThresholdState.AwaitingPlayers

            "calibrating" -> ThresholdState.Calibrating

            "ready" -> ThresholdState.ExpeditionReady(
                expeditionId = session.code,
                sectorCount = 1,
                playerCount = session.playerNames.size
            )

            "playing" -> ThresholdState.Playing(session.code)

            "results" -> ThresholdState.Results(session.code)

            else -> return
        }

        if (state == nextState) return

        calibration.stop()

        state = nextState

        if (nextState == ThresholdState.AwaitingPlayers) {
            showLobby()
        } else {
            lobby.stop()
            renderState()
        }
    }

    private fun renderState() {
        when (val current = state) {
            ThresholdState.Calibrating -> {
                setContentView(calibration)
                calibration.start()
            }

            is ThresholdState.ExpeditionReady -> {
                val briefing = openingBriefing
                val family = briefing?.optString("family", "")
                    ?.takeIf { it.isNotBlank() } ?: "CLASSIFIED"
                val title = briefing?.optString("title", "")
                    ?.takeIf { it.isNotBlank() } ?: "AWAITING CASE FILE"
                val objective = briefing?.optString("objective", "")
                    ?.takeIf { it.isNotBlank() }
                    ?: "Establishing the investigation briefing."

                openingScreen.showCase(family, title, objective)

                if (openingScreen.parent == null) {
                    setContentView(openingScreen)
                    openingScreen.activate()
                }

                val code = sessionCode
                if (code != null && openingRequestedFor != code) {
                    openingRequestedFor = code
                    sessions.getOpeningBriefing(
                        expeditionCode = code,
                        onSuccess = { result ->
                            if (sessionCode == code &&
                                state is ThresholdState.ExpeditionReady
                            ) {
                                openingBriefing = result
                                renderState()
                            }
                        },
                        onFailure = {
                            if (sessionCode == code) {
                                openingRequestedFor = null
                            }
                        }
                    )
                }
            }

            is ThresholdState.Playing -> {
                setContentView(expedition)

                val adventure = latestAdventure
                if (adventure != null) {
                    expedition.update(adventure)
                } else {
                    expedition.showWaiting()
                }
            }

            is ThresholdState.Results -> {
                setContentView(expedition)
                latestAdventure?.let { expedition.update(it) }
            }

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
        if (state != ThresholdState.AwaitingPlayers &&
            state !is ThresholdState.Results) return

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
        calibration.stop()
        sessionCode = null
        latestAdventure = null
        openingBriefing = null
        openingRequestedFor = null
        connectedThresholds = emptyList()
        playerNames = emptyList()
        localZone = ""
        connecting = false
        showingJoin = false
        leaving = false
        restoring = false
        advancing = false
        returningToLobby = false
        restarting = false

        lobby.setLeaving(false)
        state = ThresholdState.Idle
    }


    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (state is ThresholdState.Playing && expedition.collapseMonitor()) {
            return
        }
        when {
            showingJoin -> cancelJoin()

            state == ThresholdState.AwaitingPlayers ||
                state is ThresholdState.Results -> {
                leaveExpedition()
            }

            state == ThresholdState.Calibrating -> {
                returnToLobby()
            }

            else -> super.onBackPressed()
        }
    }

    override fun onDestroy() {
        sessions.stop()
        home.deactivate()
        join.deactivate()
        lobby.stop()
        calibration.stop()
        super.onDestroy()
    }
}
