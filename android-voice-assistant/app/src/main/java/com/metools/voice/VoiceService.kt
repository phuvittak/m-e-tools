package com.metools.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/**
 * Foreground service that keeps the microphone open and listens for a wake
 * word ("ผู้ช่วย" / "assistant" / ...). When heard, the rest of the phrase is
 * dispatched to [CommandHandler]; speak the reply, fire the intent, and resume
 * listening.
 *
 * Notes / limitations:
 *  - Uses the on-device [SpeechRecognizer], restarted in a loop. This is the
 *    free, no-API-key path. For rock-solid always-on wake detection consider an
 *    offline wake-word engine (Picovoice Porcupine or Vosk) — see README.
 *  - Android may still throttle the mic when the screen is off for long periods
 *    or under battery optimisation. Exclude the app from battery optimisation
 *    for best results. The OS can NEVER let an app unlock the screen for you.
 */
class VoiceService : Service(), RecognitionListener {

    companion object {
        const val ACTION_STATUS = "com.metools.voice.STATUS"
        const val EXTRA_STATUS = "status"
        private const val CHANNEL_ID = "voice_listen"
        private const val NOTIF_ID = 42
        private const val TAG = "VoiceService"

        // Wake words: strip these, then treat the remainder as the command.
        private val WAKE = Regex(
            """^(?:โอเค|ok|okay|เฮ้|เฮ|hey|hi|ผู้ช่วย|assistant|จาร์วิส|jarvis|สิริ|siri)[\s,.]*""",
            RegexOption.IGNORE_CASE
        )
    }

    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private val main = Handler(Looper.getMainLooper())

    private var running = false
    private var speaking = false
    private var awakened = false        // wake word heard, waiting for the command

    override fun onCreate() {
        super.onCreate()
        startForegroundWithNotification()

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("th", "TH")
            }
        }

        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(this@VoiceService)
            }
            running = true
            updateStatus("กำลังรอคำปลุก “ผู้ช่วย”…")
            listen()
        } else {
            updateStatus("อุปกรณ์นี้ไม่รองรับการรู้จำเสียง")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        running = false
        main.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        tts?.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?) = null

    // --- Listening loop -------------------------------------------------------
    private fun listen() {
        if (!running || speaking) return
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "th-TH")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        try {
            recognizer?.startListening(i)
        } catch (e: Exception) {
            Log.w(TAG, "startListening failed", e)
            restartSoon()
        }
    }

    private fun restartSoon(delay: Long = 600) {
        if (!running) return
        main.postDelayed({ if (running && !speaking) { recognizer?.cancel(); listen() } }, delay)
    }

    private fun process(textRaw: String) {
        val text = textRaw.trim()
        if (text.isEmpty()) return

        if (awakened) {
            awakened = false
            dispatch(text)
            return
        }
        val m = WAKE.find(text) ?: return        // ignore speech without the wake word
        val cmd = text.substring(m.value.length).trim()
        if (cmd.isNotEmpty()) {
            dispatch(cmd)                         // "ผู้ช่วย เปิด youtube" in one breath
        } else {
            awakened = true                       // just the wake word — ask for the command
            speak("ว่าไงครับ")
            updateStatus("ว่าไงครับ พูดคำสั่งได้เลย…")
        }
    }

    private fun dispatch(command: String) {
        updateStatus("» $command")
        val result = CommandHandler.handle(command)
        result.intent?.let {
            try { startActivity(it) } catch (e: Exception) { Log.w(TAG, "launch failed", e) }
        }
        speak(result.reply)
    }

    // --- TTS ------------------------------------------------------------------
    private fun speak(text: String) {
        val t = tts ?: return
        speaking = true
        recognizer?.cancel()                      // avoid hearing ourselves
        t.language = if (text.any { it.code in 0x0E00..0x0E7F }) Locale("th", "TH") else Locale.US
        t.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { speaking = false; restartSoon(300) }
            @Deprecated("deprecated") override fun onError(id: String?) { speaking = false; restartSoon(300) }
        })
        t.speak(text, TextToSpeech.QUEUE_FLUSH, null, "reply")
    }

    // --- RecognitionListener --------------------------------------------------
    override fun onResults(results: Bundle?) {
        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
        process(text)
        if (!speaking) restartSoon(250)
    }

    override fun onPartialResults(partial: Bundle?) {
        val text = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
        if (text.isNotBlank() && !awakened) updateStatus(text)
    }

    override fun onError(error: Int) {
        // ERROR_NO_MATCH / ERROR_SPEECH_TIMEOUT are normal in a continuous loop.
        if (!speaking) restartSoon(if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 1000 else 500)
    }

    override fun onReadyForSpeech(params: Bundle?) {
        if (!awakened) updateStatus("กำลังฟัง… เรียก “ผู้ช่วย”")
    }
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    // --- Foreground notification ---------------------------------------------
    private fun startForegroundWithNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Voice listening", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val notif: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun updateStatus(text: String) {
        sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName).putExtra(EXTRA_STATUS, text))
    }
}
