package com.thresholdtv.ui.components

import android.os.Handler
import android.os.Looper
import kotlin.random.Random

class GlitchCoordinator(
    private val glitchTitle: () -> Unit,
    private val glitchFocusedButton: () -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())

    private var running = false
    private var titleNext = true

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return

            if (titleNext) {
                glitchTitle()
            } else {
                glitchFocusedButton()
            }

            titleNext = !titleNext

            handler.postDelayed(
                this,
                Random.nextLong(1000L, 1501L)
            )
        }
    }

    fun start() {
        if (running) return

        running = true
        titleNext = true

        // First glitch happens immediately.
        tick.run()
    }

    fun stop() {
        running = false
        handler.removeCallbacks(tick)
    }
}