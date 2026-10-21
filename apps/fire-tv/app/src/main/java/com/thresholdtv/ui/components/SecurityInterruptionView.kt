package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.media.ToneGenerator
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.os.Handler
import android.os.Looper
import com.thresholdtv.ui.ThresholdTheme

class SecurityInterruptionView(context: Context) : FrameLayout(context) {
    private val handler = Handler(Looper.getMainLooper())
    private var tone: ToneGenerator? = null
    private var dismissTask: Runnable? = null

    private val warning = TextView(context).apply {
        text = "!! SECURITY INTERRUPTION !!"
        textSize = 34f
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        typeface = Typeface.create("monospace", Typeface.BOLD)
    }

    private val detail = TextView(context).apply {
        textSize = 21f
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        typeface = Typeface.create("monospace", Typeface.NORMAL)
    }

    init {
        visibility = GONE
        isClickable = true
        isFocusable = true
        background = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(0xF0A90018.toInt(), 0xF016050A.toInt(), 0xF0A90018.toInt())
        ).apply {
            setStroke(5, 0xFFFF365F.toInt())
        }

        val panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(60, 50, 60, 50)
            addView(warning)
            addView(detail)
        }

        addView(
            panel,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )
    }

    fun trigger(message: String = "UNAUTHORIZED PATTERN DETECTED") {
        dismissTask?.let(handler::removeCallbacks)
        detail.text = "$message\n\nTHE ARCHITECT HAS INTERRUPTED THIS CHANNEL."
        visibility = VISIBLE
        alpha = 1f
        bringToFront()

        tone?.release()
        tone = ToneGenerator(AudioManager.STREAM_ALARM, 85).also {
            it.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1800)
        }

        val task = Runnable {
            visibility = GONE
            tone?.stopTone()
            tone?.release()
            tone = null
        }
        dismissTask = task
        handler.postDelayed(task, 3200L)
    }

    fun stop() {
        dismissTask?.let(handler::removeCallbacks)
        dismissTask = null
        tone?.stopTone()
        tone?.release()
        tone = null
        visibility = GONE
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
