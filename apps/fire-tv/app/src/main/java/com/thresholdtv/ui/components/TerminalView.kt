
package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme

class TerminalView(
    context: Context
) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())

    private val terminalText = """
        THRESHOLD SYSTEM // INFORMATION

        > QUERY: THRESHOLD

        THRESHOLD is an AI-directed adventure system
        that transforms your physical environment
        into a playable world.

        Your surroundings become the level.
        Everyday objects become artifacts.
        Your phone becomes a Lens.
        This device becomes a Threshold.

        > REALITY STATUS: PLAYABLE
    """.trimIndent()

    private val textView = TextView(context).apply {
        textSize = 18f
        typeface = ThresholdTheme.Typography.Terminal
        setTextColor(ThresholdTheme.Colors.Primary)
        includeFontPadding = false
        gravity = Gravity.START
        setLineSpacing(5f, 1f)
    }

    private var characterIndex = 0
    private var cursorVisible = true
    private var active = false

    private val typingTick = object : Runnable {
        override fun run() {
            if (!active) return

            if (characterIndex < terminalText.length) {
                characterIndex++
                updateText()

                handler.postDelayed(this, 18L)
            }
        }
    }

    private val cursorTick = object : Runnable {
        override fun run() {
            if (!active) return

            cursorVisible = !cursorVisible
            updateText()

            handler.postDelayed(this, 450L)
        }
    }

    init {
        isFocusable = true
        isFocusableInTouchMode = true

        background = GradientDrawable().apply {
            setColor(ThresholdTheme.Colors.Surface)
            setStroke(2, ThresholdTheme.Colors.Border)
            cornerRadius = 4f
        }

        setPadding(44, 36, 44, 36)

        addView(
            textView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.START
            )
        )
    }

    fun start() {
        handler.removeCallbacksAndMessages(null)

        active = true
        characterIndex = 0
        cursorVisible = true

        updateText()

        handler.post(typingTick)
        handler.postDelayed(cursorTick, 450L)

        requestFocus()
    }

    fun stop() {
        active = false
        handler.removeCallbacksAndMessages(null)
    }

    private fun updateText() {
        val visibleText = terminalText.take(characterIndex)
        val cursor = if (cursorVisible) "█" else " "

        textView.text = visibleText + cursor
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
