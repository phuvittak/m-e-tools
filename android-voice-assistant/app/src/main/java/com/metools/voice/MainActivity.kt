package com.metools.voice

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.metools.voice.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private var serviceRunning = false

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) {
            i?.getStringExtra(VoiceService.EXTRA_STATUS)?.let { b.statusText.text = it }
        }
    }

    private val permLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result[Manifest.permission.RECORD_AUDIO] == true) startListening()
            else b.statusText.text = "ต้องอนุญาตไมโครโฟนก่อนถึงจะใช้งานได้"
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.toggleBtn.setOnClickListener {
            if (serviceRunning) stopListening() else requestPermsThenStart()
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(VoiceService.ACTION_STATUS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else
            @Suppress("UnspecifiedRegisterReceiverFlag") registerReceiver(statusReceiver, filter)
    }

    override fun onStop() {
        super.onStop()
        runCatching { unregisterReceiver(statusReceiver) }
    }

    private fun requestPermsThenStart() {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            perms += Manifest.permission.POST_NOTIFICATIONS

        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) startListening() else permLauncher.launch(missing.toTypedArray())
    }

    private fun startListening() {
        ContextCompat.startForegroundService(this, Intent(this, VoiceService::class.java))
        serviceRunning = true
        b.toggleBtn.setText(R.string.stop)
        b.statusText.text = "กำลังรอคำปลุก “ผู้ช่วย”…"
    }

    private fun stopListening() {
        stopService(Intent(this, VoiceService::class.java))
        serviceRunning = false
        b.toggleBtn.setText(R.string.start)
        b.statusText.setText(R.string.idle)
    }
}
