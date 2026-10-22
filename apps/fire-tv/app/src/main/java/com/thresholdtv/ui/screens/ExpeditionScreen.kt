package com.thresholdtv.ui.screens

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.thresholdtv.ui.components.SurveillanceMonitor
import com.thresholdtv.ui.components.SecurityInterruptionView
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.ui.components.ThresholdButton
import com.thresholdtv.ui.components.GlitchCoordinator
import com.thresholdtv.ui.ThresholdTheme
import org.json.JSONObject

class ExpeditionScreen(
    context: Context,
    private val onReturnToLobby: () -> Unit,
    private val onNewExpedition: () -> Unit
) : LinearLayout(context) {

    private val monitors = listOf(
        SurveillanceMonitor(context, 1, "OPERATIVES"),
        SurveillanceMonitor(context, 2, "WITNESS RECORDS"),
        SurveillanceMonitor(context, 3, "ARCHITECT FEED"),
        SurveillanceMonitor(context, 4, "SYSTEM DIAGNOSTICS")
    )
    private var selectedMonitor = 2
    private var expandedMonitor: Int? = null
    private val interruption = SecurityInterruptionView(context)

    private val expandedContainer = LinearLayout(context).apply {
        orientation = VERTICAL
        visibility = GONE
    }

    private val surveillanceGrid = LinearLayout(context).apply {
        orientation = VERTICAL
        visibility = GONE
    }

    private fun createMonitorRow(start: Int): LinearLayout =
        LinearLayout(context).apply {
            orientation = HORIZONTAL

            for (index in start until start + 2) {
                addView(
                    monitors[index],
                    LayoutParams(0, LayoutParams.MATCH_PARENT, 1f).apply {
                        setMargins(6, 6, 6, 6)
                    }
                )
            }
        }

    private lateinit var legacyPanel: LinearLayout

    private val heading = text(42f, ThresholdTheme.Colors.Primary)
    private val subtitle = text(19f, ThresholdTheme.Colors.GlitchCyan)
    private val progress = text(22f, ThresholdTheme.Colors.Secondary)
    private val evidence = text(19f, ThresholdTheme.Colors.Primary)
    private val transmission = text(22f, ThresholdTheme.Colors.GlitchCyan)
    private val scoreboard = text(19f, ThresholdTheme.Colors.Primary)
    private val footer = text(16f, ThresholdTheme.Colors.Secondary)
    private val decision = text(23f, ThresholdTheme.Colors.GlitchCyan)
    private val resultsActions = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER
        visibility = GONE
    }
    private val returnToLobbyButton = ThresholdButton(context).apply {
        setLabel("RETURN TO LOBBY")
        setOnClickListener { onReturnToLobby() }
    }
    private val newExpeditionButton = ThresholdButton(context).apply {
        setLabel("NEW EXPEDITION")
        setOnClickListener { onNewExpedition() }
    }
    private val resultsGlitch = GlitchCoordinator(
        glitchTitle = {},
        glitchFocusedButton = {
            when {
                returnToLobbyButton.hasFocus() -> returnToLobbyButton.glitch()
                newExpeditionButton.hasFocus() -> newExpeditionButton.glitch()
            }
        }
    )
    private var terminalPrompt = ""
    private var terminalChoices: List<String> = emptyList()
    private var terminalCompleted = false
    private var terminalSelection = 0
    private var terminalFeedback = ""
    private val endings = listOf("preservation", "fracture", "reconciliation")
    private var selectedEnding = 0
    private var canReconcile = false
    private var currentPhase = ""
    private var lastFieldStage: String? = null
    private var fieldChoices = listOf("preserve", "release", "erase")
    private var fieldSelection = 0


    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(ThresholdTheme.Colors.Background)

        val panel = LinearLayout(context).apply {
            orientation = VERTICAL
            setPadding(40, 36, 40, 36)
            background = GradientDrawable().apply {
                setColor(ThresholdTheme.Colors.Surface)
                setStroke(2, ThresholdTheme.Colors.Border)
                cornerRadius = 8f
            }
        }

        legacyPanel = panel
        panel.visibility = GONE

        panel.addView(subtitle)
        panel.addView(heading)
        panel.addView(progress)
        panel.addView(transmission)
        panel.addView(scoreboard)

        val scroll = ScrollView(context).apply {
            isFillViewport = false
            addView(evidence)
        }

        panel.addView(
            scroll,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )
        panel.addView(decision)
        panel.addView(footer)
        resultsActions.addView(returnToLobbyButton, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = 12 })
        resultsActions.addView(newExpeditionButton, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))

        addView(
            panel,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )
        addView(
            resultsActions,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                setMargins(40, 8, 40, 20)
            }
        )

        surveillanceGrid.addView(
            createMonitorRow(0),
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )
        surveillanceGrid.addView(
            createMonitorRow(2),
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )
        addView(
            surveillanceGrid,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )
        addView(
            expandedContainer,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )

        surveillanceGrid.visibility = VISIBLE
        monitors.forEachIndexed { index, monitor ->
            monitor.setOnActivate {
                selectedMonitor = index
                expandMonitor()
            }
        }
        refreshMonitorSelection()

        // Keep the original layout intact; the overlay is attached above it.
        val originalChildren = (0 until childCount).map { getChildAt(it) }
        val originalParams = originalChildren.map { it.layoutParams }
        removeAllViews()

        val wrapper = android.widget.FrameLayout(context)
        val content = LinearLayout(context).apply {
            orientation = VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(ThresholdTheme.Colors.Background)
        }

        originalChildren.forEachIndexed { index, child ->
            removeView(child)
            content.addView(child, originalParams[index])
        }

        wrapper.addView(
            content,
            android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        val signalOverlay = SignalNoiseView(context, transparent = true)
        signalOverlay.importantForAccessibility =
            android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO

        wrapper.addView(
            signalOverlay,
            android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        wrapper.addView(
            interruption,
            android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        addView(
            wrapper,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )

        signalOverlay.start()
        showWaiting()
    }

    private fun text(size: Float, color: Int) =
        TextView(context).apply {
            textSize = size
            setTextColor(color)
            typeface = ThresholdTheme.Typography.Terminal
            setPadding(0, 12, 0, 12)
        }

    fun triggerInterruption(message: String) {
        interruption.trigger(message)
    }

    fun stopInterruption() {
        interruption.stop()
    }

    fun showWaiting() {
        subtitle.text = "ARCHITECT // SIGNAL ACTIVE"
        heading.text = "THE LAST WITNESS"
        progress.text = "Establishing narrative connection..."
        evidence.text = "Awaiting investigation telemetry."
        transmission.text = "ARCHITECT // AWAITING TRANSMISSION"
        scoreboard.text = "SCORES // AWAITING OPERATIVES"
        footer.text = "FOLLOW YOUR LENS"
        decision.text = ""
        currentPhase = ""
        terminalChoices = emptyList()
        terminalFeedback = ""
        refreshGameplayLayout()
        post { if (!hasResultsActions() && !isMonitorFocused()) monitors[selectedMonitor].requestFocus() }
    }

    fun update(data: JSONObject) {
        val game = data.optJSONObject("game") ?: return
        val adventure = data.optJSONObject("adventure")
        val phase = game.optString("timelinePhase", game.optString("phase", "investigation"))
        if (currentPhase != phase) {
            terminalSelection = 0
            terminalFeedback = ""
        }
        currentPhase = phase
        val terminal = data.optJSONObject("terminalChallenge")
        terminalPrompt = terminal?.optString("prompt") ?: ""
        terminalCompleted = terminal?.optBoolean("completed", false) ?: false
        val options = terminal?.optJSONArray("choices")
        terminalChoices = if (options == null) emptyList() else
            (0 until options.length()).map { options.optString(it) }
        val discovered = game.optJSONArray("discoveredEvidence")
        canReconcile = discovered != null && (0 until discovered.length()).any {
            discovered.optString(it) == "missing-testimony"
        }


        subtitle.text = when (phase) {
            "investigation" -> "ACT I // INVESTIGATION"
            "contradiction" -> "ACT II // CONTRADICTION"
            "revelation" -> "ACT III // REVELATION"
            "resolution" -> "FINAL TRANSMISSION // DECISION"
            "complete" -> "TRANSMISSION COMPLETE"
            else -> "ARCHITECT // UNKNOWN SIGNAL"
        }

        heading.text = adventure?.optString("title", "THE LAST WITNESS")
            ?: "THE LAST WITNESS"

        val completed = game.optJSONArray("completedObjectives")
        val interactions = game.optJSONArray("completedInteractions")
        val discoveries = game.optJSONArray("discoveredEvidence")

        progress.text =
            "OBJECTIVES: ${completed?.length() ?: 0}   " +
            "INTERACTIONS: ${interactions?.length() ?: 0}"

        val lines = mutableListOf<String>()

        if (discoveries != null && discoveries.length() > 0) {
            lines.add("RECOVERED EVIDENCE")
            for (i in 0 until discoveries.length()) {
                lines.add("> ${discoveries.optString(i)}")
            }
        } else {
            lines.add("No evidence recovered yet.")
        }

        if (phase == "complete") {
            lines.add("")
            lines.add("ENDING: ${game.optString("ending", "unknown").uppercase()}")
        }

        evidence.text = lines.joinToString("\n")

        val events = data.optJSONArray("events")
        val latestEvent = if (events != null && events.length() > 0) {
            events.optJSONObject(events.length() - 1)
        } else null

        transmission.text = if (latestEvent != null) {
            "ARCHITECT // " + latestEvent.optString("message")
        } else {
            "ARCHITECT // MONITORING THE EXPEDITION"
        }

        val scores = data.optJSONArray("scores")
        val names = data.optJSONObject("playerNames")
        val scoreLines = mutableListOf("OPERATIVE SCOREBOARD")

        if (scores != null && scores.length() > 0) {
            for (i in 0 until scores.length()) {
                val player = scores.optJSONObject(i) ?: continue
                val id = player.optString("playerId")
                val name = names?.optString(id, "OPERATIVE " + (i + 1))
                    ?: "OPERATIVE " + (i + 1)
                scoreLines.add(name + " // " + player.optInt("score") + " PTS")
            }
        } else {
            scoreLines.add("SCORES SEALED UNTIL FINAL TRANSMISSION")
        }

        scoreboard.text = scoreLines.joinToString("\n")
        monitors[0].setContent(scoreLines.drop(1).joinToString("\n"))
        monitors[1].setContent(evidence.text.toString())
        monitors[2].setContent(transmission.text.toString())
        monitors[3].setContent(
            "SYSTEM // ONLINE\n" +
            "PHASE // ${phase.uppercase()}\n" +
            progress.text.toString()
        )

        renderDecision()
        val field = data.optJSONObject("fieldEncounter")
        if (field != null) {
            val fieldStage = field.optString("stage", "survey")
            resultsActions.visibility = if (fieldStage == "complete") VISIBLE else GONE
            if (fieldStage == "complete") resultsGlitch.start() else resultsGlitch.stop()
            val previousFieldStage = lastFieldStage
            if (previousFieldStage != null && previousFieldStage != fieldStage) {
                val alert = when (fieldStage) {
                    "fracture" -> "EVIDENCE CONTRADICTION DETECTED"
                    "verdict" -> "FINAL WITNESS DECISION REQUIRED"
                    "complete" -> "FINAL TRANSMISSION RECORDED"
                    else -> null
                }
                if (alert != null) interruption.trigger(alert)
            }
            lastFieldStage = fieldStage
            fieldChoices = if (fieldStage == "cooperation") listOf("pulse") else listOf("preserve", "release", "erase")
            fieldSelection = fieldSelection.coerceIn(0, fieldChoices.size - 1)
            currentPhase = "field-$fieldStage"
            terminalChoices = emptyList()
            subtitle.text = "ARCHITECT // LIVE ENVIRONMENT"
            heading.text = field.optString("title", "THE LAST WITNESS")
            progress.text = "ENCOUNTER ${field.optInt("progress") + 1} / ${field.optInt("total", 7)} // ${field.optInt("remainingSeconds")}s"
            val cooperation = field.optJSONObject("cooperation")
            if (fieldStage == "cooperation" && cooperation?.optBoolean("pulseAccepted", false) == true) {
                terminalFeedback = "PULSE ACCEPTED // SIGNAL ACKNOWLEDGED"
            }
            transmission.text = if (fieldStage == "fracture") {
                buildString {
                    append("ARCHITECT // EVIDENCE CHALLENGE\n\n")
                    append(field.optString("prompt", ""))
                    append("\n\n")
                    append(field.optString("transmission", ""))
                }
            } else {
                field.optString("transmission", "") + "\n\n" + field.optString("instruction", "")
            }
            val records = field.optJSONArray("prior")
            evidence.text = buildString {
                append("CONFIRMED WITNESS RECORDS\n")
                if (records != null) for (i in 0 until records.length()) {
                    val record = records.optJSONObject(i) ?: continue
                    append("\n> ").append(record.optString("player"))
                        .append(" // ").append(record.optString("object"))
                        .append("\n").append(record.optString("observation"))
                        .append("\n")
                }
                if (records == null || records.length() == 0) append("Awaiting the first observation.")
            }
            decision.text = if (field.optString("stage") == "decision" || field.optString("stage") == "verdict")
                buildString {
                    append("PUBLIC STANCE // ")
                    fieldChoices.forEachIndexed { index, item -> append(if (index == fieldSelection) "> " else "  ").append(item.uppercase()).append("\n") }
                    append("SELECT TO TRANSMIT // LENS VOTES STILL REQUIRED")
                }
            else if (field.optString("stage") == "complete")
                "FINAL DECISION // " + field.optString("ending").uppercase()
            else "WITNESS REPORTS // ${field.optInt("received")} OF ${field.optInt("required")}"

            monitors[1].setContent(evidence.text.toString())
            monitors[2].setContent(transmission.text.toString())
            monitors[3].setContent(
                if (fieldStage == "cooperation") {
                    "SPLIT SIGNAL // " + (cooperation?.optString("terminalRole", "TERMINAL") ?: "TERMINAL") +
                        "\n\nTUNED CHANNELS // " + (cooperation?.optInt("tunedCount") ?: 0) + "/" + (cooperation?.optInt("total") ?: 0) +
                        "\nTERMINAL PULSES // " + (cooperation?.optInt("pulses") ?: 0) +
                        "\nPULSE WINDOW // " + (if (cooperation?.isNull("windowRemainingSeconds") == false) cooperation.optInt("windowRemainingSeconds").toString() + "s; 0 = RETRY BOTH" else "READY") +
                        "\n\n" + (cooperation?.optString("terminalInstruction", "Tune every Lens first, then press SELECT.") ?: "Tune every Lens first, then press SELECT.") +
                        "\n\nPRESS SELECT TO PULSE\n" + (if (terminalFeedback.isNotEmpty()) terminalFeedback else "")
                } else if (fieldStage == "decision" || fieldStage == "verdict") {
                    buildString {
                        append(if (currentPhase == "field-cooperation") "SHARED SIGNAL // SELECT TO PULSE\n\n" else "FINAL VERDICT // PUBLIC STANCE\n\n")
                        fieldChoices.forEachIndexed { index, choice ->
                            append(if (index == fieldSelection) "▶ " else "    ")
                            append(choice.uppercase()).append("\n")
                        }
                        append("\nDPAD UP / DOWN TO SELECT")
                        append("\nPRESS SELECT TO TRANSMIT")
                        append("\nLENS VOTES ALSO REQUIRED")
                    }
                } else if (fieldStage == "complete") {
                    "TRANSMISSION COMPLETE\n\nFINAL DECISION // " +
                        field.optString("ending").uppercase() +
                        "\n\n" +
                        field.optString(
                            "endingTransmission",
                            "FINAL TRANSMISSION UNAVAILABLE."
                        ) +
                        "\n\nBACK // NEW EXPEDITION"
                } else {
                    "SYSTEM // MONITORING\n" +
                        "ENCOUNTER // ${field.optInt("progress") + 1} / ${field.optInt("total", 5)}\n" +
                        "REPORTS // ${field.optInt("received")} / ${field.optInt("required")}\n" +
                        "SIGNAL // ▂▅▃▇▂▄▆▃"
                }
            )
            footer.text = if (fieldStage == "cooperation") "LENSES TUNE // SELECT TO SEND TERMINAL PULSE // MENU // NAVIGATION" else "THE ROOM IS THE GAME // MENU // NAVIGATION"
            if (field.optString("transmission").contains("DECEIT DETECTED") && previousFieldStage != fieldStage) interruption.trigger("DECEIT DETECTED")
            refreshGameplayLayout()
            if (fieldStage == "complete" && !returnToLobbyButton.hasFocus() && !newExpeditionButton.hasFocus()) {
                post { returnToLobbyButton.requestFocus() }
            }
            return
        }
        resultsActions.visibility = GONE
        resultsGlitch.stop()
        footer.text = when (phase) {
            "complete" -> "THE ARCHITECT REMEMBERS"
            "resolution" -> "DPAD UP/DOWN TO SELECT // PRESS SELECT TO CONFIRM"
            else -> if (terminalChoices.isNotEmpty() && !terminalCompleted)
                "DPAD UP/DOWN TO CHOOSE // SELECT TO TRANSMIT"
            else "CONTINUE THE INVESTIGATION ON YOUR LENS // MENU // NAVIGATION"
        }
    }
    private fun refreshGameplayLayout() {
        val requiresDecision = isChoosingFieldVerdict() ||
            isChoosingEnding() || isChoosingTerminal()

        if (requiresDecision && expandedMonitor != null) {
            collapseMonitor()
        }

        // Preserve the cinematic 2x2 surveillance grid during decisions.
        // Decision state remains active for DPAD input handling.
        legacyPanel.visibility = GONE
        surveillanceGrid.visibility =
            if (expandedMonitor != null) GONE else VISIBLE
        expandedContainer.visibility =
            if (expandedMonitor != null) VISIBLE else GONE
        if (!requiresDecision && expandedMonitor == null && !hasResultsActions() && !isMonitorFocused()) {
            post { monitors[selectedMonitor].requestFocus() }
        }
    }

    private fun renderDecision() {
        if (currentPhase != "resolution") {
            decision.text = when {
                terminalCompleted -> "TERMINAL SIGNAL VERIFIED // LENS INVESTIGATION CONTINUES"
                terminalChoices.isEmpty() -> ""
                else -> buildString {
                    append("TERMINAL CHALLENGE // ").append(terminalPrompt).append("\n")
                    terminalChoices.forEachIndexed { index, choice ->
                        append(if (index == terminalSelection) "> " else "  ")
                        append(choice).append("\n")
                    }
                    if (terminalFeedback.isNotEmpty()) append(terminalFeedback)
                }
            }
            return
        }
        decision.text = buildString {
            append("FINAL DECISION // WHAT TRUTH SURVIVES?\n")
            endings.forEachIndexed { index, ending ->
                append(if (index == selectedEnding) "> " else "  ")
                append(ending.uppercase())
                if (ending == "reconciliation" && !canReconcile) {
                    append(" [EVIDENCE REQUIRED]")
                }
                append("\n")
            }
        }
    }

    fun moveMonitor(direction: Int): Boolean {
        if (expandedMonitor != null) return false

        val row = selectedMonitor / 2
        val col = selectedMonitor % 2

        selectedMonitor = when (direction) {
            0 -> ((row + 1) % 2) * 2 + col  // Down
            1 -> row * 2 + ((col + 1) % 2)  // Right
            2 -> ((row + 1) % 2) * 2 + col  // Up
            3 -> row * 2 + ((col + 1) % 2)  // Left
            else -> selectedMonitor
        }

        refreshMonitorSelection()
        return true
    }

    fun expandMonitor(): Boolean {
        if (expandedMonitor != null) return false

        val monitor = monitors[selectedMonitor]
        val parent = monitor.parent as? LinearLayout ?: return false

        parent.removeView(monitor)
        expandedContainer.addView(
            monitor,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )

        monitor.setExpanded(true)
        expandedMonitor = selectedMonitor
        surveillanceGrid.visibility = GONE
        expandedContainer.visibility = VISIBLE
        refreshMonitorSelection()
        return true
    }

    fun collapseMonitor(): Boolean {
        val index = expandedMonitor ?: return false
        val monitor = monitors[index]

        expandedContainer.removeView(monitor)

        val row = surveillanceGrid.getChildAt(index / 2) as LinearLayout
        row.addView(
            monitor,
            index % 2,
            LayoutParams(0, LayoutParams.MATCH_PARENT, 1f).apply {
                setMargins(6, 6, 6, 6)
            }
        )

        monitor.setExpanded(false)
        expandedMonitor = null
        expandedContainer.visibility = GONE
        surveillanceGrid.visibility = VISIBLE
        refreshMonitorSelection()
        monitor.requestFocus()
        return true
    }

    private fun refreshMonitorSelection() {
        monitors.forEachIndexed { index, monitor ->
            monitor.setMonitorSelected(index == selectedMonitor)
        }
    }

    fun isMonitorFocused(): Boolean = monitors.any { it.hasFocus() }

    fun moveDecision(direction: Int): Boolean {
        if (currentPhase != "resolution") return false
        selectedEnding = (selectedEnding + direction + endings.size) % endings.size
        renderDecision()
        return true
    }

    fun selectedDecision(): String? {
        if (currentPhase != "resolution") return null
        val ending = endings[selectedEnding]
        if (ending == "reconciliation" && !canReconcile) return null
        return ending
    }

    fun isChoosingEnding(): Boolean = currentPhase == "resolution"

    fun isFieldComplete(): Boolean =
        currentPhase == "field-complete" || currentPhase == "complete"

    fun isChoosingFieldVerdict(): Boolean = currentPhase == "field-verdict" || currentPhase == "field-decision" || currentPhase == "field-cooperation"
    private fun refreshFieldVerdictMonitor() {
        monitors[3].setContent(buildString {
            append(if (currentPhase == "field-cooperation") "SHARED SIGNAL // SELECT TO PULSE\n\n" else "FINAL VERDICT // PUBLIC STANCE\n\n")
            fieldChoices.forEachIndexed { index, choice ->
                append(if (index == fieldSelection) "▶ " else "    ")
                append(choice.uppercase()).append("\n")
            }
            append("\nDPAD UP / DOWN TO SELECT")
            append("\nPRESS SELECT TO TRANSMIT")
            append("\nLENS VOTES ALSO REQUIRED")
        })
    }

    fun moveFieldVerdict(direction: Int): Boolean {
        if (!isChoosingFieldVerdict()) return false
        fieldSelection = (fieldSelection + direction + fieldChoices.size) % fieldChoices.size
        refreshFieldVerdictMonitor()
        return true
    }
    fun selectedFieldVerdict(): String? = if (isChoosingFieldVerdict()) fieldChoices[fieldSelection] else null

    fun isChoosingTerminal(): Boolean = terminalChoices.isNotEmpty() && !terminalCompleted

    fun hasResultsActions(): Boolean = resultsActions.visibility == VISIBLE

    fun focusResultsActions() {
        if (hasResultsActions()) returnToLobbyButton.requestFocus()
    }

    fun moveTerminalSelection(direction: Int): Boolean {
        if (!isChoosingTerminal()) return false
        terminalSelection = (terminalSelection + direction + terminalChoices.size) % terminalChoices.size
        renderDecision()
        return true
    }

    fun selectedTerminalChoice(): Int? = if (isChoosingTerminal()) terminalSelection else null

    fun terminalResult(correct: Boolean, narration: String) {
        terminalFeedback = narration
        if (correct) terminalCompleted = true
        renderDecision()
    }

}
