"use client"
import { useState, useEffect, useCallback } from "react"
import { Brain, Play, RefreshCw, CheckCircle, Shield, BarChart2, FileText, TrendingUp, Filter, List, X } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { MetricCard, ModelTable, ConfusionMatrix, RocCurves, MetricComparisonChart, ScoreDistributionChart, COLORS_MODEL, RISK_COLORS, TIP, apiFetch } from "./MLHelpers"


// ── Main Component ─────────────────────────────────────────────────────────────
export function MLSection() {
  const [status, setStatus]     = useState<"idle"|"running"|"done"|"error">("idle")
  const [results, setResults]   = useState<any>(null)
  
  // Feature selection state
  const [featuresInfo, setFeaturesInfo] = useState<any[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  
  // Dashboard state
  const [activeTab, setActiveTab] = useState<"overview"|"models"|"shap"|"scoring">("overview")
  const [riskFilter, setRiskFilter] = useState<string>("all")
  const [scoringData, setScoringData] = useState<any>(null)
  const [scoringPage, setScoringPage] = useState(1)
  
  // Individual report modal
  const [selectedContract, setSelectedContract] = useState<string|null>(null)
  const [contractReport, setContractReport]     = useState<any>(null)
  const [loadingReport, setLoadingReport]       = useState(false)

  const [error, setError]       = useState<string|null>(null)
  const [loading, setLoading]   = useState(false)

  const fmtMoney = (v: number|null) => v != null ? new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(v) : "—"

  // 1. Check if pipeline is running or done
  const fetchStatus = useCallback(async () => {
    try {
      const d = await apiFetch("/api/ml/status")
      setStatus(d.status || "idle")
      if (d.status === "done") fetchResults()
      if (d.status === "idle") fetchFeaturesInfo()
    } catch {}
  }, [])

  // 2. Fetch feature info for selection (before running)
  const fetchFeaturesInfo = async () => {
    try {
      const d = await apiFetch("/api/ml/features-info")
      if (d.features) {
        setFeaturesInfo(d.features)
        setSelectedFeatures(d.features.filter((f: any) => f.recommended).map((f: any) => f.name))
      }
    } catch {}
  }

  // 3. Fetch results when done
  const fetchResults = useCallback(async () => {
    try {
      const d = await apiFetch("/api/ml/results")
      if (!d.error) { setResults(d); setStatus("done") }
    } catch {}
  }, [])

  // 4. Fetch scoring data
  const fetchScoring = useCallback(async (page = 1, risk = "all") => {
    const params = new URLSearchParams({ page: String(page), per_page: "30" })
    if (risk !== "all") params.set("risque", risk)
    try {
      const d = await apiFetch(`/api/ml/scoring?${params}`)
      setScoringData(d)
    } catch {}
  }, [])

  // 5. Fetch individual contract report
  const fetchContractReport = async (id: string) => {
    setSelectedContract(id)
    setLoadingReport(true)
    setContractReport(null)
    try {
      const d = await apiFetch(`/api/ml/contract/${id}`)
      if (!d.error) setContractReport(d.explanation)
    } catch {}
    setLoadingReport(false)
  }

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (status !== "running") return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [status, fetchStatus])

  useEffect(() => {
    if (activeTab === "scoring" && status === "done") fetchScoring(scoringPage, riskFilter)
  }, [activeTab, scoringPage, riskFilter, status, fetchScoring])

  const handleRun = async () => {
    setLoading(true); setError(null)
    try {
      await apiFetch("/api/ml/run", { 
        method: "POST",
        body: JSON.stringify({ selected_features: selectedFeatures })
      })
      setShowConfigModal(false)
      setStatus("running")
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const handleOpenConfig = async () => {
    setShowConfigModal(true)
    if (featuresInfo.length === 0) {
      await fetchFeaturesInfo()
    }
  }

  const toggleFeature = (name: string) => {
    setSelectedFeatures(prev => 
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    )
  }

  const tabs = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart2 },
    { id: "models",   label: "Modèles",        icon: TrendingUp },
    { id: "shap",     label: "Analyse SHAP",   icon: Brain },
    { id: "scoring",  label: "Scoring PM",     icon: Shield },
  ]

  const fmtPct = (v: number|null) => v != null ? (v * 100).toFixed(1) + "%" : "—"

  // ── Idle / Feature Selection screen ──────────────────────────────────────────────────────
  if (status === "idle" && !results && !showConfigModal) return (
    <div className="space-y-6">
      <div className="relative rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0a0f1e 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 15% 50%,rgba(99,102,241,0.25) 0%,transparent 50%),radial-gradient(circle at 85% 20%,rgba(139,92,246,0.2) 0%,transparent 40%)" }} />
        <div className="relative px-10 py-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-[#acc936]/30 blur-xl animate-pulse" />
              <div className="relative p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Brain className="h-14 w-14 text-[#acc936]" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Configuration Machine Learning</h2>
            <p className="text-slate-400 text-sm mt-2 tracking-widest uppercase">Aucune analyse existante</p>
          </div>
          <div className="mt-8 flex justify-center">
            <button onClick={handleOpenConfig}
              className="inline-flex items-center gap-2 bg-[#acc936] hover:bg-[#bdd944] text-[#093215] font-bold px-10 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl">
              <Play className="h-5 w-5" />
              Démarrer l'Analyse ML
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Running screen ──────────────────────────────────────────────────────────
  if (status === "running") return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#acc936]/30 blur-xl animate-ping" />
        <div className="relative p-6 bg-[#093215] rounded-full">
          <Brain className="h-12 w-12 text-[#acc936] animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-[#093215]">Pipeline ML en cours d'exécution…</h3>
        <p className="text-sm text-slate-500">Entraînement de 3 modèles · Optimisation · SHAP Individuel · Scoring PM N+1</p>
        <p className="text-xs text-slate-400">Cette opération complète peut prendre 2 à 5 minutes.</p>
      </div>
      <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#093215] to-[#acc936] animate-pulse rounded-full" style={{ width: "70%" }} />
      </div>
    </div>
  )

  // ── Done — full report ──────────────────────────────────────────────────────
  if (!results) return (
    <div className="text-center py-12 text-slate-400">
      <RefreshCw className="h-8 w-8 mx-auto mb-3" />
      <button onClick={fetchResults} className="text-[#19542b] underline text-sm">Charger les résultats</button>
    </div>
  )

  const bestName = results.best_model || ""
  const metrics  = results.metrics   || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg,#0f172a,#1e1b4b)" }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-7 w-7 text-[#acc936]" />
            <div>
              <h2 className="text-lg font-bold">Rapport d'Analyse Machine Learning</h2>
              <p className="text-slate-400 text-xs">Modèle performant retenu : <span className="text-[#acc936] font-bold">{bestName}</span></p>
            </div>
          </div>
          <button onClick={handleOpenConfig}
            className="flex items-center gap-2 text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> Nouvelle Analyse
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === t.id ? "bg-white shadow text-[#093215]" : "text-slate-400 hover:text-slate-600"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ───────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Charge Estimée Principale */}
          <div className="bg-gradient-to-r from-rose-500 to-red-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-rose-100 mb-1">Charge Estimée (Sortie de capitaux à l'horizon N+1)</p>
                <h3 className="text-4xl font-black">{fmtMoney(results.scoring_summary?.charge_estimee || 0)}</h3>
                <p className="text-xs text-rose-200 mt-2">Projection basée sur {results.scoring_summary?.risque_eleve || 0} contrats dont la probabilité de rachat dépasse 50%.</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Scoring summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Sortie Probable (≥50%)", val: results.scoring_summary?.risque_eleve,  color: "rose" },
              { label: "Risque Modéré (20-50%)", val: results.scoring_summary?.risque_modere, color: "amber" },
              { label: "Maintien Assuré (<20%)", val: results.scoring_summary?.risque_faible, color: "emerald" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-5 text-center shadow-sm">
                <div className={`text-3xl font-bold text-${s.color}-600`}>{(s.val || 0).toLocaleString("fr-FR")}</div>
                <div className="text-[10px] text-slate-400 uppercase mt-1 font-bold">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Rapport explicatif */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-[#19542b]" />
              <h3 className="text-sm font-bold text-[#093215]">Rapport d'Analyse Synthétique</h3>
            </div>
            {[
              { title: "Performance du Modèle", content: `L'algorithme ${bestName} s'est avéré le plus performant avec un AUC de ${((metrics[bestName]?.auc || 0) * 100).toFixed(2)}%. Il a été sélectionné pour évaluer l'intégralité du portefeuille PM.` },
              { title: "Indicateurs de Risque", content: `La corrélation montre que des variables telles que ${(results.correlations || []).slice(0, 3).map((c: any) => c.variable).join(", ")} influencent fortement la décision de rachat.` },
              { title: "Alerte de Sortie de Capitaux", content: `Attention : la charge estimée (montants exposés) s'élève à ${fmtMoney(results.scoring_summary?.charge_estimee || 0)}, concentrée sur ${results.scoring_summary?.risque_eleve || 0} contrats présentant une probabilité critique de rachat l'année prochaine.` },
            ].map(r => (
              <div key={r.title} className="border-l-4 border-[#acc936] pl-4 py-1">
                <div className="text-xs font-bold text-[#093215]">{r.title}</div>
                <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{r.content}</div>
              </div>
            ))}
          </div>

          {/* Graphique de distribution des scores */}
          {results.scoring_summary?.distribution && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#093215] mb-4">Distribution des Scores (Probabilité N+1)</h3>
              <ScoreDistributionChart distribution={results.scoring_summary.distribution} />
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Modèles ────────────────────────────────────────────────── */}
      {activeTab === "models" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#093215] mb-4">Comparaison des Métriques Clés</h3>
              <MetricComparisonChart metrics={metrics} />
            </div>
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#093215] mb-4">Courbes ROC (Rapport Vrai/Faux Positif)</h3>
              <RocCurves metrics={metrics} />
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#093215] mb-4">Tableau Détail des Performances</h3>
            <ModelTable metrics={metrics} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(metrics).map(([name, m]: [string, any]) => (
              <div key={name} className="bg-white rounded-xl border p-4 shadow-sm">
                <h4 className="text-xs font-bold mb-3 text-center" style={{ color: COLORS_MODEL[name] }}>{name}</h4>
                <ConfusionMatrix cm={m.confusion_matrix || [[0,0],[0,0]]} modelName={name} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: SHAP ───────────────────────────────────────────────────── */}
      {activeTab === "shap" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#093215] mb-1">Impact Global des Variables (SHAP) — {bestName}</h3>
            <p className="text-xs text-slate-400 mb-4">Variables dictant la logique du modèle à l'échelle du portefeuille.</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={[...(results.shap_summary || [])].reverse()} layout="vertical" margin={{ left: 120, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={v => v.toFixed(3)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="variable" tick={{ fontSize: 10 }} width={115} />
                <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} formatter={(v: any) => [v.toFixed(4), "Poids SHAP"]} />
                <Bar dataKey="shap_mean" radius={[0, 4, 4, 0]}>
                  {(results.shap_summary || []).map((d: any, i: number) => (
                    <Cell key={i} fill={d.direction === "positif" ? "#f43f5e" : "#19542b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-[10px] text-slate-400 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#f43f5e] inline-block" /> Impact positif (pousse vers le rachat)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#19542b] inline-block" /> Impact négatif (sécurise le contrat)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Scoring PM ─────────────────────────────────────────────── */}
      {activeTab === "scoring" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["all", "Élevé", "Modéré", "Faible"].map(r => (
              <button key={r} onClick={() => { setRiskFilter(r); setScoringPage(1) }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${riskFilter === r
                  ? r === "Élevé" ? "bg-rose-500 text-white" : r === "Modéré" ? "bg-amber-500 text-white" : r === "Faible" ? "bg-emerald-600 text-white" : "bg-[#093215] text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>
                {r === "all" ? "Tous les contrats PM" : r}
                {r !== "all" && ` (${results.scoring_summary?.[`risque_${r === "Élevé" ? "eleve" : r === "Modéré" ? "modere" : "faible"}`] || 0})`}
              </button>
            ))}
          </div>

          {scoringData ? (
            <>
              <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">ID Contrat</th>
                      <th className="text-center py-3 px-4 text-slate-500 font-medium">Probabilité (Année N+1)</th>
                      <th className="text-right py-3 px-4 text-slate-500 font-medium">Charge Estimée (Capitaux)</th>
                      <th className="text-center py-3 px-4 text-slate-500 font-medium">Niveau de Risque</th>
                      <th className="text-center py-3 px-4 text-slate-500 font-medium">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(scoringData.data || []).map((row: any, i: number) => (
                      <tr key={i} onClick={() => fetchContractReport(row["ID_Police"])} className={`border-b border-slate-50 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-100`}>
                        <td className="py-3 px-4 font-mono text-[#093215] font-bold">{row["ID_Police"]}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold" style={{ color: row["Proba_N+1"] >= 50 ? "#f43f5e" : "#19542b" }}>{row["Proba_N+1"]}%</td>
                        <td className="py-3 px-4 text-right font-mono">{fmtMoney(row["Charge_Finale"])}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: RISK_COLORS[row["Risque"]] + "15", color: RISK_COLORS[row["Risque"]] }}>
                            {row["Risque"]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[#acc936] text-[10px] uppercase font-bold tracking-wider hover:underline">Analyser →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{scoringData.total?.toLocaleString("fr-FR")} contrats</span>
                <div className="flex gap-2">
                  <button onClick={() => setScoringPage(p => Math.max(1, p - 1))} disabled={scoringPage <= 1} className="px-3 py-1 rounded border hover:bg-slate-50 disabled:opacity-40">← Préc.</button>
                  <span className="px-3 py-1 font-bold">Page {scoringPage} / {scoringData.pages}</span>
                  <button onClick={() => setScoringPage(p => Math.min(scoringData.pages, p + 1))} disabled={scoringPage >= scoringData.pages} className="px-3 py-1 rounded border hover:bg-slate-50 disabled:opacity-40">Suiv. →</button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">Chargement du scoring…</div>
          )}
        </div>
      )}

      {/* ── Modal Rapport Individuel ───────────────────────────────────────── */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#093215] p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#acc936]" /> Rapport Individualisé : {selectedContract}</h3>
              <button onClick={() => setSelectedContract(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              {loadingReport ? (
                <div className="text-center py-10 text-slate-400 text-sm animate-pulse">Génération de l'explication SHAP…</div>
              ) : !contractReport ? (
                <div className="text-center py-10 text-rose-500 text-sm">Impossible de charger le rapport pour ce contrat.</div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Probabilité de Rachat (N+1)</p>
                    <div className={`text-5xl font-black ${(contractReport.proba * 100) >= 50 ? "text-rose-500" : "text-[#19542b]"}`}>
                      {(contractReport.proba * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Facteurs de risque */}
                    <div className="border border-rose-100 rounded-xl bg-rose-50/50 p-4">
                      <h4 className="text-xs font-bold text-rose-700 mb-3 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Facteurs aggravants</h4>
                      <ul className="space-y-2">
                        {(contractReport.top_positive || []).map((f: any, i: number) => (
                          <li key={i} className="flex justify-between text-xs">
                            <span className="font-medium text-slate-700">{f.feature}</span>
                            <span className="text-rose-600 font-bold">+{f.value.toFixed(3)}</span>
                          </li>
                        ))}
                        {(!contractReport.top_positive || contractReport.top_positive.length === 0) && <li className="text-xs text-slate-400">Aucun facteur majeur identifié.</li>}
                      </ul>
                    </div>

                    {/* Facteurs protecteurs */}
                    <div className="border border-emerald-100 rounded-xl bg-emerald-50/50 p-4">
                      <h4 className="text-xs font-bold text-emerald-700 mb-3 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Facteurs protecteurs</h4>
                      <ul className="space-y-2">
                        {(contractReport.top_negative || []).map((f: any, i: number) => (
                          <li key={i} className="flex justify-between text-xs">
                            <span className="font-medium text-slate-700">{f.feature}</span>
                            <span className="text-emerald-600 font-bold">{f.value.toFixed(3)}</span>
                          </li>
                        ))}
                        {(!contractReport.top_negative || contractReport.top_negative.length === 0) && <li className="text-xs text-slate-400">Aucun facteur majeur identifié.</li>}
                      </ul>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 text-center italic mt-4">
                    Ces valeurs (SHAP) représentent l'impact marginal de chaque variable spécifique à ce contrat pour faire monter ou descendre sa probabilité de rachat.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Configuration (Feature Selection) ─────────────────────── */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#093215] p-5 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Filter className="w-5 h-5 text-[#acc936]" /> Configuration de l'Analyse ML</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              <p className="text-slate-500 text-sm mb-6">
                Sélectionnez les variables à inclure dans l'entraînement. Celles ayant une corrélation (positive ou négative) supérieure à 5% avec le rachat sont recommandées et pré-cochées.
              </p>

              {featuresInfo.length === 0 ? (
                <div className="text-center py-12 text-slate-400"><RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" /> Chargement des variables...</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">{selectedFeatures.length} variables sélectionnées</span>
                    <button onClick={() => setSelectedFeatures(featuresInfo.map(f => f.name))} className="text-xs text-[#19542b] font-bold hover:underline">Tout sélectionner</button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {featuresInfo.map(f => (
                      <label key={f.name} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedFeatures.includes(f.name) ? "border-[#acc936] bg-[#acc936]/5" : "border-slate-200 hover:border-slate-300"}`}>
                        <input type="checkbox" checked={selectedFeatures.includes(f.name)} onChange={() => toggleFeature(f.name)} className="w-4 h-4 text-[#19542b] rounded focus:ring-[#acc936]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#093215] truncate" title={f.name}>{f.name}</div>
                          <div className={`text-[10px] ${f.recommended ? "text-[#f43f5e] font-bold" : "text-slate-400"}`}>
                            Corr: {(f.correlation * 100).toFixed(1)}%
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => setShowConfigModal(false)} className="px-6 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                      Annuler
                    </button>
                    <button onClick={handleRun} disabled={loading || selectedFeatures.length === 0}
                      className="inline-flex items-center gap-2 bg-[#acc936] hover:bg-[#bdd944] text-[#093215] font-bold px-8 py-2 rounded-xl transition-all shadow hover:shadow-md disabled:opacity-50">
                      <Play className="h-4 w-4" />
                      {loading ? "Lancement en cours…" : "Lancer l'entraînement"}
                    </button>
                  </div>
                  {error && <p className="text-red-500 text-sm mt-3 text-right">{error}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
