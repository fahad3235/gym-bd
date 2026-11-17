# -*- coding: utf-8 -*-
"""Generate js/i18n.js (pure-ASCII, Bengali as \\uXXXX escapes).
Run: python3 tools/gen_i18n.py   (from the gym-bd folder)
Edit strings here, never by hand in js/i18n.js.
"""
import json
import os

STRINGS = {
    "appTitle": ("Gym Membership Manager", "জিম সদস্যপদ ব্যবস্থাপক"),
    "appSub": ("Members, plans, fees & attendance — fully offline",
               "সদস্য, প্ল্যান, ফি ও উপস্থিতি — সম্পূর্ণ অফলাইন"),
    "tabDashboard": ("Dashboard", "ড্যাশবোর্ড"),
    "tabMembers": ("Members", "সদস্য"),
    "tabPlans": ("Plans", "প্ল্যান"),
    "tabAttendance": ("Attendance", "উপস্থিতি"),
    "tabData": ("Data", "ডেটা"),
    "statActive": ("Active members", "সক্রিয় সদস্য"),
    "statExpiring": ("Expiring in 7 days", "৭ দিনে মেয়াদ শেষ"),
    "statExpired": ("Expired", "মেয়াদোত্তীর্ণ"),
    "statCollected": ("Collected this month", "এই মাসে আদায়"),
    "statDue": ("Total due", "মোট বকেয়া"),
    "statToday": ("Checked in today", "আজ উপস্থিত"),
    "expiringTitle": ("Expiring soon", "শীঘ্রই মেয়াদ শেষ"),
    "recentPayments": ("Recent payments", "সাম্প্রতিক পেমেন্ট"),
    "noExpiring": ("No memberships expiring soon.",
                   "শীঘ্রই কোনো মেয়াদ শেষ হচ্ছে না।"),
    "noPayments": ("No payments yet.", "এখনো কোনো পেমেন্ট নেই।"),
    "addMember": ("Add member", "সদস্য যোগ করুন"),
    "editMember": ("Edit member", "সদস্য সম্পাদনা"),
    "name": ("Name", "নাম"),
    "phone": ("Mobile", "মোবাইল"),
    "phonePh": ("01XXXXXXXXX", "০১XXXXXXXXX"),
    "gender": ("Gender", "লিঙ্গ"),
    "genderAny": ("Prefer not to say", "বলতে চাই না"),
    "male": ("Male", "পুরুষ"),
    "female": ("Female", "মহিলা"),
    "plan": ("Plan", "প্ল্যান"),
    "startDate": ("Start date", "শুরুর তারিখ"),
    "trainer": ("Trainer (optional)", "প্রশিক্ষক (ঐচ্ছিক)"),
    "notes": ("Notes (optional)", "মন্তব্য (ঐচ্ছিক)"),
    "save": ("Save", "সংরক্ষণ"),
    "cancel": ("Cancel", "বাতিল"),
    "searchPh": ("Search name or mobile…", "নাম বা মোবাইল খুঁজুন…"),
    "filterAll": ("All", "সব"),
    "filterActive": ("Active", "সক্রিয়"),
    "filterExpiring": ("Expiring soon", "শীঘ্রই শেষ"),
    "filterExpired": ("Expired", "মেয়াদোত্তীর্ণ"),
    "statusActive": ("Active", "সক্রিয়"),
    "statusExpiring": ("Expiring soon", "শীঘ্রই শেষ"),
    "statusExpired": ("Expired", "মেয়াদোত্তীর্ণ"),
    "due": ("Due", "বকেয়া"),
    "paid": ("Paid", "পরিশোধিত"),
    "ends": ("Ends", "শেষ"),
    "checkIn": ("Check in", "উপস্থিত করুন"),
    "checkedIn": ("Checked in", "উপস্থিত"),
    "pay": ("Record payment", "পেমেন্ট লিখুন"),
    "renew": ("Renew", "নবায়ন"),
    "edit": ("Edit", "সম্পাদনা"),
    "delete": ("Delete", "মুছুন"),
    "noMembers": ("No members yet. Add your first member.",
                  "এখনো কোনো সদস্য নেই। প্রথম সদস্য যোগ করুন।"),
    "addPlan": ("Add plan", "প্ল্যান যোগ করুন"),
    "planName": ("Plan name", "প্ল্যানের নাম"),
    "planNamePh": ("e.g. Monthly", "যেমন: মাসিক"),
    "duration": ("Duration (months)", "মেয়াদ (মাস)"),
    "fee": ("Fee (৳)", "ফি (৳)"),
    "membersUsing": ("members", "জন সদস্য"),
    "deletePlanBlocked": ("Cannot delete — members use this plan.",
                         "মোছা যাবে না — সদস্যরা এই প্ল্যান ব্যবহার করছে।"),
    "noPlans": ("No plans yet. Add a plan first, then add members.",
                "এখনো কোনো প্ল্যান নেই। প্রথমে প্ল্যান যোগ করুন, তারপর সদস্য।"),
    "paymentTitle": ("Record payment", "পেমেন্ট লিখুন"),
    "amount": ("Amount (৳)", "পরিমাণ (৳)"),
    "payDate": ("Date", "তারিখ"),
    "method": ("Method", "মাধ্যম"),
    "cash": ("Cash", "নগদ"),
    "bkash": ("bKash", "বিকাশ"),
    "nagad": ("Nagad", "নগদ"),
    "bank": ("Bank transfer", "ব্যাংক ট্রান্সফার"),
    "payNote": ("Note (optional)", "মন্তব্য (ঐচ্ছিক)"),
    "record": ("Record", "লিখুন"),
    "attendanceTitle": ("Attendance", "উপস্থিতি"),
    "attDate": ("Date", "তারিখ"),
    "attCount": ("checked in", "জন উপস্থিত"),
    "monthCount": ("this month", "এই মাসে"),
    "streak": ("day streak", "দিনের ধারাবাহিকতা"),
    "dataTitle": ("Your data", "আপনার ডেটা"),
    "exportBtn": ("Export JSON", "JSON এক্সপোর্ট"),
    "importBtn": ("Import JSON", "JSON ইমপোর্ট"),
    "eraseBtn": ("Erase all data", "সব ডেটা মুছুন"),
    "eraseConfirm": ("Type DELETE to erase everything",
                     "সব মুছতে DELETE লিখুন"),
    "exportOk": ("Exported.", "এক্সপোর্ট হয়েছে।"),
    "importOk": ("Imported.", "ইমপোর্ট হয়েছে।"),
    "importBad": ("Invalid file — nothing changed.",
                  "ভুল ফাইল — কিছু বদলায়নি।"),
    "erased": ("All data erased.", "সব ডেটা মোছা হয়েছে।"),
    "confirmDelete": ("Delete this member?", "এই সদস্যকে মুছবেন?"),
    "confirmDeletePlan": ("Delete this plan?", "এই প্ল্যানটি মুছবেন?"),
    "renewed": ("Renewed until {date}.", "{date} পর্যন্ত নবায়ন হয়েছে।"),
    "daysLeft": ("{n} days left", "{n} দিন বাকি"),
    "daysOverdue": ("{n} days overdue", "{n} দিন পেরিয়ে গেছে"),
    "endsToday": ("Ends today", "আজ শেষ"),
    "errRequired": ("Required", "আবশ্যক"),
    "errName": ("Name must be 2–60 characters",
                "নাম ২–৬০ অক্ষরের হতে হবে"),
    "errPhone": ("Enter a valid Bangladeshi mobile (01XXXXXXXXX)",
                 "সঠিক বাংলাদেশি মোবাইল দিন (০১XXXXXXXXX)"),
    "errPlan": ("Choose a plan", "প্ল্যান বেছে নিন"),
    "errDate": ("Enter a valid date", "সঠিক তারিখ দিন"),
    "errMonths": ("Duration must be 1–24 months",
                  "মেয়াদ ১–২৪ মাস হতে হবে"),
    "errFee": ("Fee must be 0 or more", "ফি ০ বা তার বেশি হতে হবে"),
    "errAmount": ("Amount must be more than 0",
                  "পরিমাণ ০-এর বেশি হতে হবে"),
    "errFuture": ("Date cannot be in the future",
                  "তারিখ ভবিষ্যতের হতে পারবে না"),
    "footer": ("Offline personal tool. Fees and plans are whatever you "
               "enter — no prices are built in. Always confirm money "
               "against your own records.",
               "অফলাইন ব্যক্তিগত টুল। ফি ও প্ল্যান আপনি যা দেবেন তাই — "
               "কোনো দাম আগে থেকে দেওয়া নেই। টাকার হিসাব নিজের খাতার "
               "সঙ্গে মিলিয়ে নিন।"),
    "memberSince": ("Member since", "সদস্য থেকে"),
    "totalMembers": ("Total members", "মোট সদস্য"),
    "monthsShort": ("mo", "মাস"),
}

out = {"en": {}, "bn": {}}
for k, (en, bn) in STRINGS.items():
    out["en"][k] = en
    out["bn"][k] = bn

here = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(here, "..", "js", "i18n.js")
os.makedirs(os.path.dirname(target), exist_ok=True)
body = ("/* gym-bd i18n - GENERATED by tools/gen_i18n.py. Do not edit by hand. */\n"
        "window.GYM_I18N = " + json.dumps(out, ensure_ascii=True, indent=2) + ";\n")
with open(target, "w", encoding="ascii") as f:
    f.write(body)
print("wrote", target, "keys:", len(STRINGS))
