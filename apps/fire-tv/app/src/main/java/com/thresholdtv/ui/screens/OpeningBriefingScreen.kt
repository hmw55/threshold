package com.thresholdtv.ui.screens

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.components.GlitchCoordinator
import com.thresholdtv.ui.components.GlitchTextView
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.ui.components.ThresholdButton

class OpeningBriefingScreen(
    context: Context,
    private val onBegin: () -> Unit
) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())
    private val noise = SignalNoiseView(context)
    private val title = GlitchTextView(context)
    private val beginButton = ThresholdButton(context)
    private val transmission = TextView(context)
    private val classification = TextView(context)

    private var currentCaseTitle = ""
    private var message = ""
    private var position = 0
    private var active = false
    private var cursorVisible = true

    private val glitches = GlitchCoordinator(
        glitchTitle = { title.glitch() },
        glitchFocusedButton = {
            if (beginButton.hasFocus()) beginButton.glitch()
        }
    )

    private val typing = object : Runnable {
        override fun run() {
            if (!active) return
            if (position < message.length) {
                position++
                updateTransmission()
                handler.postDelayed(this, 22L)
            }
        }
    }

    private val cursor = object : Runnable {
        override fun run() {
            if (!active) return
            cursorVisible = !cursorVisible
            updateTransmission()
            handler.postDelayed(this, 450L)
        }
    }

    init {
        setBackgroundColor(ThresholdTheme.Colors.Background)
        addView(noise, LayoutParams(-1, -1))

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(90, 45, 90, 45)
        }

        val header = TextView(context).apply {
            text = "THRESHOLD // ARCHITECT TRANSMISSION"
            textSize = 18f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(ThresholdTheme.Colors.GlitchCyan)
            gravity = Gravity.CENTER
        }

        classification.apply {
            textSize = 20f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(ThresholdTheme.Colors.GlitchMagenta)
            gravity = Gravity.CENTER
        }

        transmission.apply {
            textSize = 21f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(ThresholdTheme.Colors.Primary)
            setLineSpacing(7f, 1f)
            minLines = 4
            gravity = Gravity.CENTER
            textAlignment = TEXT_ALIGNMENT_CENTER
        }

        beginButton.apply {
            setLabel("BEGIN INVESTIGATION")
            setOnClickListener { onBegin() }
        }

        content.addView(header)
        content.addView(classification, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = 24
        })
        title.setTextSize(34f)

        content.addView(title, LinearLayout.LayoutParams(-1, 180).apply {
            topMargin = 20
        })
        content.addView(transmission, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = 35
        })
        content.addView(beginButton, LinearLayout.LayoutParams(-2, -2).apply {
            topMargin = 45
        })

        addView(content, LayoutParams(-1, -1))

    }


    fun showCase(family: String, caseTitle: String, objective: String) {
        val nextMessage = "INCOMING CASE FILE...\n\n$objective\n\n" +
            "YOUR ENVIRONMENT IS THE INVESTIGATION SITE.\n" +
            "THE ARCHITECT MAY NOT BE TELLING YOU EVERYTHING."
        if (classification.text.toString() == "CASE CLASSIFICATION // ${family.uppercase()}" &&
            currentCaseTitle == caseTitle &&
            message == nextMessage
        ) return

        classification.text = "CASE CLASSIFICATION // ${family.uppercase()}"
        currentCaseTitle = caseTitle
        title.setText(caseTitle)
        message = "INCOMING CASE FILE...\n\n$objective\n\n" +
            "YOUR ENVIRONMENT IS THE INVESTIGATION SITE.\n" +
            "THE ARCHITECT MAY NOT BE TELLING YOU EVERYTHING."
        position = 0
        cursorVisible = true
        updateTransmission()
    }

    fun activate() {
        if (active) return
        active = true
        noise.start()
        glitches.start()
        beginButton.requestFocus()
        handler.post(typing)
        handler.post(cursor)
    }

    fun deactivate() {
        active = false
        handler.removeCallbacksAndMessages(null)
        glitches.stop()
        noise.stop()
        title.stop()
        beginButton.stop()
    }

    private fun updateTransmission() {
        transmission.text = message.take(position) + if (cursorVisible) "█" else " "
    }

    override fun onDetachedFromWindow() {
        deactivate()
        super.onDetachedFromWindow()
    }
}
