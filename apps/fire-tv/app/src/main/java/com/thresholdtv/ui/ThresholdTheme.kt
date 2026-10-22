package com.thresholdtv.ui

import android.graphics.Color
import android.graphics.Typeface

object ThresholdTheme {

    object Colors {
        val Background = Color.rgb(5, 5, 5)
        val Surface = Color.rgb(11, 11, 12)

        val Primary = Color.rgb(244, 244, 242)
        val Secondary = Color.rgb(146, 146, 146)
        val Border = Color.rgb(41, 41, 44)

        // Restrained accents keep the signal legible on a dim television.
        val GlitchCyan = Color.rgb(92, 190, 190)
        val GlitchMagenta = Color.rgb(208, 116, 145)
    }

    object Typography {
        val Display: Typeface =
            Typeface.create("sans-serif-condensed", Typeface.BOLD)

        val Interface: Typeface =
            Typeface.create("sans-serif", Typeface.NORMAL)

        val InterfaceMedium: Typeface =
            Typeface.create("sans-serif-medium", Typeface.NORMAL)

        val Terminal: Typeface =
            Typeface.MONOSPACE
    }

    object Spacing {
        const val ScreenHorizontal = 64
        const val ScreenVertical = 48

        const val TitleToTagline = 12
        const val TaglineToActions = 30
        const val ButtonGap = 20
    }
}
