
package com.thresholdtv.session

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

data class ConnectedThreshold(
    val id: String,
    val deviceId: String,
    val zoneName: String
)

data class ExpeditionSession(
    val code: String,
    val playerNames: List<String>,
    val thresholds: List<ConnectedThreshold>,
    val phase: String
)

data class ThresholdConnection(
    val session: ExpeditionSession,
    val threshold: ConnectedThreshold
)

class SessionException(
    val statusCode: Int,
    val errorCode: String
) : Exception("Session request failed: $errorCode ($statusCode)")

class SessionClient(
    context: Context,
    private val baseUrl: String
) {
    private val preferences =
        context.applicationContext.getSharedPreferences(
            "threshold_session",
            Context.MODE_PRIVATE
        )

    val deviceId: String =
        preferences.getString("device_id", null)
            ?: UUID.randomUUID().toString().also { generated ->
                preferences.edit()
                    .putString("device_id", generated)
                    .apply()
            }

    fun createExpedition(): ThresholdConnection {
        val session = parseSession(
            request(
                method = "POST",
                path = "/sessions",
                payload = JSONObject()
                    .put("deviceId", deviceId)
            )
        )

        val threshold = session.thresholds.firstOrNull {
            it.deviceId == deviceId
        } ?: error("Creating Threshold missing from session")

        return ThresholdConnection(session, threshold)
    }

    fun joinExpedition(code: String): ThresholdConnection {
        val body = request(
            method = "POST",
            path = "/sessions/${normalizeCode(code)}/thresholds",
            payload = JSONObject()
                .put("deviceId", deviceId)
        )

        return parseConnection(body)
    }

    fun reconnectExpedition(code: String): ThresholdConnection {
        val body = request(
            method = "POST",
            path = "/sessions/${normalizeCode(code)}/thresholds/reconnect",
            payload = JSONObject()
                .put("deviceId", deviceId)
        )

        return parseConnection(body)
    }

    fun getExpedition(code: String): ExpeditionSession =
        parseSession(
            request(
                method = "GET",
                path = "/sessions/${normalizeCode(code)}"
            )
        )

    fun leaveExpedition(code: String) {
        request(
            method = "DELETE",
            path = "/sessions/${normalizeCode(code)}/thresholds/$deviceId"
        )
    }

    private fun normalizeCode(code: String): String {
        val normalized = code.trim().uppercase()

        require(
            normalized.length == 4 &&
                normalized.all {
                    it in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                }
        ) {
            "Invalid Expedition code"
        }

        return normalized
    }

    private fun parseConnection(body: JSONObject): ThresholdConnection =
        ThresholdConnection(
            session = parseSession(body.getJSONObject("session")),
            threshold = parseThreshold(body.getJSONObject("threshold"))
        )

    private fun parseSession(body: JSONObject): ExpeditionSession {
        val players = body.getJSONArray("players")
        val thresholds = body.getJSONArray("thresholds")

        val playerNames = buildList {
            for (index in 0 until players.length()) {
                add(players.getJSONObject(index).getString("name"))
            }
        }

        val connectedThresholds = buildList {
            for (index in 0 until thresholds.length()) {
                add(parseThreshold(thresholds.getJSONObject(index)))
            }
        }

        return ExpeditionSession(
            code = body.getString("code"),
            playerNames = playerNames,
            thresholds = connectedThresholds,
            phase = body.optString("phase", "lobby")
        )
    }

    private fun parseThreshold(body: JSONObject): ConnectedThreshold =
        ConnectedThreshold(
            id = body.getString("id"),
            deviceId = body.getString("deviceId"),
            zoneName = body.getString("zoneName")
        )

    private fun request(
        method: String,
        path: String,
        payload: JSONObject? = null
    ): JSONObject {
        val connection =
            URL("${baseUrl.trimEnd('/')}$path")
                .openConnection() as HttpURLConnection

        try {
            connection.requestMethod = method
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            connection.setRequestProperty(
                "Accept",
                "application/json"
            )

            if (payload != null) {
                connection.doOutput = true
                connection.setRequestProperty(
                    "Content-Type",
                    "application/json"
                )

                connection.outputStream.use { stream ->
                    stream.write(
                        payload.toString().toByteArray(Charsets.UTF_8)
                    )
                }
            }

            val statusCode = connection.responseCode

            val responseText = (
                if (statusCode in 200..299) {
                    connection.inputStream
                } else {
                    connection.errorStream
                }
            )?.bufferedReader()?.use { it.readText() }.orEmpty()

            if (statusCode !in 200..299) {
                val errorCode = runCatching {
                    JSONObject(responseText).getString("error")
                }.getOrDefault("http_error")

                throw SessionException(statusCode, errorCode)
            }

            return JSONObject(responseText)
        } finally {
            connection.disconnect()
        }
    }
}
