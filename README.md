# Digital Smile Design (DSD) — Clinical Evaluation Prototype

A private, modern web application for aesthetic dentists to upload patient photographs, calibrate millimeter measurements, design 2D smile architectures, evaluate periodontal biological clearance (EFP guidelines), preview photorealistic smile simulations, and generate printable clinical treatment plans.

---

## 🌟 Key Features

### 1. Multi-Device Responsive Workspace
* **Desktop Workstation ($> 1200\text{px}$)**: 3-column layout with persistent zoom/pan canvas, visual guides panel, and real-time periodontal calculation inspector.
* **iPad Landscape ($1024\text{px} - 1194\text{px}$)**: Touch-optimized design with Apple Pencil / finger padding ($\ge 44\text{px}$ hit areas), split canvas/drawer.
* **Mobile Portrait ($< 768\text{px}$)**: Single-column canvas with swipeable bottom sheets to prevent overlapping controls.

### 2. Smile-Design Canvas & Photographic Calibration
* Calibrate photographs using a known dimension (e.g. 10 mm ruler or central incisor width). Without calibration, the app automatically switches to **proportional mode (%)** rather than millimeters.
* Real-time visual guides: **Facial Midline** (glabella to philtrum), **Bipupillary Horizontal Plane**, **Smile Arc Curve** (lower lip border), and **Incisal Plane**.
* 4 Morphopsychological 2D Tooth Forms: **Oval**, **Square**, **Tapered**, and **Rounded** for maxillary visible teeth (FDI 13, 12, 11, 21, 22, 23).
* Fine millimeter adjustments for width, height, axial inclination, proposed gingival movement, and incisal extension.

### 3. Deterministic Periodontal Engine (EFP Guidelines)
* Hard-coded biological safety rules:
  * **Supracrestal Tissue Attachment (STA)**: Enforces $\ge 3.0\text{ mm}$ between alveolar crest and proposed margin.
  * **Keratinized Tissue Preservation**: Requires $\ge 2.0\text{ mm}$ (optimally $\ge 3.0\text{ mm}$) remaining attached gingiva.
  * **Candidate Outcomes**: Simple Gingivectomy, Flap-based Crown Lengthening with Osseous Resection, or Periodontal Specialist Referral.
  * Missing findings immediately trigger a **"Further Assessment Needed"** state.

### 4. Gemini 3.8 Flash AI Integration
* **3 Editable Aesthetic Suggestions**: Analyzes facial proportions, smile arc harmony, and lip line dynamics without claiming that face shape dictates tooth shape.
* **Photorealistic Smile Simulation**: Interactive Before/After split comparison with mandatory regulatory watermark: *"Simulated treatment outcome — Requires dentist review"*.

### 5. Private Local Storage & Supabase Backend
* Patient high-resolution photos are stored locally on the device using browser **IndexedDB**, eliminating cloud photo storage costs and ensuring strict clinical confidentiality.
* Structured clinical records and revisions synchronize with **Supabase (PostgreSQL with Row Level Security)**.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```
*(Note: The app is equipped with offline fallbacks and realistic preloaded clinical sample cases, so you can test it immediately even before entering API keys!)*

### 3. Start Development Server
```bash
npm run dev
```

---

## ☁️ Automated GitHub $\rightarrow$ Cloudflare Pages Deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) for continuous deployment:

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Digital Smile Design evaluation prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. **Cloudflare Pages Setup**:
   * Go to Cloudflare Dashboard $\rightarrow$ **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to GitHub**.
   * Framework preset: `Vite`
   * Build command: `npm run build`
   * Output directory: `dist`
   * In **Environment Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GEMINI_API_KEY`.
3. Every subsequent `git push` to `main` automatically builds and deploys your website on Cloudflare's global edge network in under 60 seconds.
