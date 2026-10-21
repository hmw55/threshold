package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import com.thresholdtv.R
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
    private var siren: MediaPlayer? = null
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

        releaseSiren()
        siren = MediaPlayer.create(context, R.raw.threshold_siren)?.also {
            it.setVolume(0.65f, 0.65f)
            it.setOnCompletionListener { player ->
                player.release()
                if (siren === player) siren = null
            }
            it.start()
        }

        val task = Runnable {
            visibility = GONE
            releaseSiren()
        }
        dismissTask = task
        val duration = if (message == "FINAL TRANSMISSION RECORDED") 5000L else 3200L
        handler.postDelayed(task, duration)
    }

    private fun releaseSiren() {
        siren?.release()
        siren = null
    }

    fun stop() {
        dismissTask?.let(handler::removeCallbacks)
        dismissTask = null
        releaseSiren()
        visibility = GONE
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
