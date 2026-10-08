
package com.thresholdtv.ui.screens

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.components.SignalNoiseView

class LobbyScreen(context: Context) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())
    private val signalNoise = SignalNoiseView(context)

    private val palette = intArrayOf(
        Color.rgb(0, 235, 255),
        Color.rgb(255, 54, 127),
        Color.rgb(200, 164, 255),
        Color.rgb(255, 196, 107),
        Color.rgb(102, 230, 176),
        Color.rgb(115, 172, 255)
    )

    private val heading = terminalText(
        "INITIALIZING EXPEDITION",
        36f,
        ThresholdTheme.Colors.Primary,
        Gravity.CENTER
    ).apply {
        typeface = ThresholdTheme.Typography.Display
    }

    private val status = terminalText(
        "ESTABLISHING CONNECTION",
        15f,
        ThresholdTheme.Colors.GlitchCyan,
        Gravity.CENTER
    )

    private val codeLabel = terminalText(
        "EXPEDITION ACCESS CODE",
        13f,
        ThresholdTheme.Colors.Secondary,
        Gravity.START
    )

    private val codeValue = terminalText(
        "------",
        54f,
        ThresholdTheme.Colors.Primary,
        Gravity.START
    ).apply {
        typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
        letterSpacing = 0.15f
    }

    private val instructions = terminalText(
        "Enter this code in Lens.",
        14f,
        ThresholdTheme.Colors.Secondary,
        Gravity.START
    )

    private val playerHeading = terminalText(
        "CONNECTED OPERATIVES",
        14f,
        ThresholdTheme.Colors.Secondary,
        Gravity.START
    )

    private val playerCount = terminalText(
        "00",
        14f,
        ThresholdTheme.Colors.Secondary,
        Gravity.END
    )

    private val playerGrid = GridLayout(context).apply {
        columnCount = 2
        alignmentMode = GridLayout.ALIGN_BOUNDS
        useDefaultMargins = false
    }

    private val footer = terminalText(
        "WAITING FOR OPERATIVES",
        15f,
        ThresholdTheme.Colors.Primary,
        Gravity.CENTER
    )

    private var sessionCode: String? = null
    private var playerNames: List<String> = emptyList()
    private var cursorVisible = true
    private var active = false

    private val cursorTick = object : Runnable {
        override fun run() {
            if (!active) return

            cursorVisible = !cursorVisible
            updateStatus()
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

        // Full-screen vertical structure.
        val screen = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(44), dp(28), dp(44), dp(28))
        }

        // HEADER: fixed at top.
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
            heading,
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

        // MIDDLE: scrolls if screen space is limited.
        val middleContent = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }

        val joinArea = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val codeColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL

            addView(codeLabel)
            addView(codeValue, verticalParams(top = 8))
            addView(instructions, verticalParams(top = 8))
        }

        joinArea.addView(
            codeColumn,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ).apply {
                rightMargin = dp(24)
            }
        )

        val qrPlaceholder = FrameLayout(context).apply {
            setBackgroundColor(Color.rgb(18, 22, 29))

            addView(
                terminalText(
                    "⌗",
                    58f,
                    ThresholdTheme.Colors.GlitchCyan,
                    Gravity.CENTER
                ),
                LayoutParams(
                    LayoutParams.MATCH_PARENT,
                    LayoutParams.MATCH_PARENT
                )
            )
        }

        val qrColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL

            addView(
                qrPlaceholder,
                LinearLayout.LayoutParams(dp(132), dp(132))
            )

            addView(
                terminalText(
                    "QR LINK COMING SOON",
                    10f,
                    ThresholdTheme.Colors.Secondary,
                    Gravity.CENTER
                ),
                verticalParams(top = 10)
            )
        }

        joinArea.addView(
            qrColumn,
            LinearLayout.LayoutParams(
                dp(166),
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        middleContent.addView(
            joinArea,
            verticalParams(top = 22)
        )

        val playerHeader = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            addView(
                playerHeading,
                LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f
                )
            )

            addView(playerCount)
        }

        middleContent.addView(
            playerHeader,
            verticalParams(top = 24)
        )

        middleContent.addView(
            playerGrid,
            verticalParams(top = 10)
        )

        val middleScroll = ScrollView(context).apply {
            isFillViewport = false
            isVerticalScrollBarEnabled = false
            addView(middleContent)
        }

        // The middle consumes the available space without pushing
        // the header or footer offscreen.
        screen.addView(
            middleScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        // FOOTER: fixed at bottom.
        screen.addView(
            footer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        )

        // Center the content horizontally but use the full
        // screen height so the footer remains visible.
        addView(
            screen,
            LayoutParams(
                dp(800),
                LayoutParams.MATCH_PARENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL
            )
        )

        update()
    }

    fun start() {
        if (active) return

        active = true
        signalNoise.start()
        handler.post(cursorTick)
    }

    fun stop() {
        active = false
        handler.removeCallbacks(cursorTick)
        signalNoise.stop()
    }

    fun updateSession(code: String?, players: List<String>) {
        if (sessionCode == code && playerNames == players) return

        sessionCode = code
        playerNames = players.toList()

        update()
    }

    private fun update() {
        val ready = sessionCode != null

        heading.text = if (ready) {
            "AWAITING OPERATIVES"
        } else {
            "INITIALIZING EXPEDITION"
        }

        codeLabel.alpha = if (ready) 1f else 0.45f
        codeValue.alpha = if (ready) 1f else 0.45f
        instructions.alpha = if (ready) 1f else 0.45f

        codeValue.text = sessionCode ?: "------"
        playerCount.text = playerNames.size.toString().padStart(2, '0')

        renderPlayers()
        updateStatus()
    }

    private fun renderPlayers() {
        playerGrid.removeAllViews()

        if (playerNames.isEmpty()) {
            val empty = terminalText(
                "NO OPERATIVES CONNECTED",
                16f,
                ThresholdTheme.Colors.Secondary,
                Gravity.START
            )

            playerGrid.addView(
                empty,
                GridLayout.LayoutParams(
                    GridLayout.spec(0),
                    GridLayout.spec(0, 2)
                )
            )
            return
        }

        playerNames.forEachIndexed { index, name ->
            val row = index / 2
            val column = index % 2

            val nameView = terminalText(
                name,
                21f,
                palette[index % palette.size],
                Gravity.START
            ).apply {
                setPadding(0, dp(6), dp(8), dp(6))
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }

            playerGrid.addView(
                nameView,
                GridLayout.LayoutParams(
                    GridLayout.spec(row),
                    GridLayout.spec(column, 1f)
                ).apply {
                    width = 0
                    bottomMargin = dp(4)
                }
            )
        }
    }

    private fun updateStatus() {
        val cursor = if (cursorVisible) " ▌" else "  "

        status.text = when {
            sessionCode == null ->
                "ESTABLISHING CONNECTION$cursor"

            playerNames.isEmpty() ->
                "AWAITING LENS CONNECTION$cursor"

            else ->
                "${playerNames.size} OPERATIVE(S) CONNECTED$cursor"
        }

        footer.text = when {
            sessionCode == null ->
                "INITIALIZING SESSION"

            playerNames.isEmpty() ->
                "WAITING FOR OPERATIVES"

            else ->
                "PRESS SELECT TO CONTINUE"
        }
    }

    private fun verticalParams(
        top: Int = 0
    ): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = dp(top)
        }
    }

    private fun terminalText(
        value: String,
        size: Float,
        color: Int,
        alignment: Int
    ): TextView {
        return TextView(context).apply {
            text = value
            textSize = size
            setTextColor(color)
            typeface = ThresholdTheme.Typography.Terminal
            includeFontPadding = false
            gravity = alignment
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
