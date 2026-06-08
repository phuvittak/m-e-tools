package com.metools.voice

import android.content.Intent
import android.net.Uri
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Turns a recognized phrase (Thai or English) into a spoken reply and an
 * optional Intent to fire. Pure logic — no Android context needed, so it is
 * easy to unit-test.
 */
object CommandHandler {

    data class Result(val reply: String, val intent: Intent? = null)

    private fun hasThai(s: String) = s.any { it.code in 0x0E00..0x0E7F }

    private fun view(url: String) = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    fun handle(raw: String): Result {
        val t = raw.trim()
        val th = hasThai(t)
        fun say(thMsg: String, enMsg: String) = if (th) thMsg else enMsg

        // ---- YouTube (with optional search query) ----
        Regex("""(?:เปิด|เล่น|play|open)\s*(?:youtube|ยูทูป|ยูทูบ)\s*(.*)$""", RegexOption.IGNORE_CASE)
            .find(t)?.let { m ->
                val q = m.groupValues[1].trim()
                return if (q.isNotEmpty()) {
                    Result(
                        say("กำลังค้นใน YouTube: $q", "Searching YouTube for: $q"),
                        view("https://www.youtube.com/results?search_query=" + Uri.encode(q))
                    )
                } else {
                    Result(say("กำลังเปิด YouTube", "Opening YouTube"), view("https://m.youtube.com/"))
                }
            }

        // ---- Direct sites / apps ----
        val sites = listOf(
            Triple(Regex("""google\s*maps|แผนที่|maps""", RegexOption.IGNORE_CASE), "https://maps.google.com/", "Google Maps"),
            Triple(Regex("""facebook|เฟส(บุ๊ก|บุ๊ค)?""", RegexOption.IGNORE_CASE), "https://m.facebook.com/", "Facebook"),
            Triple(Regex("""gmail|อีเมล|email|จดหมาย""", RegexOption.IGNORE_CASE), "https://mail.google.com/", "Gmail"),
            Triple(Regex("""line|ไลน์""", RegexOption.IGNORE_CASE), "https://line.me/", "LINE"),
            Triple(Regex("""google|กูเกิล|กูเกิ้ล""", RegexOption.IGNORE_CASE), "https://www.google.com/", "Google"),
        )
        if (Regex("""^(เปิด|open|ไป|go to)\b""", RegexOption.IGNORE_CASE).containsMatchIn(t)) {
            for ((re, url, name) in sites) {
                if (re.containsMatchIn(t)) {
                    return Result(say("กำลังเปิด $name", "Opening $name"), view(url))
                }
            }
        }

        // ---- Phone call ----
        Regex("""(?:โทร(?:หา|ไป)?|call|dial)\s*\D*([0-9][0-9\s\-]{4,})""", RegexOption.IGNORE_CASE)
            .find(t)?.let { m ->
                val num = m.groupValues[1].replace(Regex("""[\s\-]"""), "")
                return Result(
                    say("กำลังโทรหา $num", "Calling $num"),
                    Intent(Intent.ACTION_DIAL, Uri.parse("tel:$num")).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                )
            }

        // ---- Generic search ----
        Regex("""^(?:ค้นหา|หา|search(?:\s+for)?|google)\s+(.+)$""", RegexOption.IGNORE_CASE)
            .find(t)?.let { m ->
                val q = m.groupValues[1].trim()
                return Result(
                    say("กำลังค้นหา: $q", "Searching for: $q"),
                    view("https://www.google.com/search?q=" + Uri.encode(q))
                )
            }

        // ---- Time ----
        if (Regex("""กี่โมง|เวลา|what.*time|time now""", RegexOption.IGNORE_CASE).containsMatchIn(t)) {
            val c = Calendar.getInstance()
            val h = c.get(Calendar.HOUR_OF_DAY); val m = c.get(Calendar.MINUTE)
            val en = SimpleDateFormat("h:mm a", Locale.US).format(c.time)
            return Result(say("ตอนนี้ $h นาฬิกา $m นาที", "It is $en"))
        }

        // ---- Date ----
        if (Regex("""วันอะไร|วันที่เท่าไหร่|วันที่|what.*(date|day)""", RegexOption.IGNORE_CASE).containsMatchIn(t)) {
            val now = Calendar.getInstance().time
            val thD = SimpleDateFormat("EEEE d MMMM yyyy", Locale("th", "TH")).format(now)
            val enD = SimpleDateFormat("EEEE d MMMM yyyy", Locale.US).format(now)
            return Result(say("วันนี้ $thD", "Today is $enD"))
        }

        // ---- Greeting / thanks ----
        if (Regex("""^(สวัสดี|ดีจ้า|หวัดดี|hello|hi|hey)\b""", RegexOption.IGNORE_CASE).containsMatchIn(t))
            return Result(say("สวัสดีครับ ให้ช่วยอะไรดี?", "Hi! How can I help?"))
        if (Regex("""ขอบคุณ|thank""", RegexOption.IGNORE_CASE).containsMatchIn(t))
            return Result(say("ยินดีครับ", "You're welcome!"))

        // ---- Fallback: web search ----
        return Result(
            say("ยังไม่เข้าใจ ค้นหาให้แทนนะครับ: $t", "I didn't catch that — searching: $t"),
            view("https://www.google.com/search?q=" + Uri.encode(t))
        )
    }
}
