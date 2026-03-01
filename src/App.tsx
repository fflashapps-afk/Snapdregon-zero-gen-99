import React, { useState, useEffect, useRef } from 'react';
import { 
  Github, 
  Upload, 
  Globe, 
  FileCode, 
  Folder, 
  FileArchive, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  Search,
  Layout,
  Monitor,
  Smartphone,
  History,
  Settings,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface Deployment {
  id: string;
  site_url: string;
  admin_url: string;
  timestamp: number;
  name: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'github' | 'local' | 'history'>('github');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [history, setHistory] = useState<Deployment[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'github') {
      fetchRepos();
    }
    const savedHistory = localStorage.getItem('deploy_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, [activeTab]);

  const handleDeployGithubUrl = async () => {
    if (!githubUrl) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/api/deploy/github-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl })
      });

      if (res.ok) {
        const data = await res.json();
        setDeployResult(data);
        const newDeployment = {
          id: data.site_id,
          site_url: data.site_url,
          admin_url: data.admin_url,
          timestamp: Date.now(),
          name: data.name
        };
        const updatedHistory = [newDeployment, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('deploy_history', JSON.stringify(updatedHistory));
        setGithubUrl('');
      } else {
        const err = await res.json();
        alert(err.error || 'Deployment failed');
      }
    } catch (err) {
      console.error('Deployment failed', err);
    } finally {
      setDeploying(false);
    }
  };

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      }
    } catch (err) {
      console.error('Failed to fetch repos', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeployGithub = async (repo: Repo) => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/api/deploy/github-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repo.html_url })
      });

      if (res.ok) {
        const data = await res.json();
        setDeployResult(data);
        const newDeployment = {
          id: data.site_id,
          site_url: data.site_url,
          admin_url: data.admin_url,
          timestamp: Date.now(),
          name: repo.name
        };
        const updatedHistory = [newDeployment, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('deploy_history', JSON.stringify(updatedHistory));
      } else {
        const err = await res.json();
        alert(err.error || 'Deployment failed');
      }
    } catch (err) {
      console.error('Deployment failed', err);
    } finally {
      setDeploying(false);
    }
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLocalFiles(Array.from(e.target.files));
    }
  };

  const handleDeployLocal = async () => {
    if (localFiles.length === 0) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const zip = new JSZip();
      for (const file of localFiles) {
        // Handle folder structure if possible, otherwise flat
        const path = (file as any).webkitRelativePath || file.name;
        zip.file(path, file);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const formData = new FormData();
      formData.append('file', content, 'local_project.zip');

      const res = await fetch('/api/netlify/deploy', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setDeployResult(data);
        const newDeployment = {
          id: data.site_id,
          site_url: data.site_url,
          admin_url: data.admin_url,
          timestamp: Date.now(),
          name: localFiles[0].name.split('.')[0] || 'Local Project'
        };
        const updatedHistory = [newDeployment, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('deploy_history', JSON.stringify(updatedHistory));
      }
    } catch (err) {
      console.error('Deployment failed', err);
    } finally {
      setDeploying(false);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* Sidebar Navigation */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Globe className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Google Deploy</h1>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Cloud Engine</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button 
            onClick={() => setActiveTab('github')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'github' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Github size={20} />
            <span className="font-medium">GitHub Projects</span>
          </button>
          <button 
            onClick={() => setActiveTab('local')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'local' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Upload size={20} />
            <span className="font-medium">Local Import</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <History size={20} />
            <span className="font-medium">Deploy History</span>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-tighter">System Status</span>
            </div>
            <p className="text-xs text-gray-400">All systems operational. Ready for deployment.</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="md:pl-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-bottom border-gray-200 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
            {activeTab === 'github' && (
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 border-2 border-white shadow-sm" />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'github' && (
              <motion.div 
                key="github"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Plus className="text-blue-600" size={20} />
                    Import by GitHub URL
                  </h3>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="https://github.com/owner/repo"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleDeployGithubUrl}
                      disabled={deploying || !githubUrl}
                      className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deploying ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                      Deploy
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-400 font-medium">
                    Enter any public GitHub repository URL to deploy it directly to Netlify.
                  </p>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-gray-500 font-medium">Fetching your repositories...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredRepos.map((repo) => (
                      <motion.div 
                        key={repo.id}
                        whileHover={{ y: -4 }}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                              <Github className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{repo.name}</h3>
                              <p className="text-xs text-gray-400 font-medium">Updated {new Date(repo.updated_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <a href={repo.html_url} target="_blank" className="text-gray-300 hover:text-gray-600">
                            <ExternalLink size={18} />
                          </a>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-6 min-h-[2.5rem]">
                          {repo.description || "No description available for this project."}
                        </p>
                        <button 
                          onClick={() => handleDeployGithub(repo)}
                          disabled={deploying}
                          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deploying ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                          Deploy to Netlify
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'local' && (
              <motion.div 
                key="local"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-6 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="text-blue-600 w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Import Project Files</h3>
                    <p className="text-gray-500">Drag and drop your folder or ZIP file here, or click to browse.</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleLocalFileSelect}
                    className="hidden" 
                    multiple
                    // @ts-ignore
                    webkitdirectory="" 
                    directory=""
                  />
                  {localFiles.length > 0 && (
                    <div className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg shadow-blue-200">
                      {localFiles.length} files selected
                    </div>
                  )}
                </div>

                {localFiles.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Folder className="text-blue-600" />
                        <span className="font-bold">Project Structure</span>
                      </div>
                      <button 
                        onClick={() => setLocalFiles([])}
                        className="text-xs font-bold text-red-500 uppercase tracking-wider"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                      {localFiles.slice(0, 10).map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">
                          <FileCode size={16} />
                          <span className="truncate">{(file as any).webkitRelativePath || file.name}</span>
                        </div>
                      ))}
                      {localFiles.length > 10 && (
                        <p className="text-xs text-center text-gray-400 pt-2 italic">And {localFiles.length - 10} more files...</p>
                      )}
                    </div>
                    <button 
                      onClick={handleDeployLocal}
                      disabled={deploying}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                    >
                      {deploying ? <Loader2 className="animate-spin" /> : <Globe />}
                      Deploy Local Project
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {history.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <History className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No deployments yet</h3>
                    <p className="text-gray-500">Your deployment history will appear here.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                          <CheckCircle2 className="text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={item.site_url} 
                          target="_blank" 
                          className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                          <Globe size={14} />
                          Visit Site
                        </a>
                        <a 
                          href={item.admin_url} 
                          target="_blank" 
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center gap-2"
                        >
                          <Layout size={14} />
                          Admin
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Deployment Modal / Preview Overlay */}
      <AnimatePresence>
        {deployResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Deployment Successful!</h3>
                    <p className="text-xs text-gray-500 font-medium">Your site is live and ready for the world.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-2 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                  >
                    <Monitor size={18} />
                  </button>
                  <button 
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-2 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                  >
                    <Smartphone size={18} />
                  </button>
                </div>
                <button 
                  onClick={() => setDeployResult(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Plus className="rotate-45 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 bg-gray-100 p-8 flex items-center justify-center overflow-hidden">
                <div 
                  className={`bg-white shadow-2xl transition-all duration-500 overflow-hidden relative ${previewMode === 'desktop' ? 'w-full h-full rounded-xl' : 'w-[375px] h-[667px] rounded-[3rem] border-[12px] border-gray-900'}`}
                >
                  {previewMode === 'mobile' && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />
                  )}
                  <iframe 
                    src={deployResult.site_url} 
                    className="w-full h-full border-none"
                    title="Deployment Preview"
                  />
                </div>
              </div>

              <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Site URL</p>
                    <a href={deployResult.site_url} target="_blank" className="text-blue-600 font-semibold flex items-center gap-2 hover:underline">
                      {deployResult.site_url}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="h-8 w-px bg-gray-100" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Admin Panel</p>
                    <a href={deployResult.admin_url} target="_blank" className="text-gray-600 font-semibold flex items-center gap-2 hover:underline">
                      Netlify Dashboard
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <button 
                  onClick={() => setDeployResult(null)}
                  className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Navigation (Bottom Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-50">
        <button onClick={() => setActiveTab('github')} className={`flex flex-col items-center gap-1 ${activeTab === 'github' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Github size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">GitHub</span>
        </button>
        <button onClick={() => setActiveTab('local')} className={`flex flex-col items-center gap-1 ${activeTab === 'local' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Upload size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Local</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}>
          <History size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">History</span>
        </button>
      </div>
    </div>
  );
}
