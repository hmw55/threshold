
package com.thresholdtv

import android.app.Activity
import android.media.MediaPlayer
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
import com.thresholdtv.ui.NavigationMenu
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
    private var ambientPlayer: MediaPlayer? = null
    private var ambientResource: Int? = null
    private var activityResumed = false

    private fun updateAmbientAudio() {
        val gameplayAudio = state is ThresholdState.ExpeditionReady ||
            state is ThresholdState.Playing ||
            state is ThresholdState.Results

        val desiredResource = if (gameplayAudio) {
            R.raw.threshold_ambient
        } else {
            R.raw.threshold_standby
        }

        if (ambientResource != desiredResource) {
            ambientPlayer?.release()
            ambientPlayer = null
            ambientResource = null

            ambientPlayer = MediaPlayer.create(this, desiredResource)?.apply {
                isLooping = true
                val volume = if (gameplayAudio) 0.18f else 0.30f
                setVolume(volume, volume)
            }

            if (ambientPlayer != null) {
                ambientResource = desiredResource
            }
        }

        if (activityResumed) {
            ambientPlayer?.let {
                if (!it.isPlaying) it.start()
            }
        } else {
            ambientPlayer?.let {
                if (it.isPlaying) it.pause()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        updateAmbientAudio()
    }

    override fun onPause() {
        activityResumed = false
        updateAmbientAudio()
        super.onPause()
    }
    private var showingJoin = false
    private var connecting = false
    private var leaving = false
    private var restoring = false
    private var advancing = false
    private var returningToLobby = false
    private var restarting = false
    private var navigationMenu: NavigationMenu? = null


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

        expedition = ExpeditionScreen(
            context = this,
            onReturnToLobby = ::returnResultsToLobby,
            onNewExpedition = ::startNewExpedition
        )
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

        if (message.startsWith("SESSION EXPIRED")) {
            reset()
            showHome()
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
            return
        }

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
        navigationMenu?.dismiss()
        state = ThresholdState.Idle
        setContentView(home)
        home.activate()
    }

    private fun showLobby() {
        navigationMenu?.dismiss()
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

    private fun showNavigationMenu() {
        if (navigationMenu?.isShowing == true) return
        val activeSession = sessionCode != null && state != ThresholdState.Idle
        val canReturnLobby = state == ThresholdState.Calibrating || state is ThresholdState.Results
        val canStartNew = state is ThresholdState.Results || activeSession
        val items = mutableListOf<NavigationMenu.Item>()
        items += NavigationMenu.Item("RESUME EXPEDITION") { navigationMenu?.dismiss(); requestCurrentFocus() }
        items += NavigationMenu.Item("RETURN TO LOBBY", canReturnLobby) {
            navigationMenu?.dismiss()
            if (state is ThresholdState.Results) returnResultsToLobby() else returnToLobby()
        }
        items += NavigationMenu.Item("LEAVE EXPEDITION", activeSession) {
            showNavigationConfirmation(
                "DISCONNECT TERMINAL?",
                "Your TV will leave this expedition. Players and the room remain intact.",
                "LEAVE EXPEDITION"
            ) { leaveExpedition(force = true) }
        }
        items += NavigationMenu.Item("START NEW EXPEDITION", canStartNew) {
            showNavigationConfirmation(
                "START A NEW CASE?",
                "The current case will close on this TV and a fresh expedition will open.",
                "START NEW EXPEDITION"
            ) {
                startNewExpedition()
            }
        }
        items += NavigationMenu.Item("REJOIN SAVED EXPEDITION", sessions.hasSavedExpedition()) {
            navigationMenu?.dismiss()
            reset()
            restoring = true
            connecting = true
            state = ThresholdState.AwaitingPlayers
            showLobby()
            sessions.restorePreviousExpedition()
        }
        navigationMenu = NavigationMenu(
            this,
            title = if (activeSession) "CASE ${sessionCode ?: "----"}" else "STANDBY",
            message = "REMOTE MENU // SELECT AN ACTION. BACK RETURNS TO THE SIGNAL.",
            items = items,
            onDismissed = { navigationMenu = null }
        ).also { it.show() }
    }

    private fun showNavigationConfirmation(title: String, message: String, confirmLabel: String, confirm: () -> Unit) {
        navigationMenu?.dismiss()
        navigationMenu = NavigationMenu(
            this,
            title = title,
            message = message,
            items = listOf(
                NavigationMenu.Item(confirmLabel) { navigationMenu?.dismiss(); confirm() },
                NavigationMenu.Item("CANCEL") { navigationMenu?.dismiss(); showNavigationMenu() }
            ),
            onDismissed = { navigationMenu = null }
        ).also { it.show() }
    }

    private fun requestCurrentFocus() {
        when (state) {
            ThresholdState.Calibrating -> calibration.requestFocus()
            ThresholdState.AwaitingPlayers -> lobby.requestFocus()
            is ThresholdState.Playing, is ThresholdState.Results -> expedition.requestFocus()
            else -> home.requestFocus()
        }
    }

    private fun returnResultsToLobby() {
        if (returningToLobby || leaving || connecting || state !is ThresholdState.Results) return
        returningToLobby = true
        sessions.back(
            onSuccess = { session ->
                returningToLobby = false
                applySessionPhase(session)
            },
            onFailure = { message ->
                returningToLobby = false
                android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
            }
        )
    }

    private fun startNewExpedition() {
        if (leaving || connecting) return
        if (state == ThresholdState.Idle) createExpedition()
        else leaveExpedition(force = true, afterLeave = ::createExpedition)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN &&
            (event.keyCode == KeyEvent.KEYCODE_MENU || event.keyCode == KeyEvent.KEYCODE_GUIDE)
        ) {
            if (navigationMenu?.isShowing == true) navigationMenu?.dismiss()
            else showNavigationMenu()
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN &&
            (state is ThresholdState.Playing || state is ThresholdState.Results)
        ) {
            val key = event.keyCode

            if (key == KeyEvent.KEYCODE_BACK) {
                if (expedition.collapseMonitor()) return true
                return false
            }

            if (expedition.hasResultsActions()) {
                return super.dispatchKeyEvent(event)
            }

            if (expedition.isMonitorFocused()) {
                return super.dispatchKeyEvent(event)
            }

            if (state is ThresholdState.Playing &&
                (expedition.isChoosingFieldVerdict() ||
                 expedition.isChoosingEnding() ||
                 expedition.isChoosingTerminal())
            ) {
                return super.dispatchKeyEvent(event)
            }

            val handled = when (key) {
                KeyEvent.KEYCODE_DPAD_UP -> expedition.moveMonitor(2)
                KeyEvent.KEYCODE_DPAD_DOWN -> expedition.moveMonitor(0)
                KeyEvent.KEYCODE_DPAD_LEFT -> expedition.moveMonitor(3)
                KeyEvent.KEYCODE_DPAD_RIGHT -> expedition.moveMonitor(1)
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> expedition.expandMonitor()
                else -> false
            }

            if (handled) return true
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(
        keyCode: Int,
        event: KeyEvent?
    ): Boolean {
        if (expedition.hasResultsActions()) {
            return super.onKeyDown(keyCode, event)
        }
        if (expedition.isMonitorFocused()) {
            return super.onKeyDown(keyCode, event)
        }
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
        if (state is ThresholdState.Playing ||
            state is ThresholdState.Results) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP ->
                    return expedition.moveMonitor(2)

                KeyEvent.KEYCODE_DPAD_DOWN ->
                    return expedition.moveMonitor(0)

                KeyEvent.KEYCODE_DPAD_LEFT ->
                    return expedition.moveMonitor(3)

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
        updateAmbientAudio()
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

    private fun leaveExpedition(force: Boolean = false, afterLeave: (() -> Unit)? = null) {
        if (leaving || connecting) return
        if (state != ThresholdState.AwaitingPlayers &&
            state !is ThresholdState.Results &&
            !(state is ThresholdState.Playing && (force || expedition.isFieldComplete())) &&
            !(force && state == ThresholdState.Calibrating)) return

        leaving = true
        lobby.setLeaving(true)

        sessions.leave(
            onSuccess = {
                leaving = false
                lobby.setLeaving(false)
                reset()
                afterLeave?.invoke() ?: showHome()
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
        if (navigationMenu?.isShowing == true) {
            navigationMenu?.dismiss()
            return
        }
        if (state is ThresholdState.Playing && expedition.collapseMonitor()) {
            return
        }
        when {
            showingJoin -> cancelJoin()

            state == ThresholdState.AwaitingPlayers || state is ThresholdState.Results ||
                state is ThresholdState.Playing || state == ThresholdState.Calibrating -> showNavigationMenu()

            state == ThresholdState.Calibrating -> {
                returnToLobby()
            }

            else -> super.onBackPressed()
        }
    }

    override fun onDestroy() {
        ambientPlayer?.release()
        ambientPlayer = null
        sessions.stop()
        home.deactivate()
        join.deactivate()
        lobby.stop()
        calibration.stop()
        super.onDestroy()
    }
}
