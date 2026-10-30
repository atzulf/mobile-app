# Catetan Duit - Frontend Mobile App

<div align="center">

| Beranda & Saldo | Pacing Belanja | Detail Dompet | Anggaran & Plafon | Transfer Antar Dompet |
| :---: | :---: | :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/f0f661ce-e691-4dfd-99a7-e5c4accbc85c" width="180" alt="Beranda & Saldo" /> | <img src="https://github.com/user-attachments/assets/509ff003-2145-4bb2-a0d8-f985739d4667" width="180" alt="Pacing Belanja Harian" /> | <img src="https://github.com/user-attachments/assets/f2db707a-ef81-4f7b-813f-00b9b9892dde" width="180" alt="Detail Dompet" /> | <img src="https://github.com/user-attachments/assets/108ef6aa-aa00-4a4f-ac93-ffdb6fbb6c49" width="180" alt="Anggaran & Plafon" /> | <img src="https://github.com/user-attachments/assets/da8a39f2-b457-46fc-ba0a-636ea64dc7d1" width="180" alt="Transfer Antar Dompet" /> |

</div>

Aplikasi pencatatan dan monitoring keuangan personal (*personal finance monitoring*) berbasis mobile yang dibangun menggunakan **React Native** dan **Expo SDK 58**. Aplikasi ini dirancang untuk memudahkan pengguna dalam mencatat pemasukan dan pengeluaran harian, mengelola anggaran bulanan per kategori, serta menganalisis kondisi finansial melalui grafik visual interaktif.

---

## Badges

