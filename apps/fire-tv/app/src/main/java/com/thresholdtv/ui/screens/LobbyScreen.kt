
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
import com.thresholdtv.ui.components.GlitchCoordinator
import com.thresholdtv.ui.components.ThresholdButton
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.session.ConnectedThreshold

class LobbyScreen(
    context: Context,
    private val onLeave: () -> Unit,
    private val onContinue: () -> Unit
) : FrameLayout(context) {

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
        "Enter this code in Lens.   MENU // NAVIGATION",
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

    private val localZoneView = terminalText(
        "LOCAL THRESHOLD // CONNECTING",
        15f,
        ThresholdTheme.Colors.GlitchCyan,
        Gravity.START
    )

    private val thresholdListView = terminalText(
        "SEARCHING FOR THRESHOLDS",
        14f,
        ThresholdTheme.Colors.Secondary,
        Gravity.START
    ).apply {
        setLineSpacing(dp(8).toFloat(), 1f)
    }

    private val leaveButton = ThresholdButton(context).apply {
        setLabel("LEAVE EXPEDITION")
        setOnClickListener { onLeave() }
    }

    private val continueButton = ThresholdButton(context).apply {
        setLabel("CONTINUE")
        isEnabled = false
        setOnClickListener {
            if (isEnabled) onContinue()
        }
        isFocusable = false
        isFocusableInTouchMode = false
    }

    private val glitchCoordinator = GlitchCoordinator(
        glitchTitle = {},
        glitchFocusedButton = {
            when {
                continueButton.hasFocus() && continueButton.isEnabled -> continueButton.glitch()
                leaveButton.hasFocus() && leaveButton.isEnabled -> leaveButton.glitch()
            }
        }
    )

    val isLeaveFocused: Boolean
        get() = leaveButton.hasFocus()

    fun setLeaving(leaving: Boolean) {
        leaveButton.isEnabled = !leaving
        continueButton.isEnabled = !leaving && playerNames.isNotEmpty()
        leaveButton.setLabel(if (leaving) "LEAVING..." else "LEAVE EXPEDITION")
        if (leaving) glitchCoordinator.stop()
        else if (active) glitchCoordinator.start()
    }

    private var sessionCode: String? = null
    private var connectedThresholds: List<ConnectedThreshold> = emptyList()
    private var localZone: String = ""
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
            setPadding(dp(34), dp(18), dp(34), dp(18))
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
            verticalParams(top = 12)
        )

        // Keep both rosters visible together, even at maximum capacity.
        val rosterRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.TOP
        }

        val thresholdColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(localZoneView)
            addView(
                terminalText(
                    "CONNECTED THRESHOLDS",
                    13f,
                    ThresholdTheme.Colors.Secondary,
                    Gravity.START
                ),
                verticalParams(top = 14)
            )
            addView(thresholdListView, verticalParams(top = 10))
        }

        rosterRow.addView(
            thresholdColumn,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                rightMargin = dp(20)
            }
        )

        val operativeColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }
        val playerHeader = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                playerHeading,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            )
            addView(playerCount)
        }
        operativeColumn.addView(playerHeader)
        operativeColumn.addView(playerGrid, verticalParams(top = 12))

        rosterRow.addView(
            operativeColumn,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        middleContent.addView(rosterRow, verticalParams(top = 20))

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

        // Fixed action bar: Leave left, Continue right.
        val footerRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(leaveButton)
            addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
            addView(continueButton)
        }
        screen.addView(footerRow, verticalParams(top = 8))

        // Center the content horizontally but use the full
        // screen height so the footer remains visible.
        addView(
            screen,
            LayoutParams(
                dp(900),
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
        if (!continueButton.isEnabled) leaveButton.requestFocus()
        else if (!leaveButton.hasFocus() && !continueButton.hasFocus()) continueButton.requestFocus()
        glitchCoordinator.start()
    }

    fun stop() {
        active = false
        handler.removeCallbacks(cursorTick)
        glitchCoordinator.stop()
        leaveButton.stop()
        continueButton.stop()
        signalNoise.stop()
    }

    fun updateSession(
        code: String?,
        players: List<String>,
        thresholds: List<ConnectedThreshold>,
        localZone: String
    ) {
        if (
            sessionCode == code &&
            playerNames == players &&
            connectedThresholds == thresholds &&
            this.localZone == localZone
        ) return

        val hadOperatives = playerNames.isNotEmpty()
        val hasOperatives = players.isNotEmpty()

        sessionCode = code
        playerNames = players.toList()
        connectedThresholds = thresholds.toList()
        this.localZone = localZone

        // Continue requires at least one connected operative.
        val canContinue = hasOperatives && leaveButton.isEnabled

        // If Continue is focused when the last operative leaves,
        // move focus before disabling it.
        if (!canContinue && continueButton.hasFocus()) {
            leaveButton.requestFocus()
        }

        continueButton.isEnabled = canContinue
        continueButton.isFocusable = canContinue
        continueButton.isFocusableInTouchMode = canContinue

        if (active) {
            when {
                // First operative joins, including after everyone left.
                !hadOperatives && hasOperatives && canContinue -> {
                    continueButton.requestFocus()
                }

                // Last operative disconnects.
                hadOperatives && !hasOperatives -> {
                    leaveButton.requestFocus()
                }
            }
        }

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

        localZoneView.text =
            "LOCAL THRESHOLD // ${localZone.ifEmpty { "CONNECTING" }}"

        thresholdListView.text = if (connectedThresholds.isEmpty()) {
            "SEARCHING FOR THRESHOLDS"
        } else {
            connectedThresholds.mapIndexed { index, threshold ->
                val marker = if (threshold.zoneName == localZone) {
                    "  ◀ YOU"
                } else {
                    ""
                }
                "${(index + 1).toString().padStart(2, '0')}  " +
                    threshold.zoneName + marker
            }.joinToString("\n")
        }

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
                16f,
                palette[index % palette.size],
                Gravity.START
            ).apply {
                setPadding(0, dp(5), dp(6), dp(5))
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
