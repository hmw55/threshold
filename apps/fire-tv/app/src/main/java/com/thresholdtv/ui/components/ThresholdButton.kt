
package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.widget.Button
import com.thresholdtv.ui.ThresholdTheme

class ThresholdButton(
    context: Context
) : Button(context) {

    private val handler = Handler(Looper.getMainLooper())

    private var stableText = ""
    private var focused = false

    private val glitchCharacters = charArrayOf(
        '#', '%', '&', '@', '!', '?', '0', '1', 'X', 'Ξ'
    )

    init {
        textSize = 15f
        letterSpacing = 0.08f
        typeface = ThresholdTheme.Typography.InterfaceMedium

        isAllCaps = false
        isFocusable = true
        isFocusableInTouchMode = true

        setPadding(32, 16, 32, 16)

        setOnFocusChangeListener { _, hasFocus ->
            focused = hasFocus
            stopGlitching()
            applyFocusStyle(hasFocus)
        }

        applyFocusStyle(false)
    }

    fun setLabel(label: String) {
        stableText = label
        text = label
    }

    fun glitch() {
        if (!focused || stableText.isEmpty()) return

        handler.removeCallbacksAndMessages(null)

        applyGlitchStyle(ThresholdTheme.Colors.GlitchCyan)
        translationX = -3f
        text = corruptText(stableText, 1)

        handler.postDelayed({
            if (focused) {
                applyGlitchStyle(ThresholdTheme.Colors.GlitchMagenta)
                translationX = 3f
                text = corruptText(stableText, 2)
            }
        }, 45L)

        handler.postDelayed({
            if (focused) {
                applyGlitchStyle(ThresholdTheme.Colors.GlitchCyan)
                translationX = -1f
                text = corruptText(stableText, 1)
            }
        }, 90L)

        handler.postDelayed({
            translationX = 0f
            text = stableText
            applyFocusStyle(focused)
        }, 145L)
    }

    fun stop() {
        stopGlitching()
        applyFocusStyle(hasFocus())
    }

    private fun stopGlitching() {
        handler.removeCallbacksAndMessages(null)
        translationX = 0f
        text = stableText
    }

    private fun corruptText(
        value: String,
        corruptionCount: Int
    ): String {
        val characters = value.toCharArray()
        val validIndices = characters.indices.filter {
            characters[it] != ' '
        }

        repeat(corruptionCount) {
            if (validIndices.isNotEmpty()) {
                val index = validIndices.random()
                characters[index] = glitchCharacters.random()
            }
        }

        return String(characters)
    }

    private fun applyFocusStyle(hasFocus: Boolean) {
        setTextColor(
            if (hasFocus) ThresholdTheme.Colors.Background
            else ThresholdTheme.Colors.Primary
        )

        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 2f

            if (hasFocus) {
                setColor(ThresholdTheme.Colors.Primary)
                setStroke(2, ThresholdTheme.Colors.Primary)
            } else {
                setColor(ThresholdTheme.Colors.Background)
                setStroke(2, ThresholdTheme.Colors.Primary)
            }
        }
    }

    private fun applyGlitchStyle(color: Int) {
        setTextColor(ThresholdTheme.Colors.Background)

        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 2f
            setColor(ThresholdTheme.Colors.Primary)
            setStroke(4, color)
        }
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
