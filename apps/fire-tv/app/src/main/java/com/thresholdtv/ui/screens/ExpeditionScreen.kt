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
    }

    fun update(data: JSONObject) {
        val game = data.optJSONObject("game") ?: return
        val adventure = data.optJSONObject("adventure")
        val phase = game.optString("phase", "investigation")

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
        footer.text = when (phase) {
            "complete" -> "THE ARCHITECT REMEMBERS"
            "resolution" -> "A CHOICE MUST BE MADE ON YOUR LENS"
            else -> "CONTINUE THE INVESTIGATION ON YOUR LENS"
        }
    }
}
