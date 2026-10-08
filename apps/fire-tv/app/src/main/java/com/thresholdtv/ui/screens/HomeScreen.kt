
package com.thresholdtv.ui.screens

import android.content.Context
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.components.GlitchCoordinator
import com.thresholdtv.ui.components.GlitchTextView
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.ui.components.TerminalView
import com.thresholdtv.ui.components.ThresholdButton

class HomeScreen(
    context: Context,
    private val onCreateExpedition: () -> Unit,
    private val onJoinExpedition: () -> Unit,
    onAboutThreshold: () -> Unit
) : FrameLayout(context) {

    private val signalNoiseView = SignalNoiseView(context)
    private val titleView = GlitchTextView(context)

    private val createButton = ThresholdButton(context)
    private val joinButton = ThresholdButton(context)
    private val aboutButton = ThresholdButton(context)

    private val terminalView = TerminalView(context)
    private var terminalOpen = false

    private val glitchCoordinator = GlitchCoordinator(
        glitchTitle = {
            titleView.glitch()
        },
        glitchFocusedButton = {
            when {
                createButton.hasFocus() -> createButton.glitch()
                joinButton.hasFocus() -> joinButton.glitch()
                aboutButton.hasFocus() -> aboutButton.glitch()
            }
        }
    )

    init {
        setBackgroundColor(ThresholdTheme.Colors.Background)

        addView(
            signalNoiseView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER

            setPadding(
                ThresholdTheme.Spacing.ScreenHorizontal,
                ThresholdTheme.Spacing.ScreenVertical,
                ThresholdTheme.Spacing.ScreenHorizontal,
                ThresholdTheme.Spacing.ScreenVertical
            )
        }

        titleView.setText("THRESHOLD")

        val tagline = TextView(context).apply {
            text = "Reality is playable."
            textSize = 20f
            setTextColor(ThresholdTheme.Colors.Secondary)
            typeface = ThresholdTheme.Typography.Interface
            gravity = Gravity.CENTER
            includeFontPadding = false
        }

        createButton.apply {
            setLabel("CREATE EXPEDITION")
            setOnClickListener {
                onCreateExpedition()
            }
        }

        joinButton.apply {
            setLabel("JOIN EXPEDITION")
            setOnClickListener {
                onJoinExpedition()
            }
        }

        aboutButton.apply {
            setLabel("ABOUT THRESHOLD")
            setOnClickListener {
                showTerminal()
            }
        }

        val buttonRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER

            addView(
                createButton,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = ThresholdTheme.Spacing.ButtonGap
                }
            )

            addView(
                joinButton,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = ThresholdTheme.Spacing.ButtonGap
                }
            )

            addView(
                aboutButton,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }

        content.addView(
            titleView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            tagline,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = ThresholdTheme.Spacing.TitleToTagline
            }
        )

        content.addView(
            buttonRow,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = ThresholdTheme.Spacing.TaglineToActions
            }
        )

        addView(
            content,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

        terminalView.visibility = View.GONE

        addView(
            terminalView,
            LayoutParams(
                760,
                LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        )
    }

    fun activate() {
        createButton.requestFocus()
        signalNoiseView.start()
        glitchCoordinator.start()
    }

    fun deactivate() {
        glitchCoordinator.stop()
        signalNoiseView.stop()

        terminalView.stop()
        terminalView.visibility = View.GONE
        terminalOpen = false

        titleView.stop()
        createButton.stop()
        joinButton.stop()
        aboutButton.stop()
    }

    private fun showTerminal() {
        if (terminalOpen) return

        terminalOpen = true
        glitchCoordinator.stop()

        titleView.stop()
        createButton.stop()
        joinButton.stop()
        aboutButton.stop()

        terminalView.visibility = View.VISIBLE
        terminalView.start()
    }

    private fun hideTerminal() {
        if (!terminalOpen) return

        terminalOpen = false
        terminalView.stop()
        terminalView.visibility = View.GONE

        aboutButton.requestFocus()
        glitchCoordinator.start()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (
            terminalOpen &&
            event.keyCode == KeyEvent.KEYCODE_BACK
        ) {
            if (event.action == KeyEvent.ACTION_UP) {
                hideTerminal()
            }

            return true
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onDetachedFromWindow() {
        deactivate()
        super.onDetachedFromWindow()
    }
}
