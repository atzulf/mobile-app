# Catetan Duit - Frontend Mobile App

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
* **Filter Periode Cepat**: Navigasi filter instan untuk rentang waktu Hari Ini, Minggu Ini, Bulan Ini, dan Semua Periode.
* **Ringkasan Arus Kas**: Kartu statistik total pemasukan (*income*) dan total pengeluaran (*expense*) pada periode aktif.
* **Mini Budget Overview**: Pratinjau langsung kondisi pagu anggaran bulanan beserta indikator persentase pemakaian.
* **Transaksi Terbaru**: Daftar riwayat transaksi terakhir yang dapat diakses langsung dari beranda.
* **Akses Cepat (FAB)**: Tombol melayang (*Floating Action Button*) untuk pencatatan transaksi baru secara cepat.
* **Modal Panduan Pengguna**: Panduan ringkas penggunaan aplikasi bagi pengguna baru.

### 2. Pencatatan Transaksi (Income & Expense)
* Form pencatatan lengkap: nominal uang, tipe (Pemasukan / Pengeluaran), kategori, tanggal transaksi, dan catatan keterangan.
* Input nominal interaktif dengan format pemisah ribuan otomatis (IDR Rupiah).
* Pemilihan tanggal fleksibel menggunakan `@react-native-community/datetimepicker`.
* Validasi form berbasis skema menggunakan **React Hook Form** dan **Zod**.

### 3. Riwayat & Filter Transaksi
* Pencarian transaksi secara *real-time* berdasarkan keterangan atau nama kategori.
* Tab penyaringan tipe transaksi: Semua, Pemasukan, atau Pengeluaran.
* Filter transaksi berdasarkan kategori spesifik.
* Pengelompokan data transaksi berdasarkan tanggal secara kronologis.
* Fitur untuk mengubah (*edit*) maupun menghapus (*delete*) data transaksi yang sudah tercatat.

### 4. Manajemen Anggaran Bulanan (Budgeting)
* Menetapkan batas (*limit*) anggaran belanja per kategori untuk setiap bulan.
* *Progress bar* visual yang membandingkan realisasi pengeluaran aktual terhadap pagu anggaran.
* Indikator status anggaran real-time:
  * **Aman**: Pengeluaran masih di bawah 80% dari batas anggaran.
  * **Peringatan**: Pengeluaran telah mencapai atau melebihi 80% dari batas anggaran.
  * **Overbudget**: Pengeluaran telah melampaui 100% dari alokasi anggaran.

### 5. Statistik & Visualisasi Finansial
* Visualisasi grafik tren pengeluaran mingguan dan bulanan menggunakan pustaka grafik interaktif.
* Pembagian (*breakdown*) pengeluaran per kategori beserta persentase kontribusinya.
* Analisis komparatif antara pemasukan dan pengeluaran untuk mengevaluasi kesehatan finansial.

### 6. Kustomisasi Kategori & Pengaturan Profil
* Manajemen kategori mandiri: Tambah kategori baru, edit nama kategori, serta hapus kategori.
* Pemilihan ikon kategori visual dari pustaka **Ionicons**.
* Kustomisasi nama panggilan pengguna (*user profile*) yang disimpan di *local storage*.
* Status konektivitas server dan informasi versi aplikasi.

---

## Teknologi & Dependensi

| Kategori | Teknologi / Pustaka | Versi | Fungsi |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React Native | 0.88.0 | Fondasi pengembangan aplikasi mobile multi-platform |
| **Platform Tooling**| Expo SDK | ~58.0.0 | Toolchain, runtime, dan ekosistem build native |
| **Bahasa** | TypeScript | ~6.0.3 | Pengetikan statis untuk keandalan kode |
| **Routing / Navigasi** | Expo Router | ~58.0.26 | Navigasi berbasis struktur berkas (*file-based routing*) |
| **Form & Validasi** | React Hook Form & Zod | ^7.89 / ^3.23 | Manajemen state form dan validasi skema data |
| **HTTP Client** | Axios | ^1.20.0 | Komunikasi data dengan REST API backend |
| **Visualisasi Data** | React Native Gifted Charts | ^1.4.81 | Render grafik batang dan tren pengeluaran |
| **Date Time Picker** | @react-native-community/datetimepicker | 9.2.1 | Komponen native pemilih tanggal dan waktu |
| **Komponen UI** | Expo Vector Icons (Ionicons) | ^15.1.1 | Pustaka ikonografi antarmuka |
| **Efek Visual** | Expo Linear Gradient & Glass Effect | ~58.0.3 | Gradient styling dan visual elevation |
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
│   │   └── transaction-form.tsx # Modal form tambah & ubah transaksi
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
│   ├── services/            # Integrasi REST API (Axios client)
│   │   ├── api.ts           # Konfigurasi instance Axios & Base URL
│   │   ├── budget.service.ts
│   │   ├── category.service.ts
│   │   ├── profile.service.ts
│   │   ├── statistics.service.ts
│   │   └── transaction.service.ts
│   ├── theme/               # Design token: warna, radius, spasi, shadow
│   │   └── index.ts
│   └── utils/               # Fungsi utilitas format rupiah, tanggal, rentang periode
│       └── format.ts
├── app.json                 # Konfigurasi proyek Expo
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
| `npx expo-doctor` | Mendiagnosis integritas dependensi dan konfigurasi Expo |

---

## Membangun Berkas Aplikasi (EAS Build)

Untuk menghasilkan berkas instalasi mandiri (*standalone build*) seperti file **APK** (Android) tanpa memerlukan Expo Go, gunakan **EAS CLI**:

### 1. Pasang EAS CLI secara global

```bash
npm install -g eas-cli
```

### 2. Login ke Akun Expo

```bash
eas login
```

### 3. Buat Berkas APK Preview (Android)

```bash
eas build --platform android --profile preview
```

Setelah proses *cloud build* selesai, tautan untuk mengunduh berkas APK siap pakai akan tersedia di terminal dan dasbor Expo Anda.

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
