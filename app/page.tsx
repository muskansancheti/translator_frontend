"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Settings, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  XCircle, 
  BookOpen, 
  Plus, 
  Trash2, 
  History, 
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search
} from "lucide-react";



interface Dictionary {
  [key: string]: string;
}

interface HistoryItem {
  jobId: string;
  filename: string;
  timestamp: string;
}

export default function Home() {
  // File upload & Job state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Dictionary management state
  const [dictionary, setDictionary] = useState<Dictionary>({});
  const [searchDictQuery, setSearchDictQuery] = useState("");
  const [newSkKey, setNewSkKey] = useState("");
  const [newEnVal, setNewEnVal] = useState("");
  const [dictLoading, setDictLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"translate" | "dictionary">("translate");

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Preview options
  const [isMaximizedOriginal, setIsMaximizedOriginal] = useState(false);
  const [isMaximizedTranslated, setIsMaximizedTranslated] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Dictionary and History on mount
  useEffect(() => {
    fetchDictionary();
    const storedHistory = localStorage.getItem("translation_history");
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

const fetchDictionary = async () => {
  setDictLoading(true);
  try {
    const res = await fetch(`${API_BASE}/api/dict`);
    if (res.ok) {
      const data = await res.json();
      setDictionary(data);
    }
  } catch (e) {
    console.error("Failed to load custom dictionary", e);
  } finally {
    setDictLoading(false);
  }
};


  // Poll status when a job is active
  useEffect(() => {
    if (!jobId || status === "completed" || status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status/${jobId}`);
        if (!res.ok) throw new Error("Status endpoint error");
        
        const data = await res.json();
        setStatus(data.status);
        setProgress(data.progress);
        setMessage(data.message);
        setError(data.error);

        if (data.status === "completed") {
          clearInterval(interval);
          // Add to history
          const newItem: HistoryItem = {
            jobId: jobId,
            filename: data.original_name || file?.name || "technical_drawing.pdf",
            timestamp: new Date().toLocaleTimeString()
          };
          const updatedHistory = [newItem, ...history.slice(0, 9)];
          setHistory(updatedHistory);
          localStorage.setItem("translation_history", JSON.stringify(updatedHistory));
        } else if (data.status === "failed") {
          clearInterval(interval);
        }
      } catch (e) {
        console.error("Failed to poll status", e);
        setStatus("failed");
        setError("Connection error while polling job status");
        clearInterval(interval);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [jobId, status]);

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".pdf")) {
        setFile(droppedFile);
        resetJobState();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      resetJobState();
    }
  };

  const resetJobState = () => {
    setJobId(null);
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setError(null);
  };

const startTranslation = async () => {
  if (!file) return;

  setStatus("pending");
  setProgress(0);
  setMessage("Uploading file...");
  setError(null);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/api/translate`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Upload failed");
    }

    const data = await res.json();
    setJobId(data.job_id);
    setStatus("processing");
    setProgress(5);
  } catch (err: any) {
    setStatus("failed");
    setError(err.message || "Failed to connect to the backend server");
  }
};

  const handleAddDictWord = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newSkKey.trim() || !newEnVal.trim()) return;

  const updatedDict = {
    ...dictionary,
    [newSkKey.trim()]: newEnVal.trim()
  };

  setDictLoading(true);
  try {
    const res = await fetch(`${API_BASE}/api/dict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDict)
    });
    
    if (res.ok) {
      setDictionary(updatedDict);
      setNewSkKey("");
      setNewEnVal("");
    } else {
      alert("Failed to save translation mapping");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to connect to server");
  } finally {
    setDictLoading(false);
  }
};

  // Delete word from custom dictionary
  const handleDeleteDictWord = async (keyToDelete: string) => {
    const updatedDict = { ...dictionary };
    delete updatedDict[keyToDelete];

    setDictLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedDict)
      });
      
      if (res.ok) {
        setDictionary(updatedDict);
      } else {
        alert("Failed to update dictionary");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    } finally {
      setDictLoading(false);
    }
};

  // Filter dictionary terms
  const filteredDictKeys = Object.keys(dictionary).filter(key => 
    key.toLowerCase().includes(searchDictQuery.toLowerCase()) || 
    dictionary[key].toLowerCase().includes(searchDictQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Premium Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <RefreshCw className="w-5 h-5 text-white animate-spin-slow" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              Slovak Drawing Translator
            </h1>
          </div>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("translate")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "translate" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Translate PDF
          </button>
          <button
            onClick={() => setActiveTab("dictionary")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "dictionary" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Custom Dictionary
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 gap-6">
        
        {activeTab === "translate" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Control Panel: Upload, progress, history (Left 4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Upload Card */}
              <div className="glass-panel rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Upload Slovak Document
                </h2>

                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
                    isDragging 
                      ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" 
                      : "border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-900/10"
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept=".pdf" 
                    className="hidden" 
                  />
                  <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  {file ? (
                    <div className="text-left bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                      <p className="text-xs font-semibold text-indigo-300 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-slate-300">Drag & drop your Slovak PDF drawing</p>
                      <p className="text-[11px] text-slate-500 mt-1">or click to browse local files</p>
                    </div>
                  )}
                </div>

                {file && status === "idle" && (
                  <button
                    onClick={startTranslation}
                    className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium py-2 rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Translate Slovak to English
                  </button>
                )}

                {/* Progress / Status display */}
                {status !== "idle" && (
                  <div className="mt-4 border-t border-slate-900 pt-4">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className={`flex items-center gap-1 ${
                        status === "completed" ? "text-emerald-400" : status === "failed" ? "text-rose-400" : "text-indigo-400"
                      }`}>
                        {status === "completed" && <CheckCircle className="w-3.5 h-3.5" />}
                        {status === "failed" && <XCircle className="w-3.5 h-3.5" />}
                        {status === "pending" && "Queueing..."}
                        {status === "processing" && "Processing..."}
                        {status === "completed" && "Completed!"}
                        {status === "failed" && "Error"}
                      </span>
                      <span className="text-slate-400">{progress}%</span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          status === "completed" 
                            ? "bg-emerald-500" 
                            : status === "failed" 
                              ? "bg-rose-500" 
                              : "bg-indigo-600 animate-pulse"
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 font-mono bg-slate-950/60 p-2 rounded border border-slate-900 leading-relaxed max-h-24 overflow-y-auto">
                      {message || "Processing translation task..."}
                    </p>

                    {error && (
                      <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-900/50 p-2 rounded font-sans leading-relaxed">
                        {error}
                      </div>
                    )}

                    {status === "completed" && jobId && (
                      <a
                        href={`http://localhost:5000/api/download/${jobId}`}
                        download
                        className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-medium py-2 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Translated PDF
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* History Card */}
              <div className="glass-panel rounded-2xl p-5 shadow-2xl">
                <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Recent Translations
                </h2>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No recent translations found</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {history.map((item) => (
                      <div 
                        key={item.jobId}
                        onClick={() => {
                          setJobId(item.jobId);
                          setStatus("completed");
                          setProgress(100);
                          setMessage("Loaded from history");
                          setError(null);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          jobId === item.jobId 
                            ? "bg-indigo-950/40 border-indigo-500/50" 
                            : "bg-slate-950/20 border-slate-900 hover:bg-slate-900/30 hover:border-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-300 truncate">{item.filename}</p>
                          <p className="text-[10px] text-slate-500">{item.timestamp}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Document preview panel: Side-by-Side original/translated (Right 8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6 h-[calc(100vh-140px)]">
              {jobId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  
                  {/* Left Column: Original PDF */}
                  <div className={`glass-panel rounded-2xl flex flex-col border overflow-hidden transition-all ${
                    isMaximizedOriginal ? "fixed inset-4 z-50 bg-slate-950" : "h-full"
                  }`}>
                    <div className="px-4 py-3 bg-slate-900/50 flex items-center justify-between border-b">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        Original Slovak
                      </span>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`http://localhost:5000/api/view/original/${jobId}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            setIsMaximizedOriginal(!isMaximizedOriginal);
                            setIsMaximizedTranslated(false);
                          }}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isMaximizedOriginal ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-950 flex items-center justify-center p-1">
                      <iframe 
                        src={`http://localhost:5000/api/view/original/${jobId}#toolbar=0`} 
                        className="w-full h-full border-none rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Right Column: Translated PDF */}
                  <div className={`glass-panel rounded-2xl flex flex-col border overflow-hidden transition-all ${
                    isMaximizedTranslated ? "fixed inset-4 z-50 bg-slate-950" : "h-full"
                  } ${status !== "completed" ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="px-4 py-3 bg-slate-900/50 flex items-center justify-between border-b">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Translated English
                      </span>
                      <div className="flex items-center gap-2">
                        {status === "completed" && (
                          <>
                            <a 
                              href={`http://localhost:5000/api/view/translated/${jobId}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                setIsMaximizedTranslated(!isMaximizedTranslated);
                                setIsMaximizedOriginal(false);
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              {isMaximizedTranslated ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-950 flex items-center justify-center p-1">
                      {status === "completed" ? (
                        <iframe 
                          src={`http://localhost:5000/api/view/translated/${jobId}#toolbar=0`} 
                          className="w-full h-full border-none rounded-xl"
                        />
                      ) : (
                        <div className="text-center p-6 text-slate-500">
                          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-slate-600" />
                          <p className="text-xs font-semibold">Processing Translated Output...</p>
                          <p className="text-[10px] text-slate-600 mt-1">PDF preview will update once complete</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="glass-panel rounded-2xl h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-xl">
                    <FileText className="w-8 h-8 text-indigo-400/80" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200 mb-1">No Active Drawing Loaded</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Upload a Slovak technical PDF on the left to start the translation and view the side-by-side output.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Dictionary Manager Tab */}
        {activeTab === "dictionary" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Add Term Form (Left 4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="glass-panel rounded-2xl p-5 shadow-2xl">
                <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  Add Technical Term
                </h2>
                <form onSubmit={handleAddDictWord} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Slovak Phrase (Exact Match)</label>
                    <input
                      type="text"
                      placeholder="e.g. posuvné meradlo"
                      value={newSkKey}
                      onChange={(e) => setNewSkKey(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">English Translation</label>
                    <input
                      type="text"
                      placeholder="e.g. sliding gauge"
                      value={newEnVal}
                      onChange={(e) => setNewEnVal(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={dictLoading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium py-2 rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {dictLoading ? "Saving..." : "Add to Custom Dictionary"}
                  </button>
                </form>
              </div>

              <div className="glass-panel rounded-2xl p-5 shadow-2xl text-xs text-slate-400 leading-relaxed">
                <h3 className="font-semibold text-slate-200 mb-2">How it works</h3>
                <p className="mb-2">
                  Custom dictionary matches have **highest priority** over neural translations. Useful for highly specific machine building terms, catalog IDs, and standard drawing text.
                </p>
                <p>
                  Slovak phrases are matched case-insensitively, and replaced exactly in both standard PDF text structures and EasyOCR-detected text blocks.
                </p>
              </div>
            </div>

            {/* List & Search (Right 8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              <div className="glass-panel rounded-2xl p-5 shadow-2xl flex flex-col h-[calc(100vh-170px)]">
                
                {/* Dictionary Search Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      Active Translations Dictionary
                    </h2>
                    <p className="text-[11px] text-slate-500">{Object.keys(dictionary).length} total active custom terms</p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-3.5 w-3.5 text-slate-500" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search dictionary terms..."
                      value={searchDictQuery}
                      onChange={(e) => setSearchDictQuery(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/70"
                    />
                  </div>
                </div>

                {/* Term grid/table */}
                <div className="flex-1 overflow-y-auto">
                  {dictLoading && Object.keys(dictionary).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                      <p className="text-xs">Loading dictionary terms...</p>
                    </div>
                  ) : filteredDictKeys.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 italic text-xs">
                      No custom translations match your query.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredDictKeys.map((key) => (
                        <div 
                          key={key}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-900 hover:border-slate-800 transition-all group"
                        >
                          <div className="min-w-0 pr-4">
                            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider block">Slovak</span>
                            <span className="text-xs font-semibold text-slate-200 truncate block">{key}</span>
                            
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block mt-1">English</span>
                            <span className="text-xs font-medium text-slate-300 truncate block">{dictionary[key]}</span>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteDictWord(key)}
                            disabled={dictLoading}
                            className="p-2 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
