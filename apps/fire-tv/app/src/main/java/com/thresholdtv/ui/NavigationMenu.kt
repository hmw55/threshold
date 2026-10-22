package com.thresholdtv.ui

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.Window
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.components.ThresholdButton

/** Remote-first navigation. Showing this dialog removes focus from the game so SELECT cannot submit a puzzle. */
class NavigationMenu(
    context: Context,
    title: String,
    message: String,
    items: List<Item>,
    onDismissed: () -> Unit = {}
) : Dialog(context) {
    data class Item(val label: String, val enabled: Boolean = true, val action: () -> Unit)

    init {
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        setCancelable(true)
        setCanceledOnTouchOutside(false)
        setOnDismissListener { onDismissed() }

        val panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(42, 36, 42, 36)
            background = GradientDrawable().apply {
                setColor(ThresholdTheme.Colors.Surface)
                setStroke(2, ThresholdTheme.Colors.Border)
                cornerRadius = 6f
            }
        }
        panel.addView(TextView(context).apply {
            text = "THRESHOLD // NAVIGATION"
            textSize = 13f
            letterSpacing = .16f
            setTextColor(ThresholdTheme.Colors.GlitchCyan)
            typeface = ThresholdTheme.Typography.Terminal
        })
        panel.addView(TextView(context).apply {
            text = title
            textSize = 30f
            setTextColor(ThresholdTheme.Colors.Primary)
            typeface = ThresholdTheme.Typography.Display
            setPadding(0, 18, 0, 6)
        })
        panel.addView(TextView(context).apply {
            text = message
            textSize = 15f
            setTextColor(ThresholdTheme.Colors.Secondary)
            setPadding(0, 0, 0, 22)
        })
        items.forEach { item ->
            val button = ThresholdButton(context).apply {
                setLabel(item.label)
                isEnabled = item.enabled
                alpha = if (item.enabled) 1f else .45f
                setOnClickListener { if (item.enabled) item.action() }
            }
            panel.addView(button, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 12 })
        }
        panel.addView(TextView(context).apply {
            text = "BACK // DISMISS    MENU // OPEN THIS PANEL"
            textSize = 12f
            setTextColor(ThresholdTheme.Colors.Secondary)
            gravity = Gravity.CENTER
            setPadding(0, 10, 0, 0)
        })
        setContentView(panel)
        setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_BACK) {
                dismiss()
                true
            } else false
        }
    }

    override fun onStart() {
        super.onStart()
        window?.apply {
            setBackgroundDrawableResource(android.R.color.transparent)
            addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            attributes = attributes.apply { dimAmount = .78f }
            setLayout(760, android.view.WindowManager.LayoutParams.WRAP_CONTENT)
        }
        findFirstFocusable(window?.decorView)?.requestFocus()
    }

    private fun findFirstFocusable(view: View?): View? {
        if (view == null) return null
        if (view.isFocusable && view.isEnabled) return view
        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) findFirstFocusable(view.getChildAt(i))?.let { return it }
        }
        return null
    }
}
