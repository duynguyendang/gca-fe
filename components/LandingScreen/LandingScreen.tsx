import React from 'react';
import { motion } from 'framer-motion';
import {
    Zap,
    Search,
    BarChart3,
    GitBranch,
    Cpu,
    ShieldCheck,
    ArrowRight,
    ChevronRight,
    Play
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { EXTERNAL_URLS } from '../../src/constants';

export const LandingScreen: React.FC = () => {
    const { setIsLandingView } = useAppContext();

    const handleLaunch = () => {
        setIsLandingView(false);
        // Persist session if needed
        sessionStorage.setItem('gca_is_explorer_launched', 'true');
    };

    return (
        <div className="min-h-screen bg-[#0a0e14] text-white relative overflow-hidden font-sans selection:bg-[#2dd4bf]/30 selection:text-[#2dd4bf] scroll-smooth">
            {/* Mesh Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#2dd4bf]/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#a855f7]/20 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[#00f2ff]/10 blur-[120px] rounded-full" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 px-6 py-6 flex items-center justify-between pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 pointer-events-auto"
                >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2dd4bf] to-[#00f2ff] flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.5)]">
                        <Cpu className="w-5 h-5 text-[#0a0e14]" />
                    </div>
                    <span className="text-xl font-black uppercase tracking-tighter">GCA</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="hidden md:flex items-center gap-8 bg-white/5 backdrop-blur-md px-8 py-3 rounded-full border border-white/10 pointer-events-auto"
                >
                    {["Features", "Enterprise", "Documentation"].map((item) => (
                        <a
                            key={item}
                            href="#"
                            className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                            {item}
                        </a>
                    ))}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="pointer-events-auto"
                >
                    <button className="px-5 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm font-semibold">
                        Login
                    </button>
                </motion.div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-4 py-1.5 rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/5 text-[#2dd4bf] text-[10px] font-black uppercase tracking-[0.2em] mb-8"
                >
                    Now in Private Beta
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8"
                >
                    UNDERSTAND CODE <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2dd4bf] via-[#00f2ff] to-[#a855f7]">LIKE AN AI.</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 font-medium"
                >
                    Neuro-Symbolic code analysis that maps your technical debt,
                    unpacks complex logic, and builds a semantic understanding of your entire codebase.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col sm:flex-row gap-4 mb-20"
                >
                    <button
                        onClick={handleLaunch}
                        className="group px-8 py-4 rounded-2xl bg-white text-[#0a0e14] font-bold flex items-center gap-2 hover:bg-[#2dd4bf] transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[#2dd4bf]/20 hover:scale-105 active:scale-95"
                    >
                        Launch Explorer
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <a
                        href={EXTERNAL_URLS.YOUTUBE_DEMO}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold flex items-center gap-2 hover:scale-105 active:scale-95 backdrop-blur-sm text-white"
                    >
                        Watch Demo
                        <Play className="w-4 h-4 fill-white" />
                    </a>
                </motion.div>

                {/* Dashboard Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, type: "spring", damping: 20 }}
                    className="relative w-full max-w-5xl group"
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2dd4bf]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-[60px]" />

                    <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-3 overflow-hidden">
                        <div className="w-full aspect-video rounded-2xl bg-[#0f172a] overflow-hidden flex items-center justify-center border border-white/5 relative">
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url('${EXTERNAL_URLS.NOISE_SVG}')` }} pointer-events-none />
                            <div className="flex flex-col items-center gap-4">
                                <Cpu className="w-16 h-16 text-[#2dd4bf] animate-pulse" />
                                <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">GCA_SYSTEM_INITIALIZED</span>
                            </div>

                            <div className="absolute top-4 left-4 flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Bento Feature Grid */}
            <section className="px-6 py-32 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                    <div className="space-y-4 text-left">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.9]">
                            Built for <br /> Large Evolution.
                        </h2>
                        <p className="text-slate-400 max-w-md font-medium">
                            Scale your understanding from simple functions to massive distributed systems instantly.
                        </p>
                    </div>

                    <a href="#" className="flex items-center gap-2 text-[#2dd4bf] font-bold group">
                        View full roadmap
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]">
                    {/* Feature 1: Semantic Search */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="md:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] p-8 flex flex-col justify-between group overflow-hidden relative text-left"
                    >
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-[#2dd4bf]/10 blur-[80px] rounded-full group-hover:bg-[#2dd4bf]/20 transition-colors" />

                        <div className="w-12 h-12 rounded-2xl bg-[#2dd4bf]/10 flex items-center justify-center mb-6">
                            <Search className="w-6 h-6 text-[#2dd4bf]" />
                        </div>

                        <div>
                            <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Semantic Context Search</h3>
                            <p className="text-slate-400 font-medium max-w-md text-sm leading-relaxed">
                                Datalog-powered queries combined with vector similarity. Find exactly what happens in your code, not just literal strings.
                            </p>
                        </div>
                    </motion.div>

                    {/* Feature 2: Metrics */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] p-8 flex flex-col justify-between bg-gradient-to-br from-[#a855f7]/10 to-transparent text-left"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-[#a855f7]/10 flex items-center justify-center mb-6">
                            <BarChart3 className="w-6 h-6 text-[#a855f7]" />
                        </div>

                        <div>
                            <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Entropy Diagnosis</h3>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed">
                                Real-time risk indexing based on churn, complexity, and coverage.
                            </p>
                        </div>
                    </motion.div>

                    {/* Feature 3: Architecture */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] p-8 flex flex-col justify-between text-left"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-[#00f2ff]/10 flex items-center justify-center mb-6">
                            <GitBranch className="w-6 h-6 text-[#00f2ff]" />
                        </div>

                        <div>
                            <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Backbone Mapping</h3>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed">
                                Visualize hierarchical cross-file dependencies automatically.
                            </p>
                        </div>
                    </motion.div>

                    {/* Feature 4: AI Narrative */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="md:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] p-8 flex flex-col justify-between group relative overflow-hidden text-left"
                    >
                        <div className="absolute bottom-[-10%] left-[20%] w-80 h-32 bg-white/5 blur-3xl rounded-full" />

                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                            <Zap className="w-6 h-6 text-white" />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">AI Narrative Mode</h3>
                                <p className="text-slate-400 font-medium max-w-md text-sm leading-relaxed">
                                    Interactive logic explanation. The AI doesn't just read the code—it narrates the execution flow for you.
                                </p>
                            </div>
                            <div className="shrink-0 flex -space-x-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0a0e14] bg-slate-800 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-6 py-20 border-t border-white/5 text-center">
                <div className="max-w-7xl mx-auto flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-8 opacity-50 grayscale hover:grayscale-0 transition-all cursor-pointer">
                        <Cpu className="w-6 h-6 text-[#2dd4bf]" />
                        <span className="text-lg font-black uppercase tracking-tighter">GCA</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">
                        &copy; 2026 GCA Platform. All rights reserved. <br />
                        Crafted with Neuro-Symbolic Logic.
                    </p>
                </div>
            </footer>
        </div>
    );
};