![React Native](https://img.shields.io/badge/React_Native-0.88.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo_SDK-58.0.0-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Expo Router](https://img.shields.io/badge/Routing-Expo_Router_v58-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-orange?style=for-the-badge)

---

## Fitur Utama

### 1. Dashboard Finansial Interaktif
* **Kartu Saldo Utama**: Menampilkan total saldo bersih dengan fitur *privacy toggle* (sembunyikan / tampilkan nominal saldo).
* **Arus Kas Bersih (*Net Cash Flow*)**: Indikator surplus kas dan persentase tabungan yang tersisa dari total pemasukan.
* **Widget Pacing Belanja Harian**: Rekomendasi belanja harian adaptif (sisa plafon dibagi sisa hari) atau mode kustom manual dengan batas harian tetap.
* **Filter Periode Cepat**: Navigasi filter instan untuk rentang waktu Hari Ini, Minggu Ini, Bulan Ini, dan Semua Periode.
* **Visual Alokasi Kas**: Diagram arus saldo dari Dompet Utama ke pos-pos teralokasi hingga kas bebas.
* **Transaksi Terbaru**: Daftar riwayat transaksi terakhir yang dapat diakses langsung dari beranda.
* **Akses Cepat (FAB)**: Tombol melayang (*Floating Action Button*) untuk pencatatan transaksi baru secara cepat.
* **Modal Panduan Pengguna**: Panduan ringkas alur kerja dompet bagi pengguna baru.

### 2. Pencatatan Transaksi (Income & Expense)
* Form pencatatan lengkap: nominal uang, tipe (Pemasukan / Pengeluaran), kategori dompet, tanggal transaksi, dan catatan keterangan.
* Input nominal interaktif dengan format pemisah ribuan otomatis (IDR Rupiah).
* Pemilihan tanggal fleksibel menggunakan `@react-native-community/datetimepicker`.
* Validasi form berbasis skema menggunakan **React Hook Form** dan **Zod**.

### 3. Transfer Antar Dompet (Pindah Saldo)
* Pemindahan alokasi saldo kas antar dompet kecil dengan aman tanpa mengubah total saldo fisik di Dompet Utama.
* Simulasi dampak kas *real-time* sebelum dan sesudah transfer untuk dompet sumber maupun dompet penerima.
* Tombol tukar posisi dompet (*swap*), tombol nominal instan (50k, 100k, 250k, 500k), dan opsi "Semua Saldo".
* Deteksi dan peringatan konfirmasi jika saldo dompet sumber kurang (menghindari saldo minus yang tidak disengaja).

### 4. Manajemen Anggaran Bulanan & Plafon Fleksibel (Budgeting)
* Menetapkan batas (*plafon*) belanja per kategori untuk setiap bulan, dengan fleksibilitas menghapus plafon atau menolkan (Rp 0 / Bebas).
* *Progress bar* visual yang membandingkan realisasi pengeluaran aktual terhadap target pagu anggaran.
* Indikator status anggaran real-time:
  * **Aman**: Pengeluaran masih di bawah 80% dari batas anggaran.
  * **Peringatan Kuota**: Pengeluaran telah mencapai atau melebihi 80% dari pagu anggaran.
  * **Plafon Terlampaui**: Pengeluaran telah melampaui 100% dari alokasi awal.

### 5. Notifikasi Pintar Lokal (Push Notifications)
* Ditenagai oleh `expo-notifications` dengan *channel* prioritas tinggi di Android (`AndroidImportance.MAX`).
* 4 pemicu notifikasi otomatis:
  * Peringatan kuota 80% saat belanja mendekati batas plafon.
  * Peringatan 100% saat pengeluaran melampaui plafon bulanan.
  * Peringatan saldo kas menipis (sisa $\le$ Rp 50.000 atau $\le$ 15% dari total dana masuk) dan peringatan saldo minus.
  * Peringatan belanja harian tinggi jika pengeluaran hari ini melebihi target pacing harian.
* Panel uji coba notifikasi instan langsung di tab Pengaturan.

### 6. Statistik & Visualisasi Finansial
* Visualisasi grafik tren pengeluaran mingguan dan bulanan menggunakan pustaka grafik interaktif.
* Pembagian (*breakdown*) pengeluaran per kategori beserta persentase kontribusinya.
* Analisis komparatif antara pemasukan dan pengeluaran untuk mengevaluasi kesehatan finansial.

### 7. Kustomisasi Kategori & Pengaturan Profil
* Manajemen kategori mandiri: Tambah pos dompet baru, edit nama kategori, serta hapus kategori.
* Pemilihan ikon visual dari koleksi pustaka **Ionicons**.
* Kustomisasi nama profil pengguna (*user profile*) yang tersimpan persisten di *storage*.
* Pengaturan mode pacing belanja harian (Otomatis vs Kustom).

---

## Teknologi & Dependensi

| Kategori | Teknologi / Pustaka | Versi | Fungsi |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React Native | 0.88.1 | Fondasi pengembangan aplikasi mobile multi-platform |
| **Platform Tooling**| Expo SDK | ~58.0.20 | Toolchain, runtime, dan ekosistem build native |
| **Bahasa** | TypeScript | ~6.0.3 | Pengetikan statis untuk keandalan kode |
| **Routing / Navigasi** | Expo Router | ~58.0.28 | Navigasi berbasis struktur berkas (*file-based routing*) |
| **Form & Validasi** | React Hook Form & Zod | ^7.89 / ^4.6 | Manajemen state form dan validasi skema data |
| **Push Notifications** | Expo Notifications | ~58.1.7 | Peringatan lokal kuota anggaran dan saldo |
| **HTTP Client** | Axios | ^1.20.0 | Komunikasi data dengan REST API backend |
| **Visualisasi Data** | React Native Gifted Charts | ^1.4.81 | Render grafik batang dan tren pengeluaran |
| **Date Time Picker** | @react-native-community/datetimepicker | 9.2.1 | Komponen native pemilih tanggal dan waktu |
| **Komponen UI** | Expo Vector Icons (Ionicons) | ^15.1.1 | Pustaka ikonografi antarmuka |
| **SafeArea & Gesture**| React Native Safe Area Context & Gesture Handler | Terintegrasi | Penanganan area aman layar dan interaksi gestur |

---

## Struktur Direktori

```text
mobile-app/
├── assets/                  # Aset gambar, splash screen, dan ikon aplikasi
│   └── images/
├── scripts/                 # Skrip utilitas proyek
├── src/
│   ├── app/                 # Routing aplikasi (Expo Router)
│   │   ├── (tabs)/          # Halaman navigasi bawah (Bottom Tabs)
│   │   │   ├── _layout.tsx  # Konfigurasi tab navigator & tab icons
│   │   │   ├── index.tsx    # Halaman Dashboard / Beranda
│   │   │   ├── transactions.tsx # Halaman Riwayat Transaksi
│   │   │   ├── budget.tsx   # Halaman Anggaran Bulanan
│   │   │   ├── statistics.tsx   # Halaman Statistik & Grafik
│   │   │   └── settings.tsx # Halaman Pengaturan & Kategori
│   │   ├── _layout.tsx      # Root Stack Navigator & status bar setup
│   │   ├── category-detail.tsx  # Detail transaksi per kategori
│   │   ├── transaction-form.tsx # Modal form tambah & ubah transaksi
│   │   └── transfer.tsx     # Modal transfer saldo antar dompet
│   ├── components/          # Komponen UI modular
│   │   ├── ui/
│   │   │   └── common.tsx   # Komponen atomik: Button, Chip, Fab, State Views
│   │   ├── transaction-item.tsx # Komponen kartu transaksi
│   │   ├── weekly-trend.tsx # Komponen grafik pengeluaran mingguan
│   │   ├── themed-text.tsx  # Teks konsisten dengan sistem tema
│   │   └── themed-view.tsx  # Kontainer konsisten dengan sistem tema
│   ├── constants/           # Konstanta aplikasi
│   ├── hooks/               # Custom hooks React
│   ├── schemas/             # Skema validasi Zod (transaksi & anggaran)
│   │   ├── budget.schema.ts
│   │   └── transaction.schema.ts
│   ├── services/            # Integrasi REST API & Local State
│   │   ├── api.ts           # Konfigurasi instance Axios & Base URL
│   │   ├── budget.service.ts
│   │   ├── category.service.ts
│   │   ├── notification.service.ts # Manajemen notifikasi cerdas lokal
│   │   ├── pacing.service.ts       # Manajemen target pacing harian
│   │   ├── profile.service.ts
│   │   ├── statistics.service.ts
│   │   └── transaction.service.ts
│   ├── theme/               # Design token: warna, radius, spasi, shadow
│   │   └── index.ts
│   └── utils/               # Fungsi format rupiah, tanggal, dan polyfill
│       ├── format.ts
│       └── zod-compat.ts
├── app.json                 # Konfigurasi proyek Expo & Project ID
├── eas.json                 # Konfigurasi build APK standalone
├── package.json             # Dependensi dan skrip proyek
└── tsconfig.json            # Konfigurasi TypeScript
```

---

## Prasyarat Sistem

Sebelum menjalankan aplikasi, pastikan sistem komputer Anda telah terinstal:

1. **Node.js**: Versi 18.x atau lebih baru ([Unduh Node.js](https://nodejs.org/)).
2. **Package Manager**: `npm`, `yarn`, atau `bun`.
3. **Expo Go** (pada ponsel fisik Android/iOS) atau emulator:
   * **Android**: Android Studio dengan Android Virtual Device (AVD).
   * **iOS**: Xcode (khusus macOS) dengan iOS Simulator.

---

## Skrip yang Tersedia

Daftar perintah yang dapat dijalankan melalui terminal:

| Perintah | Deskripsi |
| :--- | :--- |
| `npm start` atau `npx expo start` | Menjalankan bundler Expo development server |
| `npm run android` | Menjalankan aplikasi langsung ke Android Emulator |
| `npm run ios` | Menjalankan aplikasi langsung ke iOS Simulator |
| `npm run web` | Menjalankan aplikasi versi web di browser |
| `npm run lint` | Menjalankan ESLint untuk mengecek kualitas dan gaya penulisan kode |
| `npx tsc --noEmit` | Menjalankan validasi pengetikan TypeScript |

---

## Membangun Berkas Aplikasi (EAS Build APK)

Untuk menghasilkan berkas instalasi mandiri seperti file **APK** (Android) tanpa memerlukan Expo Go, gunakan **EAS CLI**:

### 1. Login ke Akun Expo

```bash
npx eas-cli login
```

### 2. Buat Berkas APK Preview (Android)

```bash
npx eas-cli build -p android --profile preview
```

Setelah proses *cloud build* selesai, tautan dan kode QR untuk mengunduh berkas APK siap pakai akan tersedia di terminal dan dasbor Expo Anda.

---

## Standar Desain & Pengalaman Pengguna (UX)

* **Palet Warna Harmonis**: Menggunakan warna primer *Navy* (`#0A1C4A` dan `#13317F`), aksen *Sky Blue* (`#2F6FE4`), hijau *Emerald* untuk pemasukan (`#0E9F6E`), serta merah *Crimson* untuk pengeluaran (`#D6455D`).
* **Format Mata Uang Konsisten**: Seluruh nilai numerik diformat ke standar Rupiah Indonesia (`Rp xx.xxx.xxx`) secara terpusat melalui fungsi utilitas `formatRupiah()`.
* **State Management yang Lengkap**: Setiap komponen yang mengambil data dari server dilengkapi penanganan 3 kondisi wajib:
  * **Loading State**: Komponen *spinner* saat data sedang dimuat.
  * **Empty State**: Ilustrasi dan pesan ramah saat belum ada transaksi atau anggaran tercatat.
  * **Error State**: Tampilan keterangan kesalahan dan tombol coba lagi (*Retry*) saat koneksi terputus.

---

## Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE).

---

Dikembangkan sebagai bagian dari proyek portfolio dan pembelajaran aplikasi finansial personal.
