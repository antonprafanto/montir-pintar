import React, { useState, useRef, useEffect, ChangeEvent, useMemo } from "react";
import { UploadCloud, FileImage, X, Activity, Wrench, ShieldCheck, AlertTriangle, Info, CalendarClock, Moon, Sun, Camera, Droplet, Circle, Disc, Search, CheckCircle2, TrendingUp, History, Trash2, ChevronRight, Car, Plus, ChevronDown, ChevronUp, Eraser, RotateCcw, Download, Bell, Printer, Calendar as CalendarIcon, DollarSign, Bot, Zap, Sparkles, Mic, Volume2 } from "lucide-react";
import { analyzeVehicleImages, RideCheckResult } from "./lib/gemini";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NearbyGarages } from "./components/NearbyGarages";
import TipsAndMyths from "./components/TipsAndMyths";

export const downloadICS = (title: string, description: string, targetDate: Date) => {
  const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
  const start = formatDate(targetDate);
  const endDate = new Date(targetDate.getTime() + 60 * 60 * 1000);
  const end = formatDate(endDate);
  
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Montir Pintar//Servis Pengingat//ID\nBEGIN:VEVENT\nUID:${Date.now()}@montirpintar.app\nDTSTAMP:${start}\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${title}\nDESCRIPTION:${description}\nBEGIN:VALARM\nTRIGGER:-P3D\nACTION:DISPLAY\nDESCRIPTION:Pengingat Servis (H-3)\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR`;

  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `servis-${title.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface VehicleProfile {
  id: string;
  name: string;
  jenis_kendaraan: string;
  merek_kendaraan: string;
}

export interface SavedRecord {
  id: string;
  date: string;
  vehicleId?: string;
  vehicleModel: string;
  result: RideCheckResult;
  manualHistoryInput?: {
    jenis_kendaraan: string;
    merek_kendaraan: string;
    tanggal_servis: string;
    jarak_tempuh: string;
    komponen_diganti: string;
    keluhan?: string;
  };
}

export default function App() {
  const [images, setImages] = useState<{ url: string; file: File; base64: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<RideCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [savedHistory, setSavedHistory] = useState<SavedRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  const [garage, setGarage] = useState<VehicleProfile[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [showGarageModal, setShowGarageModal] = useState(false);
  const [isManualHistoryOpen, setIsManualHistoryOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<VehicleProfile>>({
    jenis_kendaraan: 'Motor',
    name: '',
    merek_kendaraan: ''
  });
  const [historyFilterVehicleId, setHistoryFilterVehicleId] = useState<string>('');

  const [manualHistory, setManualHistory] = useState({
    jenis_kendaraan: 'Motor',
    merek_kendaraan: '',
    tanggal_servis: '',
    jarak_tempuh: '',
    komponen_diganti: '',
    keluhan: ''
  });

  const [isListening, setIsListening] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const loadingPhrases = [
    "Halo Bos! Mang AI lagi cek datanya... 👀",
    "Hmm, lagi dianalisa komponen mana yang udah aus... 🧐",
    "Mang AI lagi ngitung umur busi sama oli nih... 🧮",
    "Bentar ya Bosku, merangkum data biar gampang jelasin ke mekanik! 🤝",
    "Bentaran, lagi nulis catetannya... 📝"
  ];
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const hasUrgentNotification = useMemo(() => {
    if (garage.length === 0) return false;
    return garage.some(v => {
      const latestRecord = savedHistory.find(h => h.vehicleId === v.id);
      if (!latestRecord || !latestRecord.result.riwayat_komponen) return false;
      const validEstimates = latestRecord.result.riwayat_komponen
        .map(k => k.estimasi_usia_pakai_bulan)
        .filter(val => val && val > 0) as number[];
      if (validEstimates.length === 0) return false;
      const minMonths = Math.min(...validEstimates);
      const nextDate = new Date(latestRecord.date);
      nextDate.setMonth(nextDate.getMonth() + minMonths);
      const now = new Date();
      if (nextDate < now) return true;
      const diffMonths = (nextDate.getFullYear() - now.getFullYear()) * 12 + (nextDate.getMonth() - now.getMonth());
      return diffMonths <= 1;
    });
  }, [garage, savedHistory]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setLoadingPhraseIndex(prev => (prev + 1) % loadingPhrases.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.interimResults = true;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setManualHistory(prev => ({...prev, keluhan: transcript}));
      };
      recognition.onerror = (e: any) => {
        console.error(e);
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.start();
    } else {
      alert("Browser boss belum mendukung fitur suara nih (Gunakan Chrome/Safari terbaru yak).");
    }
  };

  const playMangAIVoice = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Browser boss belum mendukung fitur suara nih.");
      return;
    }

    if (isPlayingVoice) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }

    // Cancel any stuck utterances
    window.speechSynthesis.cancel();

    // Timer to detect if Speech API is blocked (common in iframes)
    const startTimeout = setTimeout(() => {
      setIsPlayingVoice(false);
      alert("Suaranya nggak mau keluar ya Bosku? Kadang fitur suara diblokir di mode preview ini. Coba klik 'Open in New Tab' (ikon panah keluar di atas) biar bisa ngomong Mang AI-nya!");
    }, 1500);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.pitch = 0.9;
    utterance.rate = 0.95;

    // Try setting an Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
    if (idVoice) utterance.voice = idVoice;

    utterance.onstart = () => {
      clearTimeout(startTimeout);
      setIsPlayingVoice(true);
    };

    utterance.onend = () => {
      setIsPlayingVoice(false);
    };

    utterance.onerror = (e) => {
      clearTimeout(startTimeout);
      console.error("SpeechSynthesis error", e);
      setIsPlayingVoice(false);
      if (e.error !== 'canceled') {
        alert("Aduh suara ngadat (Error: " + e.error + "). Coba buka web ini di tab baru (Open in New Tab) bosku, biasanya lancar!");
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      clearTimeout(startTimeout);
      console.error(err);
      setIsPlayingVoice(false);
      alert("Waduh, fitur suara lagi error nih bosku. Coba reload atau open di tab baru.");
    }
  };

  const handleReset = () => {
    setImages([]);
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearManualHistory = () => {
    setManualHistory({
      jenis_kendaraan: 'Motor',
      merek_kendaraan: '',
      tanggal_servis: '',
      jarak_tempuh: '',
      komponen_diganti: '',
      keluhan: ''
    });
    setActiveVehicleId(null);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const loadedHistory = localStorage.getItem('ridecheck_history');
    if (loadedHistory) {
      try {
        setSavedHistory(JSON.parse(loadedHistory));
      } catch {}
    }
    const loadedGarage = localStorage.getItem('ridecheck_garage');
    if (loadedGarage) {
      try {
        const parsedGarage = JSON.parse(loadedGarage);
        setGarage(parsedGarage);
      } catch {}
    }
  }, []);

  const handleVehicleSelect = (id: string) => {
    setActiveVehicleId(id || null);
    if (id) {
      const v = garage.find(g => g.id === id);
      if (v) {
        setManualHistory(prev => ({
          ...prev,
          jenis_kendaraan: v.jenis_kendaraan,
          merek_kendaraan: v.merek_kendaraan
        }));
      }
    } else {
      setManualHistory(prev => ({
        ...prev,
        jenis_kendaraan: 'Motor',
        merek_kendaraan: ''
      }));
    }
  };

  const handleAddVehicle = () => {
    if (!newVehicle.name || !newVehicle.merek_kendaraan) return;
    const vehicle: VehicleProfile = {
      id: Date.now().toString(),
      name: newVehicle.name,
      jenis_kendaraan: newVehicle.jenis_kendaraan || 'Motor',
      merek_kendaraan: newVehicle.merek_kendaraan
    };
    const updatedGarage = [...garage, vehicle];
    setGarage(updatedGarage);
    localStorage.setItem('ridecheck_garage', JSON.stringify(updatedGarage));
    setNewVehicle({ jenis_kendaraan: 'Motor', name: '', merek_kendaraan: '' });
    
    if (garage.length === 0 || !activeVehicleId) {
      handleVehicleSelect(vehicle.id);
    }
  };

  const handleDeleteVehicle = (id: string) => {
    const updatedGarage = garage.filter(v => v.id !== id);
    setGarage(updatedGarage);
    localStorage.setItem('ridecheck_garage', JSON.stringify(updatedGarage));
    if (activeVehicleId === id) {
      handleVehicleSelect('');
    }
  };

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedHistory.filter(h => h.id !== id);
    setSavedHistory(updated);
    localStorage.setItem('ridecheck_history', JSON.stringify(updated));
    if (updated.length === 0) setShowHistoryModal(false);
  };

  const loadHistoryItem = (record: SavedRecord) => {
    setResult(record.result);
    setImages([]); 
    if (record.vehicleId) {
      setActiveVehicleId(record.vehicleId);
    } else {
      setActiveVehicleId(null);
    }
    
    if (record.manualHistoryInput) {
      setManualHistory({ ...record.manualHistoryInput, keluhan: record.manualHistoryInput.keluhan || '' });
    } else {
      setManualHistory({
        jenis_kendaraan: 'Motor',
        merek_kendaraan: record.vehicleModel !== 'Kendaraan Tidak Diketahui' ? record.vehicleModel : '',
        tanggal_servis: '',
        jarak_tempuh: '',
        komponen_diganti: '',
        keluhan: ''
      });
    }
    setShowHistoryModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      for (const file of newFiles) {
        // Create an image element to read the dimensions
        const imgObj = new Image();
        imgObj.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = imgObj.width;
          let height = imgObj.height;

          // Compression logic
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(imgObj, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7); // 70% quality JPEG
            
            setImages((prev) => [
              ...prev,
              { url: URL.createObjectURL(file), file, base64: compressedBase64 },
            ]);
          }
        };
        imgObj.src = URL.createObjectURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (result) setResult(null); // Reset result if they change images
  };

  const handleAnalyze = async () => {
    if (images.length === 0 && !manualHistory.jarak_tempuh && !manualHistory.komponen_diganti && !manualHistory.tanggal_servis && !manualHistory.keluhan) {
      setError("Harap unggah gambar atau isi riwayat/keluhan secara manual.");
      return;
    }
    
    // Validation
    if (manualHistory.jarak_tempuh && Number(manualHistory.jarak_tempuh) < 0) {
      setError("Jarak tempuh tidak boleh bernilai negatif.");
      return;
    }
    if (manualHistory.tanggal_servis) {
      const selectedDate = new Date(manualHistory.tanggal_servis);
      const today = new Date();
      if (selectedDate > today) {
        setError("Tanggal servis tidak boleh di masa depan.");
        return;
      }
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const uploadPayload = images.map((img) => ({
        data: img.base64,
        mimeType: img.file.type || "image/jpeg",
      }));

      const analysisDetails = await analyzeVehicleImages(uploadPayload, manualHistory);
      setResult(analysisDetails);
      
      // Simpan otomatis ke riwayat
      const newRecord: SavedRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        vehicleId: activeVehicleId || undefined,
        vehicleModel: manualHistory.merek_kendaraan || manualHistory.jenis_kendaraan || 'Kendaraan Tidak Diketahui',
        result: analysisDetails,
        manualHistoryInput: manualHistory
      };
      
      const updatedHistory = [newRecord, ...savedHistory];
      setSavedHistory(updatedHistory);
      localStorage.setItem('ridecheck_history', JSON.stringify(updatedHistory));
      
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "Aman":
        return <ShieldCheck className="w-8 h-8 text-black" />;
      case "Perlu Servis Ringan":
        return <Info className="w-8 h-8 text-black" />;
      case "Perlu Servis Berat":
        return <AlertTriangle className="w-8 h-8 text-black" />;
      default:
        return <Activity className="w-8 h-8 text-black" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Aman":
        return "bg-[#00FC73] !bg-[#00FC73] text-black neo-box";
      case "Perlu Servis Ringan":
        return "bg-[#FFDE59] !bg-[#FFDE59] text-black neo-box";
      case "Perlu Servis Berat":
        return "bg-[#FF4444] !bg-[#FF4444] text-white neo-box";
      default:
        return "bg-surface-primary neo-text neo-box";
    }
  };

  const getRecommendationIcon = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("oli") || lowerText.includes("cairan")) return <Droplet className="w-5 h-5" />;
    if (lowerText.includes("ban")) return <Circle className="w-5 h-5" />;
    if (lowerText.includes("rem") || lowerText.includes("kampas")) return <Disc className="w-5 h-5" />;
    if (lowerText.includes("ganti") || lowerText.includes("perbaiki")) return <Wrench className="w-5 h-5" />;
    if (lowerText.includes("cek") || lowerText.includes("periksa")) return <Search className="w-5 h-5" />;
    return <CheckCircle2 className="w-5 h-5" />;
  };

  const chartData = useMemo(() => {
    // Collect all mileage data points for the active vehicle
    const historyPoints: { date: Date; distance: number }[] = [];
    
    // Add current result if available
    let latestDistance: number | null = null;
    if (result && result.analisis_gambar.jarak_tempuh_terbaca) {
      latestDistance = result.analisis_gambar.jarak_tempuh_terbaca;
      historyPoints.push({ date: new Date(), distance: latestDistance });
    }

    // Add historical records if they belong to active vehicle (or if no vehicle selected)
    const validHistory = activeVehicleId 
      ? savedHistory.filter(h => h.vehicleId === activeVehicleId)
      : savedHistory;

    validHistory.forEach(record => {
      const dist = record.result?.analisis_gambar?.jarak_tempuh_terbaca || Number(record.manualHistoryInput?.jarak_tempuh || 0);
      if (dist && dist > 0) {
        // Find existing to prevent current run duplication
        if (latestDistance && Math.abs(dist - latestDistance) < 5) return;
        historyPoints.push({ date: new Date(record.date), distance: dist });
      }
    });

    historyPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Deduplicate closely related points (same day)
    const data = [];
    const seen = new Set<string>();
    
    for (const pt of historyPoints) {
      const monthName = pt.date.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
      if (!seen.has(monthName)) {
        seen.add(monthName);
        data.push({
          bulan: monthName,
          jarak_tempuh: Math.round(pt.distance),
        });
      }
    }

    // If we only have 1 or 0 points, fallback to simulated history
    if (data.length <= 1 && latestDistance) {
        const simData = [];
        const today = new Date();
        let simulatedCurrent = latestDistance;
        for (let i = 0; i < 6; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthName = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
          simData.unshift({
            bulan: monthName,
            jarak_tempuh: simulatedCurrent,
          });
          simulatedCurrent -= Math.floor(Math.random() * 700 + 800);
          if (simulatedCurrent < 0) simulatedCurrent = 0;
        }
        return simData;
    }

    return data;
  }, [result, savedHistory, activeVehicleId]);

  const costChartData = useMemo(() => {
    const validHistory = activeVehicleId 
      ? savedHistory.filter(h => h.vehicleId === activeVehicleId)
      : savedHistory;

    const dataMap = new Map<string, number>();

    if (result && result.analisis_gambar.total_biaya_terbaca) {
      const d = new Date();
      const monthName = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
      dataMap.set(monthName, result.analisis_gambar.total_biaya_terbaca);
    }

    validHistory.forEach(record => {
      const cost = record.result?.analisis_gambar?.total_biaya_terbaca || 0;
      if (cost > 0) {
        const d = new Date(record.date);
        const monthName = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
        if (!dataMap.has(monthName)) {
           dataMap.set(monthName, cost);
        } else {
           // Accumulate if multiple services in the same month
           if (new Date(record.date).getTime() < new Date().getTime() - 86400000) {
              dataMap.set(monthName, dataMap.get(monthName)! + cost);
           }
        }
      }
    });

    const data = Array.from(dataMap.entries()).map(([bulan, total_biaya]) => ({
      bulan,
      total_biaya
    })).reverse(); // Oldest to newest assuming history was newest first
    
    // Reverse again because it was just object entries... wait, better sort
    // Actually we don't have exactly sorting here easily. Let's rely on validHistory which is sorted newest first. 
    // Wait, validHistory is newest first. The iteration sets newest first. To display left (oldest) to right (newest), we reverse it.

    return data;
  }, [result, savedHistory, activeVehicleId]);

  const filteredHistory = historyFilterVehicleId 
    ? savedHistory.filter(h => h.vehicleId === historyFilterVehicleId)
    : savedHistory;

  return (
    <div className="min-h-screen font-sans selection:bg-[#FF90E8] neo-text pb-20 sm:pb-24">
      <header className="bg-surface-header border-b-4 neo-border sticky top-0 z-50 neo-shadow transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#FFDE59] border-4 border-black flex items-center justify-center shadow-[4px_4px_0_0_rgba(0,0,0,1)] sm:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all cursor-pointer no-print flex-shrink-0 group">
              {/* Frame Content */}
              <div className="absolute inset-0 overflow-hidden rounded-xl border-2 border-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />
              </div>
              
              {/* Bot Character */}
              <Bot className="relative z-20 w-8 h-8 sm:w-10 sm:h-10 text-black fill-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300" strokeWidth={2.5} />
              
              {/* Wrench detail */}
              <Wrench className="absolute z-30 -bottom-2 -right-2 w-5 h-5 sm:w-7 sm:h-7 text-black fill-[#00FC73] origin-bottom-left group-hover:rotate-45 transition-transform duration-300 drop-shadow-md" strokeWidth={2.5} />
              
              {/* Sparkles effect */}
              <Sparkles className="absolute z-10 -top-3 -right-3 w-5 h-5 sm:w-6 sm:h-6 text-[#FF90E8] fill-[#FF90E8] opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight neo-text leading-none uppercase drop-shadow-sm flex items-center gap-1 sm:gap-2">
                Montir
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)]">Pintar</span>
                <span className="inline-block animate-bounce text-xl sm:text-2xl origin-bottom text-black">⚡</span>
              </h1>
              <p className="text-[10px] sm:text-xs font-black text-gray-500 tracking-widest uppercase no-print leading-snug mt-1">
                By Anton Prafanto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 no-print">
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex px-4 h-12 rounded-full border-4 neo-border bg-[#FFDE59] !bg-[#FFDE59] text-black font-black items-center justify-center neo-shadow hover:scale-105 transition-transform gap-2"
              >
                <Download className="w-5 h-5" strokeWidth={3} />
                Install App
              </button>
            )}
            <button
              onClick={() => setShowNotificationModal(true)}
              className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 neo-border bg-[#FFDE59] !bg-[#FFDE59] text-black flex items-center justify-center neo-shadow hover:scale-105 transition-transform"
            >
              <Bell className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              {hasUrgentNotification && (
                <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-[#FF4444] rounded-full border-2 border-black animate-pulse"></span>
              )}
            </button>
            {garage.length > 0 && (
              <button
                onClick={() => setShowGarageModal(true)}
                className="hidden sm:flex px-4 h-12 rounded-full border-4 neo-border bg-[#00FC73] !bg-[#00FC73] text-black font-black items-center justify-center neo-shadow hover:scale-105 transition-transform gap-2"
              >
                <Car className="w-5 h-5" strokeWidth={3} />
                Garasi
              </button>
            )}
            {savedHistory.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="hidden sm:flex px-4 h-12 rounded-full border-4 neo-border bg-[#FF90E8] !bg-[#FF90E8] text-black font-black items-center justify-center neo-shadow hover:scale-105 transition-transform gap-2"
              >
                <History className="w-5 h-5" strokeWidth={3} />
                Riwayat
              </button>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 neo-border bg-surface-primary flex items-center justify-center neo-text neo-shadow hover:scale-105 transition-transform"
            >
              {isDarkMode ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-10 md:py-12 space-y-8 sm:space-y-12 md:space-y-16">
        {/* Upload Section */}
        <section className="bg-surface-primary p-5 sm:p-10 neo-box no-print">
          <div className="text-center max-w-lg mx-auto mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-black mb-2 neo-text">Biar Mang AI Yang Tebak! ⚡</h2>
            <p className="neo-text font-medium text-sm sm:text-base">
              Nggak usah bingung soal mesin. Fotokan <strong>Odometer</strong> aja, atau isi form keluhan di bawah. Mang AI siap nemenin biar lo nggak bingung di bengkel!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div
              className="border-4 border-dashed neo-border bg-[#00FC73] rounded-2xl p-6 sm:p-8 text-center cursor-pointer group neo-shadow"
              onClick={() => cameraInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-surface-primary border-4 neo-border neo-text flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform neo-shadow">
                <Camera className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-black text-black">Ambil Foto</p>
              <p className="text-sm text-black font-bold mt-1">Gunakan Kamera</p>
              <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
              />
            </div>
            
            <div
              className="border-4 border-dashed neo-border bg-surface-secondary rounded-2xl p-6 sm:p-8 text-center cursor-pointer group neo-shadow"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-surface-primary border-4 neo-border neo-text flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform neo-shadow">
                <UploadCloud className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold neo-text">Pilih dari Galeri</p>
              <p className="text-sm neo-text font-medium mt-1">Unggah file (Max 5MB)</p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Manual Service History Section */}
          <div className={`bg-surface-secondary border-4 p-5 sm:p-6 rounded-2xl mb-6 sm:mb-8 transition-all duration-300 ${!isManualHistoryOpen ? 'animate-kelap-kelip' : 'neo-border neo-shadow'}`}>
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 ${isManualHistoryOpen ? 'mb-5 sm:mb-6' : ''}`}>
              <div 
                className="flex items-center gap-2 cursor-pointer flex-1 w-full"
                onClick={() => setIsManualHistoryOpen(!isManualHistoryOpen)}
              >
                <h3 className="text-lg sm:text-xl font-black neo-text flex items-center gap-2 flex-1">
                  <Wrench className="w-5 h-5 flex-shrink-0" strokeWidth={3} /> Ceritain Keluhan Kendaraanmu
                </h3>
                {isManualHistoryOpen ? <ChevronUp className="w-5 h-5 neo-text flex-shrink-0" strokeWidth={3} /> : <ChevronDown className="w-5 h-5 neo-text flex-shrink-0" strokeWidth={3} />}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGarageModal(true);
                }} 
                className="text-xs sm:text-sm border-4 neo-border px-3 py-1.5 bg-[#00FC73] !bg-[#00FC73] text-black font-black rounded-lg hover:scale-105 neo-shadow-sm flex items-center gap-1 w-full sm:w-auto justify-center mt-2 sm:mt-0"
              >
                <Car className="w-4 h-4" /> Kelola Garasi
              </button>
            </div>
            
            {isManualHistoryOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-6 p-4 bg-surface-primary border-4 neo-border rounded-xl shadow-sm">
                  <label className="block text-sm font-bold neo-text mb-2">Pilih Profil Kendaraan</label>
                  <select 
                     value={activeVehicleId || ''}
                     onChange={(e) => handleVehicleSelect(e.target.value)}
                     className="w-full bg-white text-black border-4 neo-border p-3 rounded-xl font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                  >
                    <option value="">-- Tanpa Profil / Kendaraan Baru --</option>
                    {garage.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.merek_kendaraan})</option>
                    ))}
                  </select>
                </div>

                <p className="text-sm neo-text font-medium mb-6">Atau isi informasi manual (opsional) agar analisis lebih akurat.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold neo-text mb-2">Jenis Kendaraan</label>
                    <select
                      value={manualHistory.jenis_kendaraan}
                      onChange={(e) => setManualHistory({...manualHistory, jenis_kendaraan: e.target.value})}
                      className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                    >
                      <option value="Motor">Motor</option>
                      <option value="Mobil">Mobil</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold neo-text mb-2">Merek & Model</label>
                    <input
                      type="text"
                      placeholder="Cth: Honda Vario 150"
                      value={manualHistory.merek_kendaraan}
                      onChange={(e) => setManualHistory({...manualHistory, merek_kendaraan: e.target.value})}
                      className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold neo-text mb-2">Tanggal Servis Terakhir (Opsional)</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={manualHistory.tanggal_servis}
                      onChange={(e) => setManualHistory({...manualHistory, tanggal_servis: e.target.value})}
                      className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold neo-text mb-2">Jarak Tempuh (KM) Saat Ini</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Cth: 47500"
                      value={manualHistory.jarak_tempuh}
                      onChange={(e) => setManualHistory({...manualHistory, jarak_tempuh: e.target.value})}
                      className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-bold neo-text mb-2">Riwayat Komponen Diganti (Opsional)</label>
                      <input
                        type="text"
                        placeholder="Cth: Oli Mesin (Bulan lalu)"
                        value={manualHistory.komponen_diganti}
                        onChange={(e) => setManualHistory({...manualHistory, komponen_diganti: e.target.value})}
                        className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold neo-text text-[#FF4444]">Keluhan Kendaraan (Sangat disarankan jika ada)</label>
                        <button 
                          onClick={startListening}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-2 neo-border text-xs font-bold transition-all ${isListening ? 'bg-[#FF4444] text-white animate-pulse' : 'bg-[#FFDE59] text-black hover:scale-105'}`}
                        >
                          <Mic className="w-3 h-3" />
                          {isListening ? 'Mendengarkan...' : 'Ngomong Langsung'}
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Cth: Suara mesin kasar, tarikan berat, rem kurang pakem..."
                        value={manualHistory.keluhan}
                        onChange={(e) => setManualHistory({...manualHistory, keluhan: e.target.value})}
                        className="w-full bg-surface-primary border-4 neo-border p-3 rounded-xl neo-text font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8] resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={handleClearManualHistory}
                        className="text-sm font-bold border-4 neo-border bg-[#FF4444] text-white px-4 py-2 rounded-lg hover:scale-105 transition-transform flex items-center gap-2 neo-shadow-sm"
                      >
                        <Eraser className="w-4 h-4" strokeWidth={3} /> Bersihkan Form
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {images.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                {images.map((img, idx) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={`img-${idx}`}
                      className="relative group aspect-square w-full sm:w-48 rounded-xl overflow-hidden border-4 neo-border neo-shadow"
                    >
                      <img src={img.url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-black border-2 border-transparent hover:border-white text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md"
                      >
                        <X className="w-4 h-4" strokeWidth={3} />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-surface-primary min-h-[40px] flex items-center p-3 border-t-4 neo-border pointer-events-none">
                        <div className="flex items-center gap-1.5 neo-text">
                          <FileImage className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs font-bold truncate">{img.file.name}</span>
                        </div>
                      </div>
                    </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="flex sm:justify-end pt-4 mt-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full sm:w-auto bg-[#0066FF] !bg-[#0066FF] hover:!bg-[#0044CC] hover:scale-105 disabled:!bg-gray-300 disabled:!text-gray-500 disabled:hover:scale-100 text-white px-8 py-3 font-bold neo-btn flex items-center justify-center gap-3 text-lg"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Tunggu Bentar...
                </>
              ) : (
                <>
                  <Activity className="w-6 h-6" strokeWidth={2.5} />
                  Tanya Mang AI 🚀
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-8 p-5 neo-box bg-[#FF4444] !bg-[#FF4444] text-white flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <strong className="block font-black text-lg mb-1">Waduh, Gagal Bos! 🚨</strong>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex flex-col items-center justify-center p-12 bg-surface-secondary border-4 border-dashed neo-border rounded-3xl neo-shadow"
            >
              <div className="w-16 h-16 border-8 border-white border-t-[#00FC73] rounded-full animate-spin mb-6 neo-shadow"></div>
              <h3 className="text-2xl font-black neo-text mb-3">Mang AI Lagi Mikir...</h3>
              <div className="relative max-w-md w-full">
                <div className="absolute -left-2 -top-2 w-6 h-6 bg-[#FF90E8] border-4 neo-border rounded-full animate-bounce delay-100 hidden sm:block"></div>
                <div className="absolute -right-2 -bottom-2 w-5 h-5 bg-[#00FC73] border-4 neo-border rounded-full animate-bounce delay-300 hidden sm:block"></div>
                <div className="bg-white border-4 neo-border px-6 py-4 rounded-2xl neo-shadow-sm flex items-center justify-center min-h-[80px] overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p 
                      key={loadingPhraseIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="font-bold text-black text-center text-sm sm:text-base leading-relaxed"
                    >
                      {loadingPhrases[loadingPhraseIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </section>

        <TipsAndMyths />

        {/* Results Section */}
        {result && !isAnalyzing && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
               <h2 className="text-2xl sm:text-3xl font-black neo-text">Hasil Analisis</h2>
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                 <button
                   onClick={() => window.print()}
                   className="flex-1 border-4 neo-border bg-[#FFDE59] !bg-[#FFDE59] text-black px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-full neo-shadow sm:neo-shadow font-black flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                 >
                   <Printer className="w-5 h-5 flex-shrink-0" strokeWidth={3} />
                   Cetak / PDF
                 </button>
                 <button
                   onClick={handleReset}
                   className="flex-1 bg-[#FF90E8] !bg-[#FF90E8] text-black px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-full border-4 neo-border neo-shadow font-black flex items-center justify-center gap-2 hover:scale-105 transition-transform mt-2 sm:mt-0"
                 >
                   <RotateCcw className="w-5 h-5 flex-shrink-0" strokeWidth={3} />
                   Pindai Baru
                 </button>
               </div>
            </div>

            {/* Status overview list */}
            <div className={`p-5 sm:p-8 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center ${getStatusColor(result.status_kendaraan)} transition-colors relative`}>
               <div className={`w-16 h-16 sm:w-20 sm:h-20 border-4 neo-border text-black rounded-2xl bg-white !bg-white flex items-center justify-center flex-shrink-0 neo-shadow`}>
                  {getStatusIcon(result.status_kendaraan)}
               </div>
               <div className="flex-1 pr-12">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider mb-1">Status Kendaraan</h3>
                  <div className="text-2xl sm:text-3xl font-black mb-1 sm:mb-2">{result.status_kendaraan}</div>
                  <p className="font-bold text-sm sm:text-lg leading-relaxed text-balance">"{result.pesan_user_friendly}"</p>
               </div>
               <button 
                  onClick={() => playMangAIVoice(result.pesan_user_friendly)}
                  className={`absolute top-5 right-5 sm:top-auto sm:right-8 p-3 rounded-full border-4 neo-border neo-shadow-sm transition-all flex items-center justify-center ${isPlayingVoice ? 'bg-[#FF4444] text-white animate-pulse' : 'bg-white text-black hover:scale-105'}`}
                  title="Dengerin Mang AI Ngomong"
               >
                 {isPlayingVoice ? <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />}
               </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
               {/* Extract Details Card */}
              <div className="bg-surface-secondary p-5 sm:p-8 neo-box">
                 <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-3 border-b-4 neo-border pb-3 sm:pb-4 neo-text">
                   <Activity className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                   Yang Mang AI Liat 👁️
                 </h3>
                 <dl className="space-y-4 sm:space-y-5">
                   <div className="bg-surface-primary p-3 sm:p-4 border-4 neo-border rounded-xl neo-shadow">
                     <dt className="text-[10px] sm:text-xs uppercase tracking-wider font-bold neo-text mb-1">Jenis Dokumen</dt>
                     <dd className="font-black neo-text capitalize text-base sm:text-lg">
                       {result.analisis_gambar.jenis_gambar.replace("_", " ")}
                     </dd>
                   </div>
                   {result.analisis_gambar.jarak_tempuh_terbaca != null && (
                     <div className="bg-surface-primary p-3 sm:p-4 border-4 neo-border rounded-xl neo-shadow">
                       <dt className="text-[10px] sm:text-xs uppercase tracking-wider font-bold neo-text mb-1">Jarak Tempuh (ODO)</dt>
                       <dd className="font-black neo-text text-xl sm:text-2xl">
                         {result.analisis_gambar.jarak_tempuh_terbaca.toLocaleString('id-ID')} <span className="text-sm font-bold">km</span>
                       </dd>
                     </div>
                   )}
                   {result.analisis_gambar.tanggal_terbaca && (
                     <div className="bg-surface-primary p-3 sm:p-4 border-4 neo-border rounded-xl neo-shadow">
                       <dt className="text-[10px] sm:text-xs uppercase tracking-wider font-bold neo-text mb-1">Tanggal Terbaca</dt>
                       <dd className="font-black neo-text text-base sm:text-lg">
                         {result.analisis_gambar.tanggal_terbaca}
                       </dd>
                     </div>
                   )}
                 </dl>
              </div>

               {/* Recommendations Card */}
               <div className="bg-surface-primary p-5 sm:p-8 neo-box">
                 <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-3 border-b-4 neo-border pb-3 sm:pb-4 neo-text">
                   <Wrench className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                   Saran Perbaikan Mang AI 💡
                 </h3>
                 {result.rekomendasi_tindakan.length > 0 ? (
                   <ul className="space-y-4">
                     {result.rekomendasi_tindakan.map((rek, idx) => (
                       <li key={idx} className="flex gap-4 p-4 border-4 neo-border rounded-xl bg-surface-secondary shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] transition-transform hover:-translate-y-1">
                         <div className="w-10 h-10 border-4 neo-border bg-[#FF90E8] !bg-[#FF90E8] text-black flex items-center justify-center flex-shrink-0 text-sm font-black neo-shadow-sm rounded-lg">
                           {getRecommendationIcon(rek)}
                         </div>
                         <div className="pt-0.5">
                           <span className="text-sm font-black uppercase text-gray-500 mb-1 block tracking-wider">Mang AI bilang {idx + 1}</span>
                           <p className="neo-text font-bold text-lg leading-snug">{rek}</p>
                         </div>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-gray-500 font-bold italic">Aman Bos! Belum ada yang urgent.</p>
                 )}
                 
                 {result.estimasi_biaya_perbaikan && (
                   <div className="mt-8 bg-[#00FC73] p-5 sm:p-6 border-4 neo-border border-black rounded-2xl neo-shadow rotate-1 sm:rotate-2 group hover:rotate-0 transition-transform">
                     <h4 className="font-black text-black text-xs sm:text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                       <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                       Estimasi Biaya (Biar Ngga Kena Getok)
                     </h4>
                     <p className="font-black text-black text-xl sm:text-2xl leading-tight">
                       {result.estimasi_biaya_perbaikan}
                     </p>
                   </div>
                 )}
               </div>
            </div>

            {/* Components History (If Any) */}
            {result.riwayat_komponen && result.riwayat_komponen.length > 0 && (
              <div className="bg-table p-5 sm:p-8 neo-box border-dashed">
                 <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-3 border-b-4 neo-border pb-3 sm:pb-4 neo-text">
                   <CalendarClock className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                   Prediksi Umur Part Bawaan Pabrik ⏳
                 </h3>
                 <div className="overflow-x-auto border-4 neo-border rounded-xl neo-shadow">
                   <table className="w-full text-left border-collapse bg-surface-primary min-w-[600px]">
                     <thead className="bg-table-header border-b-4 neo-border">
                       <tr>
                         <th className="py-3 px-4 sm:py-4 sm:px-5 text-xs sm:text-sm tracking-widest uppercase font-black neo-text border-r-4 neo-border">Nama Komponen</th>
                         <th className="py-3 px-4 sm:py-4 sm:px-5 text-xs sm:text-sm tracking-widest uppercase font-black neo-text border-r-4 neo-border whitespace-nowrap">Est. Usia (KM)</th>
                         <th className="py-3 px-4 sm:py-4 sm:px-5 text-xs sm:text-sm tracking-widest uppercase font-black neo-text border-r-4 neo-border whitespace-nowrap">Est. Usia (Bulan)</th>
                         <th className="py-3 px-4 sm:py-4 sm:px-5 text-xs sm:text-sm tracking-widest uppercase font-black neo-text whitespace-nowrap">Est. Harga / Servis</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y-4 neo-divide">
                       {result.riwayat_komponen.map((komp, idx) => (
                         <tr key={idx} className="hover-table-row transition-colors">
                           <td className="py-3 px-4 sm:py-4 sm:px-5 font-bold neo-text border-r-4 neo-border text-base sm:text-lg">{komp.nama_komponen}</td>
                           <td className="py-3 px-4 sm:py-4 sm:px-5 neo-text font-semibold border-r-4 neo-border whitespace-nowrap">
                             {komp.estimasi_usia_pakai_km ? <>{komp.estimasi_usia_pakai_km.toLocaleString('id-ID')} km</> : '-'}
                           </td>
                           <td className="py-3 px-4 sm:py-4 sm:px-5 neo-text font-semibold border-r-4 neo-border whitespace-nowrap">
                             {komp.estimasi_usia_pakai_bulan ? <>{komp.estimasi_usia_pakai_bulan} bulan</> : '-'}
                           </td>
                           <td className="py-3 px-4 sm:py-4 sm:px-5 neo-text font-semibold whitespace-nowrap">
                             {komp.estimasi_biaya ? <div className="bg-[#FFDE59] !bg-[#FFDE59] text-black px-2 py-1 rounded-md inline-block font-black border-2 neo-border">Rp {komp.estimasi_biaya.toLocaleString('id-ID')}</div> : '-'}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>
            )}

            {/* Total Note Cost (if exists) */}
            {result.analisis_gambar.total_biaya_terbaca && (
               <div className="bg-[#00FC73] !bg-[#00FC73] p-5 sm:p-6 neo-box text-black flex flex-col sm:flex-row items-start sm:items-center justify-between no-print mb-6 sm:mb-8 gap-3 sm:gap-0">
                 <div className="font-black text-lg sm:text-xl uppercase tracking-widest">Total Biaya di Nota</div>
                 <div className="text-2xl sm:text-3xl font-black bg-white px-4 py-2 rounded-xl border-4 neo-border border-black neo-shadow-sm w-full sm:w-auto text-center">
                   Rp {result.analisis_gambar.total_biaya_terbaca.toLocaleString('id-ID')}
                 </div>
               </div>
            )}

            {/* Chart Section */}
            {chartData.length > 0 && (
              <div className="bg-surface-primary p-5 sm:p-8 neo-box flex flex-col break-inside-avoid">
                <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-3 border-b-4 neo-border pb-3 sm:pb-4 neo-text">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                  Grafik Jarak Tempuh
                </h3>
                <div className="h-72 mt-4 w-full border-4 neo-border rounded-xl p-4 neo-shadow bg-white !bg-white text-black relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                      <XAxis dataKey="bulan" stroke="#000" tick={{fill: '#000', fontWeight: 'bold'}} />
                      <YAxis stroke="#000" tick={{fill: '#000', fontWeight: 'bold'}} domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '4px solid #000', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }} 
                        labelStyle={{ color: '#000', marginBottom: '4px' }}
                        itemStyle={{ color: '#000' }}
                      />
                      <Line type="monotone" dataKey="jarak_tempuh" name="Jarak Tempuh (km)" stroke="#FF90E8" strokeWidth={5} activeDot={{ r: 8, fill: '#00FC73', stroke: '#000', strokeWidth: 3 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {costChartData.length > 0 && (
              <div className="bg-surface-secondary p-5 sm:p-8 neo-box flex flex-col break-inside-avoid shadow-lg mt-6 sm:mt-8">
                <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-3 border-b-4 neo-border pb-3 sm:pb-4 neo-text">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                  Grafik Biaya Servis Bulanan
                </h3>
                <div className="h-72 mt-4 w-full border-4 neo-border rounded-xl p-4 neo-shadow-sm bg-white !bg-white text-black relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={costChartData} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={false} />
                      <XAxis dataKey="bulan" stroke="#000" tick={{fill: '#000', fontWeight: 'bold'}} />
                      <YAxis stroke="#000" tick={{fill: '#000', fontWeight: 'bold'}} tickFormatter={(value) => `Rp${value/1000}k`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '4px solid #000', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }} 
                        labelStyle={{ color: '#000', marginBottom: '4px' }}
                        itemStyle={{ color: '#000' }}
                        formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Total Biaya']}
                      />
                      <Bar dataKey="total_biaya" name="Total Biaya" fill="#00FC73" stroke="#000" strokeWidth={4} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {(result.status_kendaraan === "Perlu Servis Ringan" || result.status_kendaraan === "Perlu Servis Berat") && (
               <NearbyGarages vehicleType={(manualHistory.merek_kendaraan || activeVehicleId ? garage.find(v => v.id === activeVehicleId)?.merek_kendaraan : undefined) || 'Kendaraan'} />
            )}

          </motion.section>
        )}
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-primary border-4 neo-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col neo-shadow-lg"
          >
            <div className="p-4 sm:p-6 border-b-4 neo-border flex justify-between items-center bg-surface-header rounded-t-xl">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 sm:gap-3 neo-text">
                <History className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} /> Riwayat Pengecekan
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 sm:p-2 bg-white border-4 neo-border rounded-full hover:scale-110 transition-transform text-black flex-shrink-0">
                <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
              </button>
            </div>
            
            {garage.length > 0 && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b-4 neo-border bg-surface-secondary">
                <label className="block text-xs sm:text-sm font-bold neo-text mb-1 sm:mb-2">Filter Kendaraan</label>
                <select 
                  value={historyFilterVehicleId}
                  onChange={(e) => setHistoryFilterVehicleId(e.target.value)}
                  className="w-full bg-white border-4 neo-border p-2 sm:p-2.5 rounded-lg text-black font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                >
                  <option value="">Semua Kendaraan</option>
                  {garage.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="font-bold text-gray-500">Belum ada catetan servis nih Bos.</p>
                  <p className="text-sm text-gray-400 mt-2">Coba scan odometer atau isi keluhan dulu biar Mang AI bisa cek.</p>
                </div>
              ) : (
                filteredHistory.map((record) => (
                  <div 
                    key={record.id}
                    onClick={() => loadHistoryItem(record)}
                    className="border-4 neo-border p-4 rounded-xl cursor-pointer hover:-translate-y-1 transition-transform group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-secondary"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black px-2 py-1 bg-white border-2 neo-border rounded-md text-black shadow-sm">
                          {new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                      <h3 className="font-black text-lg neo-text">{record.vehicleModel}</h3>
                      <p className="text-sm font-bold opacity-80 line-clamp-1 neo-text">
                        Status: {record.result.status_kendaraan}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <button 
                        onClick={(e) => deleteHistory(record.id, e)}
                        className="p-2 border-2 neo-border rounded-lg bg-[#FF4444] text-white hover:opacity-80"
                        title="Hapus riwayat"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div className="w-10 h-10 border-2 neo-border rounded-lg bg-white flex items-center justify-center text-black group-hover:bg-[#00FC73] transition-colors">
                        <ChevronRight className="w-6 h-6" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Garage Modal */}
      {showGarageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-primary border-4 neo-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col neo-shadow-lg"
          >
            <div className="p-4 sm:p-6 border-b-4 neo-border flex justify-between items-center bg-surface-header rounded-t-xl">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 sm:gap-3 neo-text">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" strokeWidth={3} /> Garasi Kendaraan
              </h2>
              <button onClick={() => setShowGarageModal(false)} className="p-1.5 sm:p-2 bg-white border-4 neo-border rounded-full hover:scale-110 transition-transform text-black flex-shrink-0">
                <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
              <div className="bg-surface-secondary border-4 neo-border rounded-xl p-4 sm:p-5 neo-shadow-sm">
                <h3 className="font-black text-base sm:text-lg mb-3 sm:mb-4 neo-text">Tambah Kendaraan</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold neo-text mb-1">Nama Panggilan / Plat</label>
                    <input
                      type="text"
                      placeholder="Cth: Beat Hitam B 1234 CD"
                      value={newVehicle.name}
                      onChange={(e) => setNewVehicle({...newVehicle, name: e.target.value})}
                      className="w-full bg-white text-black border-4 neo-border p-2.5 rounded-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold neo-text mb-1">Jenis</label>
                      <select
                        value={newVehicle.jenis_kendaraan}
                        onChange={(e) => setNewVehicle({...newVehicle, jenis_kendaraan: e.target.value})}
                        className="w-full bg-white text-black border-4 neo-border p-2.5 rounded-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                      >
                        <option value="Motor">Motor</option>
                        <option value="Mobil">Mobil</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold neo-text mb-1">Merek & Model</label>
                      <input
                        type="text"
                        placeholder="Cth: Honda CBR"
                        value={newVehicle.merek_kendaraan}
                        onChange={(e) => setNewVehicle({...newVehicle, merek_kendaraan: e.target.value})}
                        className="w-full bg-white text-black border-4 neo-border p-2.5 rounded-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#FF90E8]"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleAddVehicle}
                    disabled={!newVehicle.name || !newVehicle.merek_kendaraan}
                    className="w-full bg-[#00FC73] border-4 neo-border font-black text-black p-3 rounded-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-transform neo-shadow-sm flex items-center justify-center gap-2 mt-2"
                  >
                    <Plus className="w-5 h-5" strokeWidth={3} />
                    Simpan ke Garasi
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-black text-lg mb-4 neo-text">Daftar Kendaraan</h3>
                {garage.length === 0 ? (
                  <div className="text-center py-6 border-4 border-dashed neo-border rounded-xl bg-gray-50/50">
                    <Car className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-bold text-gray-500">Garasi masih kosong melompong.</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Tambahin dulu motor atau mobilnya di atas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {garage.map(v => {
                      // Find latest record for this vehicle
                      const latestRecord = savedHistory.find(h => h.vehicleId === v.id);
                      let nextServiceText = null;
                      
                      if (latestRecord && latestRecord.result.riwayat_komponen) {
                        const validEstimates = latestRecord.result.riwayat_komponen
                          .map(k => k.estimasi_usia_pakai_bulan)
                          .filter(val => val && val > 0) as number[];
                          
                        if (validEstimates.length > 0) {
                           const minMonths = Math.min(...validEstimates);
                           const nextDate = new Date(latestRecord.date);
                           nextDate.setMonth(nextDate.getMonth() + minMonths);
                           
                           // Check if it's strictly in the past, or soon
                           const now = new Date();
                           if (nextDate < now) {
                              nextServiceText = <span className="text-[#FF4444]">Perlu Servis Sekarang!</span>;
                           } else {
                              nextServiceText = `Est. Perawatan: ${nextDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' })}`;
                           }
                        }
                      }

                      return (
                      <div key={v.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-4 neo-border bg-surface-primary rounded-xl neo-shadow-sm gap-4">
                        <div>
                          <h4 className="font-black text-lg neo-text">{v.name}</h4>
                          <p className="text-sm font-bold neo-text opacity-70 mb-1">{v.jenis_kendaraan} • {v.merek_kendaraan}</p>
                          {nextServiceText && (
                            <div className="inline-block mt-1 px-2 py-1 bg-white border-2 neo-border rounded-md text-xs font-black">
                              <Activity className="w-3 h-3 inline mr-1" /> {nextServiceText}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="p-2 border-2 neo-border rounded-lg bg-[#FF4444] text-white hover:opacity-80 transition-opacity flex-shrink-0"
                          title="Hapus kendaraan"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-primary w-full max-w-xl rounded-2xl border-4 neo-border overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 sm:p-6 border-b-4 neo-border flex justify-between items-center bg-[#FFDE59] !bg-[#FFDE59] text-black">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" strokeWidth={3} /> Notifikasi
              </h2>
              <button 
                onClick={() => setShowNotificationModal(false)}
                className="p-1 sm:p-2 border-4 border-transparent hover:border-black rounded-xl transition-colors text-black flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
              {garage.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">💤</div>
                  <p className="font-bold text-gray-500 text-lg">Santai Bos, ngga ada alarm nyala.</p>
                  <p className="text-sm mt-2 text-gray-400 max-w-xs mx-auto">Masukin kendaraan ke Garasi dong, nanti Mang AI kabarin kalau waktunya servis.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {garage.map(v => {
                    const latestRecord = savedHistory.find(h => h.vehicleId === v.id);
                    let alertContent = null;
                    let isUrgent = false;
                    let nextDate: Date | null = null;
                    
                    if (latestRecord && latestRecord.result.riwayat_komponen) {
                      const validEstimates = latestRecord.result.riwayat_komponen
                        .map(k => k.estimasi_usia_pakai_bulan)
                        .filter(val => val && val > 0) as number[];
                        
                      if (validEstimates.length > 0) {
                         const minMonths = Math.min(...validEstimates);
                         nextDate = new Date(latestRecord.date);
                         nextDate.setMonth(nextDate.getMonth() + minMonths);
                         
                         const now = new Date();
                         if (nextDate < now) {
                            isUrgent = true;
                            alertContent = `Waktunya servis! Tenggat waktu perkiraan: ${nextDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
                         } else {
                            const diffMonths = (nextDate.getFullYear() - now.getFullYear()) * 12 + (nextDate.getMonth() - now.getMonth());
                            if (diffMonths <= 1) {
                               alertContent = `Servis rutin mendekati: ${nextDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
                               isUrgent = true;
                            } else {
                               alertContent = `Jadwal servis rutin selanjutnya sekitar bulan ${nextDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
                            }
                         }
                      }
                    }

                    if (!alertContent) {
                       return (
                           <div key={v.id} className="p-4 border-4 neo-border bg-surface-primary rounded-xl flex items-start gap-4 neo-shadow-sm opacity-60">
                              <div className="w-10 h-10 rounded-full border-2 neo-border bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500">
                                <Activity className="w-5 h-5" />
                              </div>
                              <div>
                                 <h4 className="font-black neo-text">{v.name}</h4>
                                 <p className="text-sm font-bold opacity-80 mt-1">Belum cukup data nih. Sering-sering scan ya biar Mang AI gampang nebaknya.</p>
                              </div>
                           </div>
                         );
                      }

                      return (
                        <div key={v.id} className={`p-4 border-4 neo-border rounded-xl flex items-start gap-4 neo-shadow-sm flex-col sm:flex-row ${isUrgent ? 'bg-[#FF4444] text-white' : 'bg-surface-secondary neo-text'}`}>
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-full border-2 neo-border flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-white text-[#FF4444]' : 'bg-[#FFDE59] text-black'}`}>
                              {isUrgent ? <AlertTriangle className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
                            </div>
                            <div>
                              <h4 className="font-black">{v.name} <span className="opacity-70 text-xs ml-1 font-bold">({v.merek_kendaraan})</span></h4>
                              <p className="text-sm font-bold mt-1">{alertContent}</p>
                            </div>
                          </div>
                          {nextDate && (
                            <button
                              onClick={() => downloadICS(`Servis ${v.name}`, `Pengingat Servis Rutin untuk kendaraan ${v.name} (${v.merek_kendaraan}).\n${alertContent}`, nextDate!)}
                              className={`mt-3 sm:mt-0 px-3 py-2 border-2 neo-border rounded-lg text-sm font-black flex items-center gap-2 hover:opacity-80 transition-opacity ${isUrgent ? 'bg-white text-black' : 'bg-[#00FC73] text-black'}`}
                            >
                              <CalendarIcon className="w-4 h-4" /> Masukin Kalender
                            </button>
                          )}
                        </div>
                      );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating History button for mobile */}
      {savedHistory.length > 0 && !showHistoryModal && (
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#FF90E8] !bg-[#FF90E8] border-4 neo-border rounded-full neo-shadow-lg flex items-center justify-center text-black z-40 no-print"
        >
          <History className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}

    </div>
  );
}
