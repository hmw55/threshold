package com.thresholdtv.ui.screens

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import org.json.JSONObject

class ExpeditionScreen(context: Context) : LinearLayout(context) {

    private val heading = text(42f, ThresholdTheme.Colors.Primary)
    private val subtitle = text(19f, ThresholdTheme.Colors.GlitchCyan)
    private val progress = text(22f, ThresholdTheme.Colors.Secondary)
    private val evidence = text(19f, ThresholdTheme.Colors.Primary)
    private val transmission = text(22f, ThresholdTheme.Colors.GlitchCyan)
    private val scoreboard = text(19f, ThresholdTheme.Colors.Primary)
    private val footer = text(16f, ThresholdTheme.Colors.Secondary)
    private val decision = text(23f, ThresholdTheme.Colors.GlitchCyan)
    private var terminalPrompt = ""
    private var terminalChoices: List<String> = emptyList()
    private var terminalCompleted = false
    private var terminalSelection = 0
    private var terminalFeedback = ""
    private val endings = listOf("preservation", "fracture", "reconciliation")
    private var selectedEnding = 0
    private var canReconcile = false
    private var currentPhase = ""
    private val fieldChoices = listOf("preserve", "release", "erase")
    private var fieldSelection = 0


    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(ThresholdTheme.Colors.Background)
        setPadding(72, 54, 72, 54)

        val panel = LinearLayout(context).apply {
            orientation = VERTICAL
            setPadding(40, 36, 40, 36)
            background = GradientDrawable().apply {
                setColor(ThresholdTheme.Colors.Surface)
                setStroke(2, ThresholdTheme.Colors.Border)
                cornerRadius = 8f
            }
        }

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

        addView(
            panel,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
        )

        showWaiting()
    }

    private fun text(size: Float, color: Int) =
        TextView(context).apply {
            textSize = size
            setTextColor(color)
            typeface = ThresholdTheme.Typography.Terminal
            setPadding(0, 12, 0, 12)
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
            scoreLines.add("No points awarded yet.")
        }

        scoreboard.text = scoreLines.joinToString("\n")
        renderDecision()
        val field = data.optJSONObject("fieldEncounter")
        if (field != null) {
            currentPhase = if (field.optString("stage") == "verdict") "field-verdict" else "field"
            terminalChoices = emptyList()
            subtitle.text = "ARCHITECT // LIVE ENVIRONMENT"
            heading.text = field.optString("title", "THE LAST WITNESS")
            progress.text = "ENCOUNTER ${field.optInt("progress") + 1} / ${field.optInt("total", 5)}"
            transmission.text = field.optString("transmission", "")
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
            decision.text = if (field.optString("stage") == "verdict")
                buildString {
                    append("PUBLIC STANCE // ")
                    fieldChoices.forEachIndexed { index, item -> append(if (index == fieldSelection) "> " else "  ").append(item.uppercase()).append("\n") }
                    append("SELECT TO TRANSMIT // LENS VOTES STILL REQUIRED")
                }
            else if (field.optString("stage") == "complete")
                "FINAL DECISION // " + field.optString("ending").uppercase()
            else "WITNESS REPORTS // ${field.optInt("received")} OF ${field.optInt("required")}"
            footer.text = "THE ROOM IS THE GAME // CONTINUE ON YOUR LENS"
            return
        }
        footer.text = when (phase) {
            "complete" -> "THE ARCHITECT REMEMBERS"
            "resolution" -> "DPAD UP/DOWN TO SELECT // PRESS SELECT TO CONFIRM"
            else -> if (terminalChoices.isNotEmpty() && !terminalCompleted)
                "DPAD UP/DOWN TO CHOOSE // SELECT TO TRANSMIT"
            else "CONTINUE THE INVESTIGATION ON YOUR LENS"
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

    fun isChoosingFieldVerdict(): Boolean = currentPhase == "field-verdict"
    fun moveFieldVerdict(direction: Int): Boolean {
        if (!isChoosingFieldVerdict()) return false
        fieldSelection = (fieldSelection + direction + fieldChoices.size) % fieldChoices.size
        return true
    }
    fun selectedFieldVerdict(): String? = if (isChoosingFieldVerdict()) fieldChoices[fieldSelection] else null

    fun isChoosingTerminal(): Boolean = terminalChoices.isNotEmpty() && !terminalCompleted

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
