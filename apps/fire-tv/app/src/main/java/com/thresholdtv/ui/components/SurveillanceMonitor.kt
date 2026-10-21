package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme

class SurveillanceMonitor(
    context: Context,
    private val monitorNumber: Int,
    monitorTitle: String
) : LinearLayout(context) {

    private val interference = SignalNoiseView(context, transparent = true)

    override fun dispatchDraw(canvas: android.graphics.Canvas) {
        super.dispatchDraw(canvas)
        interference.layout(0, 0, width, height)
        interference.draw(canvas)
    }

    private val heading = TextView(context)
    private val content = TextView(context)
    private val status = TextView(context)

    private val accentColor = when (monitorNumber) {
        1 -> 0xFF54D8EB.toInt()
        2 -> 0xFFC28AF0.toInt()
        3 -> 0xFF63DDB2.toInt()
        else -> 0xFFFFA16F.toInt()
    }

    private val surfaceColor = when (monitorNumber) {
        1 -> 0xFF101B24.toInt()
        2 -> 0xFF1B1526.toInt()
        3 -> 0xFF10201D.toInt()
        else -> 0xFF231916.toInt()
    }

    private val normalHeading = "%02d // %s".format(monitorNumber, monitorTitle)
    private val glitchHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val glitchRandom = kotlin.random.Random(monitorNumber)

    private val glitchTask = object : Runnable {
        override fun run() {
            if (!isAttachedToWindow) return

            heading.text = normalHeading.replaceRange(
                0, 2, listOf("##", "??", "▓▓")[glitchRandom.nextInt(3)]
            )
            heading.translationX = 3f

            glitchHandler.postDelayed({
                heading.text = normalHeading
                heading.translationX = 0f
            }, 90)

            glitchHandler.postDelayed(this, glitchRandom.nextLong(2500, 6500))
        }
    }

    private val interferenceTick = object : Runnable {
        override fun run() {
            if (!isAttachedToWindow) return
            invalidate()
            glitchHandler.postDelayed(this, 110L)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        glitchHandler.removeCallbacks(glitchTask)
        glitchHandler.post(interferenceTick)
        glitchHandler.postDelayed(glitchTask, glitchRandom.nextLong(1200, 3500))
    }

    override fun onDetachedFromWindow() {
        glitchHandler.removeCallbacksAndMessages(null)
        heading.text = normalHeading
        heading.translationX = 0f
        super.onDetachedFromWindow()
    }

    private var selected = false

    init {
        orientation = VERTICAL
        setPadding(28, 20, 28, 20)
        isFocusable = false

        heading.apply {
            text = "%02d // %s".format(monitorNumber, monitorTitle)
            textSize = 16f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(accentColor)
        }

        content.apply {
            textSize = 20f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(ThresholdTheme.Colors.Primary)
            setLineSpacing(5f, 1f)
            maxLines = 7
        }

        status.apply {
            text = "SELECT TO EXPAND"
            textSize = 13f
            typeface = ThresholdTheme.Typography.Terminal
            setTextColor(ThresholdTheme.Colors.Secondary)
            gravity = Gravity.END
        }

        addView(heading)
        addView(
            content,
            LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f).apply {
                topMargin = 14
            }
        )
        addView(status)

        refreshBorder()
    }

    fun setContent(value: String) {
        if (content.text.toString() != value) {
            content.text = value
        }
    }

    fun setMonitorSelected(value: Boolean) {
        if (selected == value) return
        selected = value
        refreshBorder()
    }

    fun setExpanded(value: Boolean) {
        content.maxLines = if (value) Int.MAX_VALUE else 7
        content.textSize = if (value) 25f else 20f
        status.text = if (value) "BACK TO SURVEILLANCE" else "SELECT TO EXPAND"
    }

    private fun refreshBorder() {
        background = GradientDrawable().apply {
            setColor(surfaceColor)
            setStroke(
                if (selected) 2 else 1,
                if (selected) accentColor
                else 0x334F6874
            )
            cornerRadius = 3f
        }
    }
}
