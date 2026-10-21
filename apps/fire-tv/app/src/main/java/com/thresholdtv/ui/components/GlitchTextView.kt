
package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme

class GlitchTextView(
    context: Context
) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())

    private val cyanLayer = createLayer(
        ThresholdTheme.Colors.GlitchCyan
    )

    private val magentaLayer = createLayer(
        ThresholdTheme.Colors.GlitchMagenta
    )

    private val primaryLayer = createLayer(
        ThresholdTheme.Colors.Primary
    )

    private var stableText = ""

    private val glitchCharacters = charArrayOf(
        '#', '%', '&', '@', '!', '?', '0', '1', 'X', 'Ξ'
    )

    init {
        clipChildren = false
        clipToPadding = false

        addView(cyanLayer)
        addView(magentaLayer)
        addView(primaryLayer)

        resetLayers()
    }

    fun setTextSize(sizeSp: Float) {
        cyanLayer.textSize = sizeSp
        magentaLayer.textSize = sizeSp
        primaryLayer.textSize = sizeSp
    }

    fun setText(value: String) {
        handler.removeCallbacksAndMessages(null)

        stableText = value
        resetLayers()
    }

    /**
     * Runs one RGB glitch animation.
     * Timing is controlled externally by GlitchCoordinator.
     */
    fun glitch() {
        if (stableText.isEmpty()) return

        // Prevent animation frames from overlapping.
        handler.removeCallbacksAndMessages(null)

        showGlitchFrame(
            corruptionCount = 1,
            cyanOffset = -5f,
            magentaOffset = 5f
        )

        handler.postDelayed({
            showGlitchFrame(
                corruptionCount = 2,
                cyanOffset = 7f,
                magentaOffset = -6f
            )
        }, 45L)

        handler.postDelayed({
            showGlitchFrame(
                corruptionCount = 1,
                cyanOffset = -3f,
                magentaOffset = 4f
            )
        }, 90L)

        handler.postDelayed({
            resetLayers()
        }, 145L)
    }

    /**
     * Cancels any active glitch and restores stable text.
     */
    fun stop() {
        handler.removeCallbacksAndMessages(null)
        resetLayers()
    }

    private fun showGlitchFrame(
        corruptionCount: Int,
        cyanOffset: Float,
        magentaOffset: Float
    ) {
        val corrupted = corruptText(
            stableText,
            corruptionCount
        )

        primaryLayer.text = corrupted

        cyanLayer.apply {
            text = corrupted
            translationX = cyanOffset
            visibility = VISIBLE
        }

        magentaLayer.apply {
            text = corrupted
            translationX = magentaOffset
            visibility = VISIBLE
        }
    }

    private fun resetLayers() {
        primaryLayer.text = stableText

        cyanLayer.apply {
            text = stableText
            translationX = 0f
            visibility = INVISIBLE
        }

        magentaLayer.apply {
            text = stableText
            translationX = 0f
            visibility = INVISIBLE
        }
    }

    private fun corruptText(
        value: String,
        corruptionCount: Int
    ): String {
        val characters = value.toCharArray()

        val validIndices = characters.indices.filter {
            characters[it] != ' '
        }

        if (validIndices.isEmpty()) return value

        repeat(corruptionCount) {
            val index = validIndices.random()
            characters[index] = glitchCharacters.random()
        }

        return String(characters)
    }

    private fun createLayer(color: Int): TextView {
        return TextView(context).apply {
            textSize = 64f
            setTextColor(color)

            gravity = Gravity.CENTER
            letterSpacing = 0.11f
            typeface = ThresholdTheme.Typography.Display
            includeFontPadding = false

            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        }
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
