# Gemini Clone

Clone dari Google Gemini menggunakan Next.js dan Gemini AI API.

## 🚀 Features

- **Chat Interface**: Interface percakapan yang mirip dengan Google Gemini
- **Gemini AI Integration**: Menggunakan Google Generative AI (model gemini-pro/gemini-pro-vision)
- **File Upload Support**: 
  - **Upload Gambar**: PNG, JPG, JPEG, GIF, WEBP (max 10MB)
  - **Upload PDF**: Ekstraksi teks dari file PDF untuk analisis
  - **Drag & Drop**: Drag dan drop file langsung ke chat interface
- **Markdown Support**: Render response AI dengan format markdown
- **Real-time Chat**: Percakapan real-time dengan loading states
- **Responsive Design**: Desain yang responsif dan mobile-friendly
- **Message History**: Penyimpanan riwayat percakapan dalam session
- **Enhanced Error Handling**: Pesan error yang lebih informatif

## 🛠️ Tech Stack

- **Framework**: Next.js 15 dengan App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS dengan Typography plugin
- **AI**: Google Generative AI SDK (gemini-pro & gemini-pro-vision)
- **File Processing**: PDF.js untuk ekstraksi teks PDF
- **File Upload**: React Dropzone untuk drag & drop
- **Icons**: Lucide React
- **Markdown**: React Markdown

## 📋 Prerequisites

- Node.js 18+ 
- npm atau yarn
- Google AI Studio API Key (Gemini)

## 🔧 Setup & Installation

1. **Clone repository ini**
   ```bash
   cd gemini_clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment Variables**
   File `.env.local` sudah tersedia dengan API key:
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyDUgdVGI7sagzQ7Zu9C02SnZQbs_923SqA
   ```
   
   > **Note**: API key di atas menggunakan model Gemini gratis. Untuk production, ganti dengan API key Anda sendiri.

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Open Browser**
   Buka [http://localhost:3000](http://localhost:3000) untuk melihat aplikasi.

## 🎯 How to Use

### Basic Chat
1. Buka aplikasi di browser
2. Ketik pertanyaan atau pesan di kotak input di bagian bawah
3. Tekan Enter atau klik tombol Send
4. AI akan merespons dengan jawaban yang diformat dengan markdown

### Upload Files
1. **Upload Gambar**: 
   - Klik ikon 📎 atau drag & drop file gambar ke chat
   - Supported formats: PNG, JPG, JPEG, GIF, WEBP
   - Gambar akan dianalisis menggunakan model Gemini Pro Vision
   
2. **Upload PDF**:
   - Klik ikon 📎 atau drag & drop file PDF ke chat
   - Teks akan diekstrak dari PDF dan dianalisis oleh AI
   - Useful untuk analisis dokumen, resume, artikel, dll

3. **Multi-file Upload**:
   - Bisa upload beberapa file sekaligus (mix gambar + PDF)
   - File size maksimal: 10MB per file

### Chat Features
- Riwayat percakapan tersimpan selama session aktif
- Loading indicator saat AI memproses
- Error handling yang informatif
- Responsive design untuk mobile & desktop

## 🏗️ Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
└── components/
    └── GeminiChat.tsx       # Main chat component
```

## ⚙️ Configuration

### Gemini AI Model
Aplikasi ini menggunakan model `gemini-pro` (gratis) dari Google AI. Model ini memiliki batas rate limit untuk penggunaan gratis.

### Tailwind CSS
Konfigurasi Tailwind sudah include Typography plugin untuk styling markdown response.

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
1. Push code ke GitHub
2. Connect repository di Vercel
3. Add environment variable `NEXT_PUBLIC_GEMINI_API_KEY`
4. Deploy

## 🔍 Troubleshooting

### API Key Issues
- Pastikan API key valid dan aktif
- Cek quota limit di Google AI Studio
- Pastikan environment variable ter-load dengan benar

### Build Errors
- Jalankan `npm run build` untuk cek TypeScript errors
- Pastikan semua dependencies ter-install
- Cek eslint configuration

### PDF.js worker 404 / "Setting up fake worker" warning

If you see warnings in the browser like:

- "Setting up fake worker." (from pdfjs) and
- a 404 for a CDN worker URL such as `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.js`,

It means pdf.js couldn't load a dedicated worker script and fell back to a fake (main-thread) worker which is slower. To fix this, download `pdf.worker.min.js` matching your `pdfjs-dist` version and place it in the `public/` folder as `public/pdf.worker.min.js` so it can be served locally at `/pdf.worker.min.js`.

If you prefer not to host it locally, ensure the CDN URL exists for your installed `pdfjs-dist` version or update the code to use a compatible CDN URL. The component now attempts a local worker first, then CDN fallbacks.

### Hydration mismatch warnings in development

If you see hydration mismatch warnings in the browser (React complains that server-rendered HTML didn't match client render), try these steps:

- Disable browser extensions (some extensions modify DOM before React hydrates). Test in an incognito/private window with extensions off.
- Avoid using `Date.now()` / `Math.random()` in server-rendered code paths — instead use them in client event handlers or inside `useEffect`.
- Use `suppressHydrationWarning` on elements where you expect client-only differences (already applied to `<body>` in this project).

If the warning persists, paste the browser console stack trace and I can help pinpoint the component causing mismatch.

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

Distributed under the MIT License.

## 🙏 Acknowledgments

- Google Generative AI untuk API
- Next.js team untuk framework yang luar biasa
- Tailwind CSS untuk utility-first CSS framework
