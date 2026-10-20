
package com.thresholdtv.ui.screens

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.components.GlitchCoordinator
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.ui.components.ThresholdButton

class CalibrationScreen(
    context: Context,
    private val onBack: () -> Unit,
    private val onContinue: () -> Unit
) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())
    private val signalNoise = SignalNoiseView(context)

    private var active = false
    private var cursorVisible = true

    private val status = terminalText(
        "AWAITING ENVIRONMENTAL DATA",
        15f,
        ThresholdTheme.Colors.GlitchCyan,
        Gravity.CENTER
    )

    private val backButton = ThresholdButton(context).apply {
        setLabel("RETURN TO LOBBY")
        setOnClickListener { onBack() }
    }

    private val continueButton = ThresholdButton(context).apply {
        setLabel("CONTINUE")
        setOnClickListener { onContinue() }
    }

    private val glitchCoordinator = GlitchCoordinator(
        glitchTitle = {},
        glitchFocusedButton = {
            when {
                backButton.hasFocus() -> backButton.glitch()
                continueButton.hasFocus() -> continueButton.glitch()
            }
        }
    )

    private val cursorTick = object : Runnable {
        override fun run() {
            if (!active) return

            cursorVisible = !cursorVisible

            status.text =
                "AWAITING ENVIRONMENTAL DATA" +
                    if (cursorVisible) " ▌" else "  "

            handler.postDelayed(this, 500L)
        }
    }

    init {
        setBackgroundColor(ThresholdTheme.Colors.Background)

        addView(
            signalNoise,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

        val screen = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(34), dp(18), dp(34), dp(18))
        }

        // Header — matches the Expedition lobby.
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        header.addView(
            terminalText(
                "THRESHOLD // EXPEDITION CONTROL",
                12f,
                ThresholdTheme.Colors.Secondary,
                Gravity.CENTER
            )
        )

        header.addView(
            terminalText(
                "ENVIRONMENT CALIBRATION",
                36f,
                ThresholdTheme.Colors.Primary,
                Gravity.CENTER
            ).apply {
                typeface = ThresholdTheme.Typography.Display
            },
            verticalParams(top = 12)
        )

        header.addView(
            status,
            verticalParams(top = 8)
        )

        screen.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        // Main content — centered between header and footer.
        val middle = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        middle.addView(
            terminalText(
                "PHASE 01 // ENVIRONMENT ANALYSIS",
                14f,
                ThresholdTheme.Colors.GlitchCyan,
                Gravity.CENTER
            )
        )

        middle.addView(
            terminalText(
                "OBSERVE YOUR SURROUNDINGS",
                30f,
                ThresholdTheme.Colors.Primary,
                Gravity.CENTER
            ).apply {
                typeface = ThresholdTheme.Typography.Display
            },
            verticalParams(top = 22)
        )

        middle.addView(
            terminalText(
                "Each operative must use Threshold Lens " +
                    "to capture their environment.",
                18f,
                ThresholdTheme.Colors.Secondary,
                Gravity.CENTER
            ),
            verticalParams(top = 16)
        )

        middle.addView(
            terminalText(
                "IDENTIFY YOUR SURROUNDINGS\n" +
                    "CAPTURE ENVIRONMENTAL DATA\n" +
                    "AWAIT FURTHER INSTRUCTIONS",
                16f,
                ThresholdTheme.Colors.GlitchCyan,
                Gravity.CENTER
            ).apply {
                setLineSpacing(dp(14).toFloat(), 1f)
            },
            verticalParams(top = 36)
        )

        screen.addView(
            middle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        // Footer — same positioning as the lobby.
        val footer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            addView(backButton)
            addView(
                View(context),
                LinearLayout.LayoutParams(0, 1, 1f)
            )
            addView(continueButton)
        }

        screen.addView(
            footer,
            verticalParams(top = 8)
        )

        addView(
            screen,
            LayoutParams(
                dp(900),
                LayoutParams.MATCH_PARENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL
            )
        )
    }

    fun start() {
        if (active) return

        active = true
        signalNoise.start()
        handler.post(cursorTick)
        continueButton.requestFocus()
        glitchCoordinator.start()
    }

    fun stop() {
        active = false
        handler.removeCallbacks(cursorTick)
        glitchCoordinator.stop()
        backButton.stop()
        continueButton.stop()
        signalNoise.stop()
    }

    private fun verticalParams(
        top: Int = 0
    ): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = dp(top)
        }

    private fun terminalText(
        value: String,
        size: Float,
        color: Int,
        alignment: Int
    ): TextView =
        TextView(context).apply {
            text = value
            textSize = size
            setTextColor(color)
            typeface = ThresholdTheme.Typography.Terminal
            includeFontPadding = false
            gravity = alignment
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
