# MECHA: LAST PROTOCOL — Project Rules

---

## RULE 1: NEVER-FORCE-PUSH

`git push --force` (یا `--force-with-lease`) **مطلقاً ممنوع است**.

اگر `git push` عادی rejected شد (non-fast-forward):
1. **فوری STOP کن**
2. گزارش بده: "push rejected — needs investigation"
3. منتظر تصمیر کاربر بمون
4. **هرگز force push نزن**

---

## RULE 2: SESSION-START-SYNC-CHECK

در ابتدای هر session (و بعد از هر gap زمانی)، قبل از هر تغییر جدید:

```
a. git fetch origin
b. git status — بررسی behind/ahead
c. اگر behind یا diverged از origin/main: STOP فوری، گزارش بده
d. اگر clean/up-to-date بود: ادامه بده
```

### خروجی مورد انتظار:
```
git rev-list --left-right --count origin/main...HEAD
# باید خروجی: 0  0  (behind 0, ahead 0)
```

اگر هر عدد غیر از 0 باشد → STOP، گزارش بده.

---

## RULE 3: CODE QUALITY GATES

قبل از هر commit:
1. `npx tsc --noEmit --strict --skipLibCheck` — 0 خطا
2. سرور dev در حال اجرا و HTTP 200
3. تست در browser — بدون console error

---

## RULE 4: VERTICAL SLICE FOCUS

از این لحظه:
- **هیچ سند جدید** — مگر برای حل مشکل واقعی
- **هیچ سیستم جدید** — مگر برای vertical slice
- **فقط تجربه قابل بازی** — اولین ساعت
- قانون 80/20: 80% کد، 20% طراحی

---

## RULE 5: THREE-QUESTION GATE

هیچ محتوایی وارد بازی نمی‌شود مگر اینکه بتواند پاسخ دهد:
1. چه تجربه جدیدی برای بازیکن خلق می‌کند؟
2. چه چیزی درباره دنیای MECHA آشکار می‌کند؟
3. اگر حذفش کنیم، آیا بازی چیزی مهم را از دست می‌دهد؟

---

## شعار پروژه

> **Every step reveals a forgotten truth. Every battle asks a forgotten question.**
> **The world is not waiting to be saved. It is waiting to be understood.**
