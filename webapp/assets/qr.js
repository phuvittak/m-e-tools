/* =================================================================
   M.E.Tools — Real QR code + PromptPay (EMVCo) payload generator
   -----------------------------------------------------------------
   • MEQR.promptPayPayload(id, amount)  → EMVCo string (locked amount)
   • MEQR.svg(text, opts)               → scannable QR as <svg> string
   • MEQR.promptPaySvg(id, amount, opts) → ready-to-show PromptPay QR
   QR encoder is a self-contained port of Nayuki's public-domain
   "QR Code generator" (byte mode, automatic version, ECC level M).
   ================================================================= */
(function (global) {
  "use strict";

  /* ---------- Reed–Solomon + QR matrix (byte mode, ECC = M) ---------- */
  var ECC_M = 1; // error-correction level index used by the tables below

  // number of ECC codewords / blocks per (version, level) — level order: L,M,Q,H
  var ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 13, 17, 10, 16, 22, 28, 18, 26], // L (cols = version 1..10)
    [-1, 10, 16, 22, 28, 24, 28, 36, 44, 26, 44], // M
    [-1, 13, 22, 26, 36, 18, 26, 26, 26, 24, 30], // Q
    [-1, 17, 28, 22, 16, 22, 28, 26, 24, 28, 24], // H
  ];
  var NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],  // L
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],  // M
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],  // Q
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],  // H
  ];

  function getNumRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  }

  // GF(256) Reed–Solomon
  function reedSolomonComputeDivisor(degree) {
    var result = []; for (var i = 0; i < degree - 1; i++) result.push(0); result.push(1);
    var root = 1;
    for (var i2 = 0; i2 < degree; i2++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = reedSolomonMultiply(root, 0x02);
    }
    return result;
  }
  function reedSolomonComputeRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= reedSolomonMultiply(coef, factor); });
    });
    return result;
  }
  function reedSolomonMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }

  function QRMatrix(ver) {
    this.version = ver;
    this.size = ver * 4 + 17;
    this.modules = [];
    this.isFunction = [];
    for (var i = 0; i < this.size; i++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFunction.push(new Array(this.size).fill(false));
    }
  }
  QRMatrix.prototype.setFunctionModule = function (x, y, isDark) {
    this.modules[y][x] = isDark; this.isFunction[y][x] = true;
  };
  QRMatrix.prototype.drawFinderPattern = function (x, y) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy));
      var xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
        this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
    }
  };
  QRMatrix.prototype.drawAlignmentPattern = function (x, y) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
      this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  };
  QRMatrix.prototype.getAlignmentPatternPositions = function () {
    var ver = this.version;
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var step = Math.floor((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6];
    for (var pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  };

  // build matrix + interleave codewords for byte mode
  function encodeBytes(data, ecl) {
    // choose smallest version (1..10) that fits
    var ver, dataCapacityBits;
    for (ver = 1; ver <= 10; ver++) {
      dataCapacityBits = getNumDataCodewords(ver, ecl) * 8;
      // header: 4 (mode) + charCountBits + 8*len
      var ccBits = ver <= 9 ? 8 : 16;
      var needed = 4 + ccBits + data.length * 8;
      if (needed <= dataCapacityBits) break;
    }
    if (ver > 10) throw new Error("ข้อมูลยาวเกินไปสำหรับ QR (PromptPay payload ผิดปกติ)");

    var ccBits = ver <= 9 ? 8 : 16;
    // build bit buffer
    var bb = [];
    function appendBits(val, len) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
    appendBits(0x4, 4);            // byte mode
    appendBits(data.length, ccBits);
    data.forEach(function (b) { appendBits(b, 8); });

    var dataCapacity = getNumDataCodewords(ver, ecl) * 8;
    appendBits(0, Math.min(4, dataCapacity - bb.length)); // terminator
    while (bb.length % 8 !== 0) bb.push(0);
    // pad bytes
    for (var padByte = 0xEC; bb.length < dataCapacity; padByte ^= 0xEC ^ 0x11)
      appendBits(padByte, 8);

    // pack into bytes
    var dataCodewords = [];
    for (var i = 0; i < bb.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bb[i + j];
      dataCodewords.push(b);
    }

    // ---- ECC + interleave ----
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
    var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
    var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);
    var blocks = [];
    var rsDiv = reedSolomonComputeDivisor(blockEccLen);
    var k = 0;
    for (var b2 = 0; b2 < numBlocks; b2++) {
      var datLen = shortBlockLen - blockEccLen + (b2 < numShortBlocks ? 0 : 1);
      var dat = dataCodewords.slice(k, k + datLen); k += datLen;
      var ecc = reedSolomonComputeRemainder(dat, rsDiv);
      if (b2 < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var i2 = 0; i2 < blocks[0].length; i2++) {
      for (var b3 = 0; b3 < blocks.length; b3++) {
        if (i2 !== shortBlockLen - blockEccLen || b3 >= numShortBlocks)
          result.push(blocks[b3][i2]);
      }
    }

    // ---- draw matrix ----
    var m = new QRMatrix(ver);
    drawFunctionPatterns(m);
    drawCodewords(m, result);
    // pick best mask (0..7)
    var bestMask = 0, minPenalty = Infinity;
    for (var msk = 0; msk < 8; msk++) {
      applyMask(m, msk); drawFormatBits(m, ecl, msk);
      var p = penalty(m);
      if (p < minPenalty) { minPenalty = p; bestMask = msk; }
      applyMask(m, msk); // undo (XOR again)
    }
    applyMask(m, bestMask); drawFormatBits(m, ecl, bestMask);
    return m;
  }

  function drawFunctionPatterns(m) {
    var size = m.size;
    // timing
    for (var i = 0; i < size; i++) {
      m.setFunctionModule(6, i, i % 2 === 0);
      m.setFunctionModule(i, 6, i % 2 === 0);
    }
    // finders
    m.drawFinderPattern(3, 3);
    m.drawFinderPattern(size - 4, 3);
    m.drawFinderPattern(3, size - 4);
    // alignment
    var pos = m.getAlignmentPatternPositions();
    var n = pos.length;
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === n - 1) || (a === n - 1 && b === 0)) continue;
      m.drawAlignmentPattern(pos[a], pos[b]);
    }
    // dark module + reserve format/version areas (drawn later via setFunctionModule in format/version)
    drawFormatBits(m, ECC_M, 0); // reserve (overwritten later)
  }

  function drawFormatBits(m, ecl, mask) {
    // ecl bits per spec: L=01, M=00, Q=11, H=10 → map index L0 M1 Q2 H3
    var eclBits = [1, 0, 3, 2][ecl];
    var data = (eclBits << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    // first copy
    for (var i2 = 0; i2 <= 5; i2++) m.setFunctionModule(8, i2, getBit(bits, i2));
    m.setFunctionModule(8, 7, getBit(bits, 6));
    m.setFunctionModule(8, 8, getBit(bits, 7));
    m.setFunctionModule(7, 8, getBit(bits, 8));
    for (var i3 = 9; i3 < 15; i3++) m.setFunctionModule(14 - i3, 8, getBit(bits, i3));
    // second copy
    for (var i4 = 0; i4 < 8; i4++) m.setFunctionModule(m.size - 1 - i4, 8, getBit(bits, i4));
    for (var i5 = 8; i5 < 15; i5++) m.setFunctionModule(8, m.size - 15 + i5, getBit(bits, i5));
    m.setFunctionModule(8, m.size - 8, true); // always-dark module
  }
  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function drawCodewords(m, data) {
    var size = m.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!m.isFunction[y][x] && i < data.length * 8) {
            m.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  function applyMask(m, mask) {
    var size = m.size;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      if (m.isFunction[y][x]) continue;
      var invert;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
      }
      if (invert) m.modules[y][x] = !m.modules[y][x];
    }
  }

  function penalty(m) {
    var size = m.size, result = 0, dark = 0;
    // rows + cols runs
    for (var pass = 0; pass < 2; pass++) {
      for (var y = 0; y < size; y++) {
        var runColor = false, runLen = 0;
        for (var x = 0; x < size; x++) {
          var c = pass === 0 ? m.modules[y][x] : m.modules[x][y];
          if (c === runColor) { runLen++; if (runLen === 5) result += 3; else if (runLen > 5) result++; }
          else { runColor = c; runLen = 1; }
          if (pass === 0 && c) dark++;
        }
      }
    }
    // 2x2 blocks
    for (var y2 = 0; y2 < size - 1; y2++) for (var x2 = 0; x2 < size - 1; x2++) {
      var c2 = m.modules[y2][x2];
      if (c2 === m.modules[y2][x2 + 1] && c2 === m.modules[y2 + 1][x2] && c2 === m.modules[y2 + 1][x2 + 1]) result += 3;
    }
    // dark ratio
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }

  /* ---------- public: text → scannable SVG ---------- */
  function toSvg(m, opts) {
    opts = opts || {};
    var border = opts.border == null ? 3 : opts.border;
    var px = opts.scale || 6;
    var size = m.size + border * 2;
    var dim = size * px;
    var rects = "";
    for (var y = 0; y < m.size; y++) for (var x = 0; x < m.size; x++) {
      if (m.modules[y][x])
        rects += '<rect x="' + ((x + border) * px) + '" y="' + ((y + border) * px) + '" width="' + px + '" height="' + px + '"/>';
    }
    return '<svg class="qr-img" width="' + (opts.cssSize || 200) + '" height="' + (opts.cssSize || 200) +
      '" viewBox="0 0 ' + dim + ' ' + dim + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/><g fill="#000">' + rects + '</g></svg>';
  }
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return out;
  }
  function svg(text, opts) {
    var m = encodeBytes(utf8Bytes(text), ECC_M);
    return toSvg(m, opts);
  }

  /* ---------- PromptPay EMVCo payload (locked amount) ----------
     id = เบอร์มือถือ (0812345678) หรือ เลขบัตรประชาชน 13 หลัก หรือ e-Wallet ID
     amount = ยอดบาท (number). ฟิกซ์จำนวนเงินในตัว QR เลย                  */
  function sanitizeId(id) { return String(id || "").replace(/[^0-9]/g, ""); }
  function f(id, value) {
    var len = ("00" + value.length).slice(-2);
    return id + len + value;
  }
  function formatTarget(id) {
    var digits = sanitizeId(id);
    if (digits.length >= 13) return digits.slice(0, 13);          // national ID / tax ID (13)
    // phone → 0066 + drop leading 0 (e.g. 0812345678 → 66812345678 → 0066812345678)
    var phone = digits.replace(/^0/, "66");
    return ("0000000000000" + phone).slice(-13);
  }
  function isNationalId(id) { return sanitizeId(id).length >= 13; }

  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
    return ("000" + crc.toString(16).toUpperCase()).slice(-4);
  }

  function promptPayPayload(id, amount) {
    var target = formatTarget(id);
    var merchantTag = isNationalId(id) ? "02" : "01"; // 01 = phone, 02 = national/tax id
    var merchantAccount = f("00", "A000000677010111") + f(merchantTag, target);
    var amt = (Math.round((+amount || 0) * 100) / 100).toFixed(2);
    // field order follows the de-facto Thai PromptPay standard (country 58 before
    // currency 53 / amount 54) so every bank app parses & locks the amount correctly
    var payload =
      f("00", "01") +                       // payload format indicator
      f("01", amount > 0 ? "12" : "11") +   // 11 = static, 12 = dynamic (one-time, amount locked)
      f("29", merchantAccount) +            // merchant account info (PromptPay)
      f("58", "TH") +                       // country
      f("53", "764") +                      // currency THB
      (amount > 0 ? f("54", amt) : "");     // transaction amount (locked)
    payload += "6304";                       // CRC tag + length placeholder
    return payload + crc16(payload);
  }

  function promptPaySvg(id, amount, opts) {
    return svg(promptPayPayload(id, amount), opts);
  }

  global.MEQR = {
    svg: svg,
    promptPayPayload: promptPayPayload,
    promptPaySvg: promptPaySvg,
    sanitizeId: sanitizeId,
    isValidId: function (id) { var d = sanitizeId(id); return d.length === 10 || d.length === 13; },
  };
})(typeof window !== "undefined" ? window : this);
