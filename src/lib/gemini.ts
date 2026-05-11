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

export async function analyzeVehicleImages(
  images: { data: string; mimeType: string }[],
  manualHistory?: ManualHistory
): Promise<RideCheckResult> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images, manualHistory }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error calling backend API:", error);
    throw error;
  }
}

