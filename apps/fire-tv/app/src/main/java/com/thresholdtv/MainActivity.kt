package com.thresholdtv

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.widget.LinearLayout
import android.widget.TextView
import com.thresholdtv.session.ThresholdState

class MainActivity : Activity() {

    private lateinit var titleView: TextView
    private lateinit var messageView: TextView
    private lateinit var actionView: TextView

    private var state: ThresholdState = ThresholdState.Idle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        titleView = TextView(this).apply {
            textSize = 48f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            letterSpacing = 0.18f
        }

        messageView = TextView(this).apply {
            textSize = 20f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
            setPadding(64, 24, 64, 0)
        }

        actionView = TextView(this).apply {
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 48, 0, 0)
        }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)

            addView(titleView)
            addView(messageView)
            addView(actionView)
        }

        setContentView(layout)
        render()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER
        ) {
            advance()
            return true
        }

        return super.onKeyDown(keyCode, event)
    }

    private fun advance() {
        state = when (val current = state) {
            ThresholdState.Idle ->
                ThresholdState.AwaitingPlayers

            ThresholdState.AwaitingPlayers ->
                ThresholdState.Calibrating

            ThresholdState.Calibrating ->
                ThresholdState.ExpeditionReady(
                    expeditionId = "EXP-001",
                    sectorCount = 1,
                    playerCount = 1
                )

            is ThresholdState.ExpeditionReady ->
                ThresholdState.Playing(current.expeditionId)

            is ThresholdState.Playing ->
                ThresholdState.Results(current.expeditionId)

            is ThresholdState.Results ->
                ThresholdState.Idle
        }

        render()
    }

    private fun render() {
        when (val current = state) {
            ThresholdState.Idle -> {
                titleView.text = "THRESHOLD"
                messageView.text = "Reality is playable."
                actionView.text = "PRESS SELECT TO BEGIN"
            }

            ThresholdState.AwaitingPlayers -> {
                titleView.text = "INITIALIZING"
                messageView.text = "Awaiting Lens connection."
                actionView.text = "PRESS SELECT TO SIMULATE CONNECTION"
            }

            ThresholdState.Calibrating -> {
                titleView.text = "CALIBRATING"
                messageView.text = "Observe your environment."
                actionView.text = "PRESS SELECT WHEN COMPLETE"
            }

            is ThresholdState.ExpeditionReady -> {
                titleView.text = "ENVIRONMENT ACCEPTED"
                messageView.text =
                    "${current.sectorCount} sector.\n" +
                    "${current.playerCount} player.\n" +
                    "Threshold online.\n\n" +
                    "Architect connection established."

                actionView.text = "PRESS SELECT TO BEGIN EXPEDITION"
            }

            is ThresholdState.Playing -> {
                titleView.text = "EXPEDITION 001"
                messageView.text =
                    "Something in this room\ndoes not belong here."

                actionView.text = "PRESS SELECT TO CONTINUE"
            }

            is ThresholdState.Results -> {
                titleView.text = "EXPEDITION COMPLETE"
                messageView.text =
                    "The Architect has recorded your performance."

                actionView.text = "PRESS SELECT TO RETURN"
            }
        }
    }
}