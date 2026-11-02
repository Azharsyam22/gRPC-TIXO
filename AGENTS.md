# TIXO Project — AI IDE Agent Instructions

Semua Agen AI (Cursor, Windsurf, GitHub Copilot, Antigravity, Claude Code) yang bekerja pada repositori ini WAJIB membaca file panduan kolaborasi tim terlebih dahulu:
👉 **Baca file acuan: `TEAM_GUIDE.md`**

Di dalam `TEAM_GUIDE.md` terdapat:
1. Batasan modul dan direktori untuk masing-masing peran:
   - **Azhar:** Backend, Database, Protobuf (`/backend`, `/database`, `/proto`)
   - **Fajar:** Frontend React Web (`/frontend`)
   - **Fasha:** DevOps, Envoy Proxy & k6 Load Test (`/envoy`, `/scripts`, `docker-compose.yml`)
2. Spesifikasi port standar: Backend gRPC `50051`, Envoy Proxy `8080`, MySQL `3306`, Frontend `5173`.
3. Standar kontrak gRPC 8 RPCs (`proto/tixo.proto`).
4. Aturan bisnis harga tiket: Hari biasa Rp 40.000, Akhir pekan (Sabtu & Minggu) Rp 45.000 (+Rp 5.000).

---

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
