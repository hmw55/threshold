
package com.thresholdtv.ui.screens

import android.content.Context
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.ui.ThresholdTheme
import com.thresholdtv.ui.components.SignalNoiseView
import com.thresholdtv.ui.components.ThresholdButton

class JoinExpeditionScreen(
    context: Context,
    private val onJoin: (String) -> Unit,
    private val onCancel: () -> Unit
) : FrameLayout(context) {

    private val signalNoise = SignalNoiseView(context)

    private val codeInput = EditText(context).apply {
        hint = "AB7K"
        textSize = 42f
        gravity = Gravity.CENTER
        isSingleLine = true
        inputType = InputType.TYPE_CLASS_TEXT or
            InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        imeOptions = EditorInfo.IME_ACTION_DONE

        filters = arrayOf(
            InputFilter.AllCaps(),
            InputFilter.LengthFilter(4)
        )

        setTextColor(ThresholdTheme.Colors.Primary)
        setHintTextColor(ThresholdTheme.Colors.Secondary)
        setBackgroundColor(0xFF12161D.toInt())
        setPadding(24, 12, 24, 12)

        setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submitCode()
                true
            } else {
                false
            }
        }
    }

    private val status = TextView(context).apply {
        text = "ENTER THE FOUR-CHARACTER ACCESS CODE"
        textSize = 15f
        gravity = Gravity.CENTER
        setTextColor(ThresholdTheme.Colors.Secondary)
        typeface = ThresholdTheme.Typography.Terminal
    }

    private val joinButton = ThresholdButton(context).apply {
        setLabel("CONNECT TO EXPEDITION")
        setOnClickListener {
            submitCode()
        }
    }

    private val cancelButton = ThresholdButton(context).apply {
        setLabel("CANCEL")
        setOnClickListener {
            onCancel()
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

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        val heading = TextView(context).apply {
            text = "JOIN EXPEDITION"
            textSize = 38f
            gravity = Gravity.CENTER
            typeface = ThresholdTheme.Typography.Display
            setTextColor(ThresholdTheme.Colors.Primary)
        }

        content.addView(heading)

        content.addView(
            status,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 28
            }
        )

        content.addView(
            codeInput,
            LinearLayout.LayoutParams(
                280,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = 24
            }
        )

        val actions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER

            addView(joinButton)

            addView(
                cancelButton,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    leftMargin = 24
                }
            )
        }

        content.addView(
            actions,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 32
            }
        )

        addView(
            content,
            LayoutParams(
                800,
                LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        )
    }

    fun activate() {
        signalNoise.start()
        codeInput.requestFocus()
    }

    fun deactivate() {
        signalNoise.stop()
    }

    fun setLoading(loading: Boolean) {
        joinButton.isEnabled = !loading
        cancelButton.isEnabled = !loading
        codeInput.isEnabled = !loading

        if (loading) {
            status.text = "ESTABLISHING THRESHOLD CONNECTION..."
        }
    }

    fun showError(message: String) {
        setLoading(false)
        status.text = message
        codeInput.requestFocus()
    }

    private fun submitCode() {
        val code = codeInput.text.toString()
            .trim()
            .uppercase()

        if (!code.matches(
                Regex("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}")
            )
        ) {
            showError("INVALID ACCESS CODE")
            return
        }

        setLoading(true)
        onJoin(code)
    }

    override fun onDetachedFromWindow() {
        deactivate()
        super.onDetachedFromWindow()
    }
}
