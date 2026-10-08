
package com.thresholdtv.ui.components

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Handler
import android.os.Looper
import android.view.View
import com.thresholdtv.ui.ThresholdTheme
import kotlin.random.Random

/**
 * Decorative signal interference behind Threshold's interface.
 *
 * Draws faint static scanlines and short-lived RGB fragments.
 * Does not handle focus, input, or foreground animations.
 */
class SignalNoiseView(
    context: Context
) : View(context) {

    private data class SignalFragment(
        val x: Float,
        val y: Float,
        val width: Float,
        val thickness: Float,
        val color: Int
    )

    private val handler = Handler(Looper.getMainLooper())

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val fragments = mutableListOf<SignalFragment>()

    private var running = false

    private val animationTick = object : Runnable {
        override fun run() {
            if (!running) return

            generateFragments()
            invalidate()

            handler.postDelayed(
                this,
                Random.nextLong(70L, 160L)
            )
        }
    }

    init {
        isFocusable = false
        isClickable = false

        setBackgroundColor(
            ThresholdTheme.Colors.Background
        )
    }

    fun start() {
        if (running) return

        running = true
        animationTick.run()
    }

    fun stop() {
        running = false
        handler.removeCallbacks(animationTick)

        fragments.clear()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        drawScanlines(canvas)
        drawFragments(canvas)
    }

    private fun drawScanlines(canvas: Canvas) {
        paint.color = Color.argb(16, 180, 190, 200)
        paint.strokeWidth = 1f

        var y = 0f

        while (y < height) {
            canvas.drawLine(
                0f,
                y,
                width.toFloat(),
                y,
                paint
            )

            y += 6f
        }
    }

    private fun drawFragments(canvas: Canvas) {
        for (fragment in fragments) {
            paint.color = fragment.color

            canvas.drawRect(
                fragment.x,
                fragment.y,
                fragment.x + fragment.width,
                fragment.y + fragment.thickness,
                paint
            )
        }
    }

    private fun generateFragments() {
        fragments.clear()

        if (width <= 0 || height <= 0) return

        // Most frames contain very little interference.
        val fragmentCount = when (Random.nextInt(10)) {
            in 0..1 -> 0
            in 2..4 -> 2
            in 5..7 -> 3
            8 -> 4
            else -> 5
        }

        repeat(fragmentCount) {
            val fragmentWidth = Random.nextInt(45, 241).toFloat()

            val x = Random.nextFloat() *
                (width - fragmentWidth).coerceAtLeast(0f)

            val y = Random.nextFloat() * height

            val thickness = Random.nextInt(2, 6).toFloat()

            val color = when (Random.nextInt(3)) {
                0 -> Color.argb(
                    Random.nextInt(140, 230),
                    0, 235, 255
                )

                1 -> Color.argb(
                    Random.nextInt(140, 230),
                    255, 0, 110
                )

                else -> Color.argb(
                    Random.nextInt(90, 170),
                    244, 244, 242
                )
            }

            fragments.add(
                SignalFragment(
                    x = x,
                    y = y,
                    width = fragmentWidth,
                    thickness = thickness,
                    color = color
                )
            )
        }
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
