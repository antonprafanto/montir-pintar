import { GoogleGenAI, Type } from "@google/genai";

export interface ComponentHistory {
  nama_komponen: string;
  estimasi_usia_pakai_km?: number | null;
  estimasi_usia_pakai_bulan?: number | null;
  estimasi_biaya?: number | null;
}

export interface RideCheckResult {
  analisis_gambar: {
    jenis_gambar: "odometer" | "nota_bengkel" | "keduanya" | "tidak_terdeteksi";
    jarak_tempuh_terbaca?: number | null;
    tanggal_terbaca?: string | null;
    total_biaya_terbaca?: number | null;
  };
  riwayat_komponen?: ComponentHistory[] | null;
  status_kendaraan: "Aman" | "Perlu Servis Ringan" | "Perlu Servis Berat";
  rekomendasi_tindakan: string[];
  estimasi_biaya_perbaikan: string;
  pesan_user_friendly: string;
}

export interface ManualHistory {
  jenis_kendaraan?: string;
  merek_kendaraan?: string;
  tanggal_servis: string;
  jarak_tempuh: string;
  komponen_diganti: string;
  keluhan?: string;
}

function getAIClient(): GoogleGenAI {
  // @ts-ignore
  const envObj = typeof window !== 'undefined' && window.process && window.process.env ? window.process.env : process.env;
  let key = envObj.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  key = key.replace(/^["']|["']$/g, '').trim();
  return new GoogleGenAI({ apiKey: key });
}

const SYSTEM_INSTRUCTION = `Kamu adalah "Mang AI", mekanik asisten virtual yang asyik, santai, tapi ahli dari "Montir Pintar". 

[Konteks & Persona]
Kamu adalah AI yang berperan sebagai teman yang pinter mesin. Gaya bahasamumu santai, empatik, menggunakan Bahasa Indonesia gaul (seperti "Bos", "Bro", "Sabi", "Aman", dsb) HANYA di bagian \`pesan_user_friendly\`. Untuk \`rekomendasi_tindakan\`, tetap profesional agar mudah dibaca sekilas. Sistem ini dirancang untuk menyederhanakan pemeliharaan kendaraan, dikembangkan sebagai asisten jujur yang bikin users nggak gampang ditipu bengkel nakal.

🌟 KEUNIKAN PERSONA (DYNAMIC JOKE/ROAST):
Di dalam \`pesan_user_friendly\`, kamu WAJIB menyesuaikan gaya candaan dengan merek/jenis kendaraan pengguna jika diketahui.
- Contoh: Jika Honda Beat/Vario/Aerox (panggil "Ngabers", singgung soal "knalpot mberrr" atau "ban cacing"). Jika Vespa Matic (singgung "anak senja", "ngabisin gajian buat servis CVT", "gredek"). Jika Pajero/Fortuner (panggil "Bos Pejabat", singgung "lampu strobo", "arogan di jalan"). Jika Innova/Avanza (singgung "mobil tempur keluarga", "kacang goreng"). Jika LCGC/Agya/Brio (singgung "pejuang cicilan", "irit bbm").
- Buat pengguna merasa personal dan terhibur!

[Tujuan Utama]
Tugasmu adalah menganalisis gambar atau input/keluhan manual pengguna. Ekstrak datanya dengan teliti, dan bangun rekomendasi perawatan berdasarkan jarak tempuh, jenis kendaraan, dan keluhan yang ada.

[Instruksi Analisis Gambar & Teks]
Pengguna akan mengunggah gambar ATAU memberikan input form. Kamu harus:

1. IDENTIFIKASI GAMBAR (JIKA ADA):
   - Periksa dengan teliti elemen "Odometer/Speedometer" (angka km/odo total).
   - Periksa elemen "Nota/Struk/Faktur Bengkel".
   - Tentukan \`jenis_gambar\` (odometer, nota_bengkel, keduanya, atau tidak_terdeteksi).

2. JIKA TERDAPAT ODOMETER / NOTA BENGKEL:
   - Hitung selisih jarak tempuh dari riwayat servis sebelumnya.
   - Prediksi komponen apa yang membutuhkan pengecekan/penggantian.
   - Catat suku cadang yang diganti dan estimasikan sisa umurnya.

3. ADAPTASI JENIS KENDARAAN (SANGAT PENTING):
   - Sesuaikan interval perawatan berdasarkan Jenis Kendaraan & Merek.

4. ANALISIS KELUHAN (COMPLAINTS):
   - Jika pengguna menyertakan "Keluhan", kamu WAJIB menganalisis akar masalahnya.
   - Jadikan keluhan ini fokus utama perbaikan dalam \`rekomendasi_tindakan\`.
   - Di bagian \`pesan_user_friendly\`, berikan kesan berempati (contoh: "Wah, suara kasar tuh biasanya CVT-nya minta dibelai Bos...").

6. ESTIMASI BIAYA (ANTI-GETOK HARGA):
   - Isi field \`estimasi_biaya_perbaikan\` dengan rentang harga kasar dalam Rupiah untuk total perbaikan/servis yang direkomendasikan.
   - Contoh: "Rp 150.000 - Rp 300.000 (Tergantung merk part & ongkos bengkel)"
   - Tujuannya agar pengguna punya gambaran harga dan JANGAN sampai ditipu (digetok harga) oleh bengkel nakal.

[Aturan Output]
Wajib merespon HANYA menggunakan format JSON valid sesuai skema yang diminta.`;

function base64ToGenerativePart(base64Data: string, mimeType: string) {
  return {
    inlineData: {
      data: base64Data.split(",")[1] ?? base64Data, // Remove the prefix if it exists
      mimeType
    },
  };
}

export async function analyzeVehicleImages(
  images: { data: string; mimeType: string }[],
  manualHistory?: ManualHistory
): Promise<RideCheckResult> {
  try {
    const parts: any[] = images.map((img) => base64ToGenerativePart(img.data, img.mimeType));
    
    let textPrompt = images.length > 0 ? "Tolong analisis gambar ini beserta data di bawah ini." : "Tolong analisis riwayat servis kendaraan ini berdasarkan input manual yang diberikan.";
    if (manualHistory && (manualHistory.tanggal_servis || manualHistory.jarak_tempuh || manualHistory.komponen_diganti || manualHistory.jenis_kendaraan || manualHistory.merek_kendaraan || manualHistory.keluhan)) {
      textPrompt += `\n\nBerikut adalah data riwayat servis manual dan keluhan yang dimasukkan pengguna sebagai informasi tambahan:\n`;
      if (manualHistory.jenis_kendaraan) textPrompt += `- Jenis Kendaraan: ${manualHistory.jenis_kendaraan}\n`;
      if (manualHistory.merek_kendaraan) textPrompt += `- Merek & Model: ${manualHistory.merek_kendaraan}\n`;
      if (manualHistory.tanggal_servis) textPrompt += `- Tanggal Servis Terakhir: ${manualHistory.tanggal_servis}\n`;
      if (manualHistory.jarak_tempuh) textPrompt += `- Jarak Tempuh Saat Servis: ${manualHistory.jarak_tempuh} km\n`;
      if (manualHistory.komponen_diganti) textPrompt += `- Komponen yang Diganti: ${manualHistory.komponen_diganti}\n`;
      if (manualHistory.keluhan) textPrompt += `- Keluhan Spesifik Pengguna: ${manualHistory.keluhan}\n`;
    }

    parts.push({
      text: textPrompt
    });

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analisis_gambar: {
            type: Type.OBJECT,
            properties: {
                jenis_gambar: {
                type: Type.STRING,
                description: "Must be one of: odometer, nota_bengkel, keduanya, tidak_terdeteksi"
                },
                jarak_tempuh_terbaca: {
                type: Type.NUMBER,
                description: "Extracted mileage in km. Null if not detected."
                },
                tanggal_terbaca: {
                type: Type.STRING,
                description: "YYYY-MM-DD pattern. Null if not detected."
                },
                total_biaya_terbaca: {
                type: Type.NUMBER,
                description: "Total biaya dari nota bengkel jika ada. Angka tanpa ribuan (contoh: 150000). Null jika tidak ada."
                }
            },
            required: ["jenis_gambar"]
            },
            riwayat_komponen: {
            type: Type.ARRAY,
            description: "Daftar komponen yang diganti (jika nota) atau perlu dicek (jika prediksi)",
            items: {
                type: Type.OBJECT,
                properties: {
                nama_komponen: { type: Type.STRING },
                estimasi_usia_pakai_km: { type: Type.NUMBER },
                estimasi_usia_pakai_bulan: { type: Type.NUMBER },
                estimasi_biaya: { 
                    type: Type.NUMBER,
                    description: "Estimasi biaya/harga komponen dalam Rupiah (contoh: 50000)."
                }
                },
                required: ["nama_komponen"]
            }
            },
            status_kendaraan: {
            type: Type.STRING,
            description: "Must be one of: Aman, Perlu Servis Ringan, Perlu Servis Berat"
            },
            rekomendasi_tindakan: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING
            }
            },
            estimasi_biaya_perbaikan: {
            type: Type.STRING
            },
            pesan_user_friendly: {
            type: Type.STRING
            }
        },
        required: ["analisis_gambar", "status_kendaraan", "rekomendasi_tindakan", "estimasi_biaya_perbaikan", "pesan_user_friendly"]
    };

    let response;
    try {
      response = await getAIClient().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema
        }
      });
    } catch (primaryError: any) {
      console.warn("Primary model failed, attempting fallback...", primaryError);
      response = await getAIClient().models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema
        }
      });
    }

    if (response.text) {
        return JSON.parse(response.text) as RideCheckResult;
    }
    
    throw new Error('Empty response from model');
  } catch (error: any) {
    console.error("Error calling backend API:", error);
    let errorMsg = error.message;
    if (typeof errorMsg === 'string' && (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("400"))) {
      throw new Error("API Key tidak valid! Jika Anda baru saja mengubahnya di menu Secrets AI Studio, coba muat ulang (refresh) halaman. Jika Anda men-deploy (Publish) aplikasi ini ke Cloud Run, pastikan Anda sudah memasukkan nilai `GEMINI_API_KEY` dengan benar pada saat proses deploy atau di pengaturan Secrets platform bersangkutan.");
    }
    throw error;
  }
}
