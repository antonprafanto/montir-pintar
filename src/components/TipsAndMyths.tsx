import React, { useState, useEffect } from 'react';
import { Lightbulb, Info, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';

const TIPS_DATA = [
  { type: "mitos", title: "Panasin Mesin Harus Lama", content: "Mesin injeksi modern tidak perlu dipanaskan lama-lama. Cukup 30 detik - 1 menit agar sirkulasi oli naik, lalu jalan perlahan.", source: "Buku Manual Pabrikan Kendaraan Modern" },
  { type: "fakta", title: "Tekanan Ban Menghemat BBM", content: "Tekanan ban yang sesuai anjuran pabrik bisa menghemat konsumsi bahan bakar hingga 3%. Cek minimal dua minggu sekali!", source: "U.S. Department of Energy (DOE)" },
  { type: "tips", title: "Cuci Motor Setelah Hujan", content: "Segera bilas kendaraan setelah terkena hujan. Air hujan mengandung asam yang dapat menyebabkan karat dan kusam pada cat kendaraan.", source: "Praktik Ahli Perawatan Bodi Kendaraan" },
  { type: "mitos", title: "Oli Sintetis Bikin Mesin Cepat Rusak", content: "Justru oli sintetis memberikan perlindungan lebih baik pada suhu ekstrem dan membuat ruang bakar lebih bersih dibanding oli mineral.", source: "American Petroleum Institute (API)" },
  { type: "fakta", title: "Filter Udara Kotor Bikin Boros", content: "Filter udara yang buntu bikin campuran udara gak ideal. Hasilnya? Tarikan berat dan bensin terbuang sia-sia.", source: "Mekanik Ahli & Panduan Servis Berkala" },
  { type: "tips", title: "Jangan Pakai Air Kran untuk Radiator", content: "Selalu gunakan coolant khusus. Air kran mengandung mineral yang bisa menimbulkan karat dan penyumbatan pada jalur pendingin mesin.", source: "Pedoman Sistem Pendingin Mesin" },
  { type: "mitos", title: "Turunan Pakai Gigi Netral = Hemat BBM", content: "Salah besar! Kendaraan injeksi modern memutus semprotan bensin saat deselerasi masuk gigi (engine brake). Netral malah tetap konsumsi bensin untuk stationer idle.", source: "Riset Efisiensi Kendaraan & Pabrikan" },
  { type: "fakta", title: "Busi Aus Bikin Tarikan Loyo", content: "Busi yang jarak elektrodanya sudah terlalu renggang atau kotor bikin pembakaran gak maksimal, tarikan tertahan, dan makin boros BBM.", source: "Panduan Teknisi Sistem Injeksi & Pengapian" },
  { type: "tips", title: "Ganti Minyak Rem Tiap 2 Tahun", content: "Minyak rem menyerap embun air seiring waktu. Kalau kelamaan, titik didih minyak rem bakal turun jadi gampang mendidih saat kerja berat (rawan blong).", source: "Standar Keamanan Pengereman DOT" },
  { type: "mitos", title: "Isi Bensin Oktan Tinggi Pasti Kencang", content: "Mitos! Tenaga mesin didesain sesuai rasio kompresi pabriknya. Jika rasio kompresi rendah (misal 9:1), mesin malah lebih susah membakar oktan 98 sampe tuntas.", source: "Jurnal Teknik Otomotif" },
  { type: "fakta", title: "Gaya Berkendara Agresif Bikin Cepat Aus", content: "Sering akselerasi mendadak dan pengereman keras (stop & go agresif) bakal bikin kampas rem, v-belt/kopling, dan ban 2x lebih cepat botak.", source: "Panduan Keselamatan dan Ecodriving" },
  { type: "tips", title: "Jangan Abaikan Indikator Engine Check", content: "Kalau lampu indikator check engine menyala terus saat kendaraan jalan, segera periksa dengan scanner OBD. Ada masalah pada sistem injeksi atau sensor gas buang.", source: "Sistem Diagnostik On-Board (OBD) Standar" },
  { type: "mitos", title: "Ban Ada 'Kadaluarsa' 5 Tahun Pasti Meledak", content: "Walau tidak meledak, namun kompon karet ban makin mengeras setelah beberapa tahun produksi, membuat jarak pengereman lebih panjang dan traksi menurun signifikan meskipun kembangannya tebal.", source: "Asosiasi Produsen Ban Internasional" },
  { type: "tips", title: "Ganti Oli: Bulan atau Jarak?", content: "Oli bisa rusak karena waktu (oksidasi) meski kendaraan jarang dipakai. Patokannya: 3-4 bulan atau 3.000-4.000 km, mana yang tercapai lebih dulu.", source: "Standar Perawatan Mesin & Pelumas Motor" },
  { type: "mitos", title: "Ganti Kampas Rem Sampai Bunyi Terus", content: "Menunggu kampas rem bunyi berarti plat besi sudah saling bergesekan dengan cakram. Siap-siap keluar uang lebih banyak untuk mengganti piringan cakram yang baret!", source: "Standar Keselamatan Sistem Pengereman" },
  { type: "fakta", title: "Jarum Bensin di Bawah Terus Bikin Pompa Rusak", content: "Pompa bahan bakar di dalam tangki didinginkan oleh rendaman bensin. Sering pakai bensin mepet 'E' bisa bikin pompa / fuel pump panas dan cepat putus (rusak).", source: "Panduan Teknis Sistem Bahan Bakar Injeksi" },
  { type: "tips", title: "Kurangi Beban Tidak Perlu di Bagasi", content: "Makin berat beban kendaraan, makin keras kerja mesin. Dampaknya sudah pasti bahan bakar menjadi lebih boros.", source: "Lembaga Perlindungan Lingkungan (EPA) Efisiensi BBM" },
  { type: "mitos", title: "Copot Thermostat Bikin Mesin Adem", content: "Salah! Thermostat yang dilepas membuat mesin sulit mencapai suhu kerja optimal, akibatnya mesin boros bahan bakar dan tenaga ngempos.", source: "Prinsip Dasar Termodinamika Mesin" },
  { type: "fakta", title: "Oli Shock Depan Juga Harus Diganti", content: "Oli shockbreaker depan lama-lama bisa keruh dan kehilangan fungsi redamannya. Disarankan menggantinya setiap 1-2 tahun sekali (15.000-20.000 KM) agar bantingan selalu nyaman.", source: "Servis Rutin Suspensi Kendaraan" },
  { type: "tips", title: "Bilas Kampas Rem Setelah Lewat Genangan Hujan", content: "Pasir halus dari genangan lumpur sangat gampang menempel dan mengering di cakram. Mengakibatkan bunyi decit dan membuat kampas rem lebih cepat aus.", source: "Buku Panduan Perawatan Pengereman Dasar" },
  { type: "mitos", title: "Campur Bensin Oktan Rendah & Tinggi Biar Mura + Awet", content: "Mitos yang menyesatkan. Formula aditif keduanya malah bisa rusak dan justru mempercepat tumpukan kerak karbon tebal di ruang bakar.", source: "Ahli Kimia Bahan Bakar Mesin" },
  { type: "fakta", title: "Rutin Periksa Celah Klep", content: "Celah klep (valve clearance) yang terlalu rapat menyebabkan kompresi panas/bocor. Bila terlalu longgar, tarikan pelan dan mesin bakal berisik seperti mesin jahit.", source: "Standar Operasional Prosedur (SOP) Servis Mesin" },
  { type: "tips", title: "Gunakan Aki Sesuai Ampere Bawaan", content: "Mengganti aki dengan spek ampere yang terlalu kecil membuat kelistrikan soak. Ampere terlampau besar akan membebani sepul atau stator saat mengisi ulang daya.", source: "Buku Panduan Teknis Kelistrikan Kendaraan" },
  { type: "fakta", title: "Buka Tutup Radiator Panas? Jangan Pernah!", content: "Sistem pendingin panas punya tekanan sirkulasi tinggi. Saat tutup dibuka paksa, air coolant bisa langsung mendidih naik dan menyembur hebat!", source: "Instruksi Keamanan Keselamatan Kerja (K3) Otomotif" },
  { type: "mitos", title: "Cuci Mesin Bikin Kabel Cepat Korslet", content: "Asal komponen listrik vital (ECU, rumah sekring, koil, sambungan soket) sudah terlindung/diperhatikan, disemprot air lumayan aman. Cuci mesin membantu identifikasi oli rembes dengan mudah.", source: "SOP Auto Detailing & Salon Mobil" }
];

export default function TipsAndMyths() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(Math.floor(Math.random() * TIPS_DATA.length));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TIPS_DATA.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % TIPS_DATA.length);
  };

  const currentItem = TIPS_DATA[currentIndex];

  const getStyle = (type: string) => {
    switch (type) {
      case 'mitos': return { bg: 'bg-[#FFDE59]', textColor: 'text-black', label: 'MITOS' };
      case 'fakta': return { bg: 'bg-[#00FC73]', textColor: 'text-black', label: 'FAKTA' };
      case 'tips': return { bg: 'bg-[#FF90E8]', textColor: 'text-black', label: 'TIPS' };
      default: return { bg: 'bg-white', textColor: 'text-black', label: 'INFO' };
    }
  };

  const style = getStyle(currentItem?.type || '');

  if (!currentItem) return null;

  return (
    <div className={`mt-8 border-4 neo-border rounded-xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 neo-shadow transition-colors duration-500 relative overflow-hidden group ${style.bg} ${style.textColor}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-shrink-0">
            {currentItem.type === 'tips' && <Lightbulb className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />}
            {currentItem.type === 'fakta' && <Info className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />}
            {currentItem.type === 'mitos' && <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />}
          </div>
          <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 border-2 border-black rounded-full bg-white text-black mt-0.5">
            {style.label}
          </span>
        </div>
        
        <button 
          onClick={handleNext}
          className="w-8 h-8 md:w-10 md:h-10 border-2 border-black rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform flex-shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)]"
          aria-label="Next tip"
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
        </button>
      </div>

      <div>
        <h3 className="font-black text-base sm:text-lg lg:text-xl tracking-wide leading-tight">
          {currentItem.title}
        </h3>
        <p className="font-medium text-sm sm:text-base lg:text-lg mt-2 leading-relaxed">
          {currentItem.content}
        </p>
        
        {currentItem.source && (
          <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
            <span className="font-black text-[10px] sm:text-xs bg-black/10 px-1.5 py-0.5 rounded-sm">SUMBER</span>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(currentItem.source + ' ' + currentItem.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] sm:text-xs font-bold truncate leading-tight hover:underline flex items-center gap-1 group/link"
              title="Cari sumber ini di Google"
            >
              <span className="truncate">{currentItem.source}</span>
              <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100 flex-shrink-0" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
