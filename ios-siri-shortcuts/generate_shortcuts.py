#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
สร้างไฟล์ทางลัด (.shortcut) ของ Siri Shortcuts แบบสำเร็จรูป — นำเข้าแล้วใช้ได้เลย

รันด้วย:  python3 generate_shortcuts.py
ผลลัพธ์อยู่ในโฟลเดอร์ ./shortcuts/  (มีทั้งชื่อไทยและอังกฤษ ให้พูดได้สองภาษา)

ทำไมต้องเป็นไฟล์: iOS ไม่ให้ติดตั้งทางลัดแบบเงียบ ๆ จากภายนอก คุณต้องแตะ "นำเข้า"
เอง + เปิด "อนุญาตทางลัดที่ไม่น่าเชื่อถือ" หนึ่งครั้ง (ดูขั้นตอนใน README.md)

หมายเหตุ: ไฟล์เหล่านี้ทำแบบ best-effort และยังไม่ได้ทดสอบบนเครื่องจริงในที่นี้
ถ้า action ไหนนำเข้าไม่ผ่าน ให้ใช้สูตรสร้างมือใน README.md แทนได้
"""

import os
import plistlib
import uuid

OUT = os.path.join(os.path.dirname(__file__), "shortcuts")
OBJ = "￼"  # Object Replacement Character — ตำแหน่งที่จะแทรกตัวแปร

# ---------- ตัวช่วยสร้าง action ----------

def a_url(url: str) -> dict:
    """action: URL (ค่าคงที่)"""
    return {
        "WFWorkflowActionIdentifier": "is.workflow.actions.url",
        "WFWorkflowActionParameters": {"WFURLActionURL": url},
    }

def a_openurl() -> dict:
    """action: เปิด URL (รับค่าจาก action ก่อนหน้า)"""
    return {
        "WFWorkflowActionIdentifier": "is.workflow.actions.openurl",
        "WFWorkflowActionParameters": {},
    }

def a_dictate(lang: str, out_uuid: str) -> dict:
    """action: บอกข้อความ (พูดแล้วถอดเป็นข้อความ)"""
    return {
        "WFWorkflowActionIdentifier": "is.workflow.actions.dictatetext",
        "WFWorkflowActionParameters": {"WFSpeechLanguage": lang, "UUID": out_uuid},
    }

def a_url_with_dictation(prefix: str, dictate_uuid: str) -> dict:
    """action: URL ที่ต่อท้ายด้วยข้อความที่บอก (ตัวแปรจาก dictate)"""
    token = {
        "WFSerializationType": "WFTextTokenString",
        "Value": {
            "string": prefix + OBJ,
            "attachmentsByRange": {
                "{%d, 1}" % len(prefix): {
                    "Type": "ActionOutput",
                    "OutputUUID": dictate_uuid,
                    "OutputName": "Dictated Text",
                }
            },
        },
    }
    return {
        "WFWorkflowActionIdentifier": "is.workflow.actions.url",
        "WFWorkflowActionParameters": {"WFURLActionURL": token},
    }

# ---------- ตัวห่อ workflow ----------

INPUT_CLASSES = [
    "WFAppContentItem", "WFArticleContentItem", "WFContactContentItem",
    "WFDateContentItem", "WFEmailAddressContentItem", "WFGenericFileContentItem",
    "WFImageContentItem", "WFiTunesProductContentItem", "WFLocationContentItem",
    "WFDCMapsLinkContentItem", "WFAVAssetContentItem", "WFPDFContentItem",
    "WFPhoneNumberContentItem", "WFRichTextContentItem", "WFSafariWebPageContentItem",
    "WFStringContentItem", "WFURLContentItem",
]

def workflow(actions: list) -> dict:
    return {
        "WFWorkflowActions": actions,
        "WFWorkflowClientVersion": "1146.7",
        "WFWorkflowMinimumClientVersion": 411,
        "WFWorkflowMinimumClientVersionString": "411",
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowImportQuestions": [],
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 4292093695,
            "WFWorkflowIconGlyphNumber": 61440,
        },
        "WFWorkflowInputContentItemClasses": INPUT_CLASSES,
        "WFWorkflowTypes": ["NCWidget", "WatchKit"],
    }

# ---------- นิยามคำสั่ง ----------

def open_url_shortcut(url: str) -> dict:
    return workflow([a_url(url), a_openurl()])

def search_shortcut(prefix: str, lang: str) -> dict:
    u = str(uuid.uuid4()).upper()
    return workflow([a_dictate(lang, u), a_url_with_dictation(prefix, u), a_openurl()])

# (ชื่อไฟล์ไทย, ชื่อไฟล์อังกฤษ, workflow)
COMMANDS = [
    ("เปิดยูทูป",   "Open YouTube",   open_url_shortcut("https://m.youtube.com/")),
    ("เปิดเฟซบุ๊ก", "Open Facebook",  open_url_shortcut("https://m.facebook.com/")),
    ("เปิดไลน์",    "Open LINE",      open_url_shortcut("https://line.me/")),
    ("เปิดจีเมล",   "Open Gmail",     open_url_shortcut("https://mail.google.com/")),
    ("เปิดแผนที่",  "Open Maps",      open_url_shortcut("https://maps.apple.com/")),
    ("ค้นยูทูปไทย", "Search YouTube", search_shortcut("https://www.youtube.com/results?search_query=", "th-TH")),
    ("ค้นกูเกิลไทย","Search Google",  search_shortcut("https://www.google.com/search?q=", "th-TH")),
]

def main():
    os.makedirs(OUT, exist_ok=True)
    written = []
    for th_name, en_name, wf in COMMANDS:
        for name in (th_name, en_name):
            path = os.path.join(OUT, name + ".shortcut")
            with open(path, "wb") as f:
                plistlib.dump(wf, f, fmt=plistlib.FMT_XML)
            written.append(os.path.basename(path))
    print("สร้างไฟล์ทางลัดสำเร็จ %d ไฟล์:" % len(written))
    for w in written:
        print("  -", w)

if __name__ == "__main__":
    main()
