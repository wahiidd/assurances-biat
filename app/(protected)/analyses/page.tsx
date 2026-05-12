"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getKpisApi } from "@/lib/api/analytics.api"
import { BarChart as BarChartIcon, Users, Calendar, TrendingUp, PieChart as PieChartIcon, Activity, MapPin, Building2, Wallet, Anchor, AlertTriangle, ArrowRight, ShieldAlert, BadgeCent, ArrowLeft, LogOut, FileText, Bell, HelpCircle, User as UserIcon, LayoutDashboard, Crown, Target, Zap, Clock, Filter, X, Brain } from "lucide-react"
import { MLSection } from "./components/MLSection"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────

interface KpiData {
  meta: {
    nb_total_polices: number
    fichier: string
    villes_disponibles?: string[]
    annees_disponibles?: number[]
    types_versement_disponibles?: string[]
    montant_range?: { min: number | null; max: number | null }
  }
  demographique:    DemographiqueKpi
  temporelle:       TemporelleKpi
  financiere:       FinanciereKpi
  comportementale:  ComportementaleKpi
  epargne_rachat?:  EpargneRachatKpi
}

interface DemographiqueKpi {
  age_moyen_souscription:  number | null
  age_min_souscription:    number | null
  age_max_souscription:    number | null
  distribution_age:        { tranche: string; nb: number }[]
  densite_par_zone:        { code_postal: string; nb_contrats: number }[]
  valeur_par_ville:        { ville: string; montant_total: number; nb_contrats: number }[]
}

interface TemporelleKpi {
  taux_maturite_moyen:     number | null
  distribution_maturite:   { tranche: string; nb: number }[]
  recrutement_annuel:      { annee: number; nb_polices: number }[]
  indice_stabilite:        number | null
  stabilite_label:         string
  distribution_anciennete: { tranche: string; nb: number }[]
}

interface FinanciereKpi {
  taux_chargement_global:      number | null
  total_charges:               number | null
  total_encours_estime:        number | null
  comparaison_rachat: {
    avec: { total: number; nb: number; distribution: { label: string; nb: number; total?: number }[] }
    sans: { total: number; nb: number; distribution: { label: string; nb: number; total?: number }[] }
  }
}

interface ComportementaleKpi {
  taux_churn:                number | null
  nb_rachats:                number
  preference_type_versement: { type: string; nb: number; pct: number }[]
  distribution_frequence:    { frequence: string; nb: number; pct: number }[]
  indice_vulnerabilite:      number | null
  pct_rachets_precoces:      number | null
  nb_contrats_vulnerables:   number
  rachat_par_anciennete:     { tranche: string; nb_contrats: number; taux_rachat: number | null }[]
}

interface EpargneRachatKpi {
  epargne_par_annee: {
    annee: number
    montant_initial_moyen?: number | null
    montant_initial_total?: number | null
    montant_regulier_moyen?: number | null
    taux_rachat?: number | null
    nb_rachats?: number | null
    nb_contrats?: number | null
  }[]
  montant_vs_rachat: { tranche: string; taux_rachat: number | null; nb_contrats: number }[]
  epargne_par_type:  { type: string; montant_moyen: number | null; nb_contrats: number; taux_rachat: number | null }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v == null ? "—" : Number(v).toFixed(decimals)

const fmtPct = (v: number | null | undefined): string =>
  v == null ? "—" : `${Number(v).toFixed(1)} %`

const fmtMoney = (v: number | null | undefined): string => {
  if (v == null) return "—"
  return new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(v)
}

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"]
const BAR_COLOR  = "#6366f1"

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "10px",
  color: "#f8fafc",
  fontSize: "13px",
  padding: "8px 12px",
}

// ── YearRangeSlider ───────────────────────────────────────────────────────────


function YearRangeSlider({
  min, max, value, onChange,
}: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <div className="px-1 py-1">
      <div className="flex justify-between text-xs font-mono mb-2">
        <span className="bg-[#093215] text-[#acc936] px-2 py-0.5 rounded font-bold">{value[0]}</span>
        <span className="text-slate-400 text-[10px] self-center">glisser pour filtrer</span>
        <span className="bg-[#093215] text-[#acc936] px-2 py-0.5 rounded font-bold">{value[1]}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none"
          style={{
            background: "linear-gradient(90deg,#19542b,#acc936)",
            left: `${pct(value[0])}%`,
            right: `${100 - pct(value[1])}%`,
          }}
        />
        <input type="range" min={min} max={max} value={value[0]}
          onChange={e => onChange([Math.min(+e.target.value, value[1] - 1), value[1]])}
          className="yr-thumb absolute w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: value[0] > (max - min) / 2 + min ? 5 : 3 }}
        />
        <input type="range" min={min} max={max} value={value[1]}
          onChange={e => onChange([value[0], Math.max(+e.target.value, value[0] + 1)])}
          className="yr-thumb absolute w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: value[1] < (max - min) / 2 + min ? 5 : 4 }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{min}</span>
        <span className="font-semibold text-[#19542b]">{value[0]} – {value[1]}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ── Composants réutilisables ──────────────────────────────────────────────────

function KpiCard({
  label, value, subtitle, color = "indigo", icon: Icon,
}: {
  label: string; value: string; subtitle?: string; color?: string; icon: any
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide text-right flex-1 ml-3 leading-tight">{label}</span>
      </div>
      <div>
        <div className="text-3xl font-bold text-[#093215] mb-1">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, gradient }: { title: string; subtitle: string; gradient: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} p-6 mb-6`}>
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      <p className="text-sm text-white/80">{subtitle}</p>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AnalysesPage() {
  const { user, isAdmin, isLoading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [kpis, setKpis]       = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<"demo" | "temp" | "fin" | "comp" | "epargne" | "ml">("demo")
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Interactive filter state
  const [yearRange, setYearRange]         = useState<[number, number] | null>(null)
  const [typeVersement, setTypeVersement] = useState("")
  const [villeFilter, setVilleFilter]     = useState("")
  const [montantMin, setMontantMin]       = useState("")
  const [montantMax, setMontantMax]       = useState("")
  const [showFilterPanel, setShowFilterPanel] = useState(true)
  const [finDistMode, setFinDistMode]     = useState<"nb" | "total">("nb")

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) { router.replace("/admin"); return }
    loadKpis(filters)
  }, [authLoading, isAdmin, filters])

  // Init yearRange from meta once loaded
  useEffect(() => {
    if (kpis?.meta.annees_disponibles?.length && !yearRange) {
      const y = kpis.meta.annees_disponibles
      setYearRange([y[0], y[y.length - 1]])
    }
  }, [kpis?.meta.annees_disponibles])

  function applyFilters() {
    const f: Record<string, string> = {}
    if (villeFilter)     f.ville           = villeFilter
    if (typeVersement)   f.type_versement  = typeVersement
    if (yearRange && kpis?.meta.annees_disponibles) {
      const y = kpis.meta.annees_disponibles
      if (yearRange[0] !== y[0])            f.annee_min = String(yearRange[0])
      if (yearRange[1] !== y[y.length - 1]) f.annee_max = String(yearRange[1])
    }
    if (montantMin) f.montant_min = montantMin
    if (montantMax) f.montant_max = montantMax
    setFilters(f)
  }

  function resetFilters() {
    setVilleFilter(""); setTypeVersement(""); setMontantMin(""); setMontantMax("")
    if (kpis?.meta.annees_disponibles) {
      const y = kpis.meta.annees_disponibles
      setYearRange([y[0], y[y.length - 1]])
    }
    setFilters({})
  }

  async function loadKpis(activeFilters?: Record<string, string>) {
    setLoading(true)
    setError(null)
    try {
      const { data, ok } = await getKpisApi(activeFilters)
      if (ok) setKpis(data)
      else setError(data.error ?? "Erreur inconnue")
    } catch {
      setError("Impossible de contacter le serveur")
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#e0e1e1] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Calcul des KPIs en cours…</p>
        </div>
      </div>
    )
  }

  if (error) {
    const is403 = error.toLowerCase().includes("administrateur") ||
                  error.toLowerCase().includes("admin") ||
                  error.toLowerCase().includes("403")
    return (
      <div className="min-h-screen bg-[#e0e1e1] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-rose-950/30 border border-rose-500/30 rounded-2xl p-8 text-center space-y-4">
          <div className="flex justify-center mb-4">
            {is403 ? <ShieldAlert className="w-16 h-16 text-rose-500" /> : <FileText className="w-16 h-16 text-rose-500" />}
          </div>
          <h2 className="text-xl font-bold text-rose-700">
            {is403 ? "Accès non autorisé" : "Données non disponibles"}
          </h2>
          <p className="text-slate-400 text-sm">{error}</p>
          {is403 ? (
            <button
              onClick={() => { logout(); router.push("/login") }}
              className="mt-4 px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition"
            >
              Se reconnecter
            </button>
          ) : (
            <div className="space-x-3">
              <button
                onClick={() => setFilters({})}
                className="mt-4 px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition"
              >
                Réinitialiser les filtres
              </button>
              <button
                onClick={() => loadKpis(filters)}
                className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!kpis) return null

  const { meta, demographique: D, temporelle: T, financiere: F, comportementale: C } = kpis

  const tabs = [
    { id: "demo"    as const, label: "Démographique",    icon: Users,          color: "border-[#19542b] text-[#093215]" },
    { id: "temp"    as const, label: "Temporelle",       icon: Calendar,       color: "border-[#19542b] text-[#093215]" },
    { id: "fin"     as const, label: "Financière",       icon: Target,         color: "border-[#19542b] text-[#093215]" },
    { id: "comp"    as const, label: "Comportementale",  icon: Activity,       color: "border-[#19542b] text-[#093215]" },
    { id: "epargne" as const, label: "Épargne & Rachat", icon: TrendingUp,      color: "border-emerald-600 text-emerald-700" },
    { id: "ml"      as const, label: "Machine Learning", icon: Brain,           color: "border-violet-600 text-violet-700" },
  ]

  const ER = kpis.epargne_rachat

  return (
    <div className="min-h-screen bg-[#e0e1e1] text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-[#093215] shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/images/logo-assurances-biat.jpg"
              alt="Assurances BIAT"
              width={160}
              height={44}
              className="h-11 w-auto object-contain bg-white rounded-md px-2 py-1 shadow-sm"
              priority
            />
          </div>

          <nav className="hidden md:flex items-center gap-2 lg:gap-4">
            {isAdmin && (
              <Button
                variant="ghost"
                className="text-white hover:text-white hover:bg-white/20 gap-2 font-semibold"
                onClick={() => router.push("/admin")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Administration
              </Button>
            )}
            <Button variant="ghost" className="text-[#acc936] hover:text-[#acc936] hover:bg-white/20 gap-2 font-medium">
              <BarChartIcon className="h-4 w-4" />
              Analyses
            </Button>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/20 gap-2 font-medium">
              <Bell className="h-4 w-4" />
              Notifications
            </Button>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/20 gap-2 font-medium">
              <HelpCircle className="h-4 w-4" />
              Aide
            </Button>
          </nav>

          <div className="flex items-center justify-end gap-4 min-w-[150px]">
            <div className="hidden sm:block text-right">
              <p className="text-white text-sm font-semibold">{user?.full_name}</p>
              <p className="text-white/80 text-xs">{user?.email}</p>
            </div>
            <Button
              onClick={() => { logout(); router.push("/login") }}
              className="bg-white text-[#093215] hover:bg-[#e0e1e1] font-semibold gap-2 border-0 shadow-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Global Stats bar below header */}
        <div className="bg-white border-b border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#19542b]" />
              <h1 className="font-bold text-[#093215] text-base">Tableau de bord KPIs</h1>
              <span className="text-muted-foreground ml-2 hidden sm:inline">Source : <span className="font-mono bg-muted px-1 rounded">{meta.fichier}</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">Total polices</span>
                <span className="font-bold text-[#19542b]">{meta.nb_total_polices.toLocaleString("fr-FR")}</span>
              </div>
              <div className="h-8 w-px bg-border"></div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">Taux de churn</span>
                <span className="font-bold text-rose-600">{fmtPct(C.taux_churn != null ? C.taux_churn * 100 : null)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── PANNEAU FILTRES INTERACTIFS ─── */}
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-6">
            {/* Toggle header */}
            <div className="flex items-center justify-between py-2">
              <button
                onClick={() => setShowFilterPanel(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-[#093215] hover:text-[#19542b] transition"
              >
                <Filter className="h-4 w-4" />
                Filtres &amp; Période
                {Object.keys(filters).length > 0 && (
                  <span className="bg-[#093215] text-[#acc936] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {Object.keys(filters).length}
                  </span>
                )}
                <span className="text-slate-400 text-xs">{showFilterPanel ? "▲" : "▼"}</span>
              </button>
              <div className="flex items-center gap-2">
                {/* Active chips */}
                {filters.ville && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#19542b]/10 text-[#19542b] border border-[#19542b]/20 rounded-full text-xs font-semibold">
                    Ville : {filters.ville}
                    <button onClick={() => setFilters(f => { const n={...f}; delete n.ville; return n })} className="hover:text-rose-500"><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filters.type_versement && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">
                    Type : {filters.type_versement}
                    <button onClick={() => setFilters(f => { const n={...f}; delete n.type_versement; return n })} className="hover:text-rose-500"><X className="h-3 w-3" /></button>
                  </span>
                )}
                {(filters.annee_min || filters.annee_max) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                    <Calendar className="h-3 w-3" /> {filters.annee_min ?? "…"} – {filters.annee_max ?? "…"}
                    <button onClick={() => setFilters(f => { const n={...f}; delete n.annee_min; delete n.annee_max; return n })} className="hover:text-rose-500"><X className="h-3 w-3" /></button>
                  </span>
                )}
                {Object.keys(filters).length > 0 && (
                  <button onClick={resetFilters} className="text-rose-500 hover:bg-rose-50 px-2 py-1 rounded text-xs flex items-center gap-1 font-medium transition">
                    <X className="h-3 w-3" /> Tout réinitialiser
                  </button>
                )}
              </div>
            </div>

            {/* Filter panel body */}
            {showFilterPanel && (
              <div className="pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-3">

                {/* Year range */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-semibold text-[#093215] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#19542b]" /> Période
                  </p>
                  {kpis?.meta.annees_disponibles && kpis.meta.annees_disponibles.length >= 2 && yearRange ? (
                    <YearRangeSlider
                      min={kpis.meta.annees_disponibles[0]}
                      max={kpis.meta.annees_disponibles[kpis.meta.annees_disponibles.length - 1]}
                      value={yearRange}
                      onChange={setYearRange}
                    />
                  ) : (
                    <p className="text-xs text-slate-400">Chargement…</p>
                  )}
                </div>

                {/* Type versement */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-semibold text-[#093215] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-[#19542b]" /> Type de contrat
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", ...(kpis?.meta.types_versement_disponibles ?? [])].map(t => (
                      <button key={t || "all"} onClick={() => setTypeVersement(t)}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                          typeVersement === t
                            ? "bg-[#093215] text-white border-[#093215] shadow"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#19542b] hover:text-[#093215]"
                        }`}
                      >
                        {t || "Tous"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ville */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-semibold text-[#093215] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[#19542b]" /> Ville
                  </p>
                  <select value={villeFilter} onChange={e => setVilleFilter(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#19542b] cursor-pointer">
                    <option value="">Toutes les villes</option>
                    {(kpis?.meta.villes_disponibles ?? []).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                {/* Montant + Apply */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-semibold text-[#093215] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-[#19542b]" /> Montant initial (TND)
                  </p>
                  <div className="flex gap-1.5 mb-3">
                    <input type="number" placeholder="Min" value={montantMin} onChange={e => setMontantMin(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#19542b]" />
                    <input type="number" placeholder="Max" value={montantMax} onChange={e => setMontantMax(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#19542b]" />
                  </div>
                  <button onClick={applyFilters}
                    className="w-full flex items-center justify-center gap-2 bg-[#093215] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#19542b] transition active:scale-95">
                    <Filter className="h-3.5 w-3.5" /> Appliquer les filtres
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 border-b border-border/50 mb-4">
        {/* Tabs - Espace horizontal */}
        <div className="flex flex-wrap items-center gap-4">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 px-6 py-3 text-sm font-semibold rounded-full border transition-all ${
                  isActive
                    ? `bg-[#093215] text-white border-[#093215] shadow-md`
                    : "bg-white text-slate-600 border-slate-200 hover:border-[#19542b] hover:text-[#093215] hover:shadow-sm"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#acc936]" : "text-slate-400"}`} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-6">

        {/* ═══ ONGLET DÉMOGRAPHIQUE ═══ */}
        {tab === "demo" && (
          <div className="space-y-6">
            <SectionHeader
              title="Dimension Démographique"
              subtitle="Comprendre qui sont vos clients les plus rentables selon l'âge et la géographie."
              gradient="from-blue-900/60 to-indigo-900/60"
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                icon={UserIcon} label="Âge moyen souscription" color="blue"
                value={fmt(D.age_moyen_souscription) + " ans"}
                subtitle={`Min ${fmt(D.age_min_souscription)} · Max ${fmt(D.age_max_souscription)} ans`}
              />
              <KpiCard
                icon={MapPin} label="Zones couvertes" color="blue"
                value={D.densite_par_zone.length.toString()}
                subtitle="Codes postaux distincts (top 20)"
              />
              <KpiCard
                icon={Building2} label="Villes avec portefeuille" color="blue"
                value={D.valeur_par_ville.length.toString()}
                subtitle="Classées par montant total"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Distribution âge souscription */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Distribution de l&apos;âge à la souscription
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  Formule : <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">Age − Ancienneté</code>
                  {" "}— Indique si le produit attire les jeunes actifs ou les retraités.
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={D.distribution_age} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                    <Bar dataKey="nb" fill="#3b82f6" name="Contrats" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Valeur par ville */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Valeur client par ville (Top 10)
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  Formule : <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">ΣMontant_Initial par Ville</code>
                  {" "}— Identifier les zones géographiques à fort potentiel.
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={D.valeur_par_ville.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="ville" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: number) => fmtMoney(v)} />
                    <Bar 
                      dataKey="montant_total" 
                      fill="#60a5fa" 
                      name="Montant (TND)" 
                      radius={[0, 4, 4, 0]} 
                      cursor="pointer" 
                      onClick={(data) => {
                        if (data && data.ville) setFilters(f => ({ ...f, ville: data.ville }))
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Densité par code postal */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6 xl:col-span-2">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Densité de portefeuille par Code Postal (Top 20)
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">Nb contrats / Code_Postal</code>
                  {" "}— Identifier les zones sous-exploitées.
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={D.densite_par_zone}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="code_postal" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                    <Bar dataKey="nb_contrats" fill="#818cf8" name="Contrats" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ONGLET TEMPORELLE ═══ */}
        {tab === "temp" && (
          <div className="space-y-6">
            <SectionHeader
              title="Dimension Temporelle"
              subtitle="Analyser la rétention et la maturité des contrats dans le temps."
              gradient="from-violet-900/60 to-purple-900/60"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                icon={Clock} label="Taux de maturité moyen" color="indigo"
                value={fmtPct(T.taux_maturite_moyen != null ? T.taux_maturite_moyen * 100 : null)}
                subtitle="Rapport Ancienneté / Durée prévue"
              />
              <KpiCard
                icon={Anchor} label="Indice de stabilité" color="indigo"
                value={T.indice_stabilite != null ? T.indice_stabilite.toFixed(3) : "—"}
                subtitle={T.stabilite_label}
              />
              <KpiCard
                icon={Calendar} label="Années de recrutement" color="indigo"
                value={T.recrutement_annuel.length.toString()}
                subtitle="Périodes d'activité distinctes"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Recrutement annuel */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Rythme de Recrutement Annuel
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">Nb ID_Police / Annee_Effet</code>
                  {" "}— Identifier les phases de croissance et les creux.
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={T.recrutement_annuel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="annee" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} />
                    <Line type="monotone" dataKey="nb_polices" stroke="#a78bfa" strokeWidth={2.5}
                      dot={{ fill: "#a78bfa", r: 4 }} name="Polices" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Distribution ancienneté */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Distribution de l&apos;Ancienneté
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  Plus l&apos;ancienneté est forte sans rachat, plus le profil client est <span className="text-[#acc936] font-medium">fidèle</span>.
                  Indice de stabilité (corrélation) : <span className="text-[#19542b] font-mono">{T.indice_stabilite?.toFixed(3) ?? "—"}</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={T.distribution_anciennete}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} />
                    <Bar dataKey="nb" fill="#8b5cf6" name="Contrats" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Distribution maturité */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6 xl:col-span-2">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Distribution du Taux de Maturité
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  Formule : <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">Ancienneté / (Fin − Debut) en années</code>
                  {" "}— Ratio proche de 1 = contrat arrivant à terme naturel.
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={T.distribution_maturite}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} />
                    <Bar dataKey="nb" fill="#7c3aed" name="Contrats" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
        )}

        {/* ═══ ONGLET FINANCIÈRE ═══ */}
        {tab === "fin" && (
          <div className="space-y-6">
            {/* Section Header unique */}
            <SectionHeader
              title="Dimension Financière"
              subtitle="Analyse de la valeur du portefeuille et comparaison des comportements de rachat."
              gradient="from-emerald-900/60 to-teal-900/60"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Wallet} label="Encours Estimé (AUM)" color="emerald"
                value={fmtMoney(F.total_encours_estime)}
                subtitle="Capitaux totaux sous gestion"
              />
              <KpiCard
                icon={Zap} label="Frais & Charges" color="rose"
                value={fmtMoney(F.total_charges)}
                subtitle="Somme des frais prélevés"
              />
              <KpiCard
                icon={ShieldAlert} label="Volume Rachat" color="rose"
                value={fmtMoney(F.comparaison_rachat.avec.total)}
                subtitle={`${F.comparaison_rachat.avec.nb} contrats rachetés`}
              />
              <KpiCard
                icon={TrendingUp} label="Ratio de Chargement" color="amber"
                value={fmtPct(F.taux_chargement_global != null ? F.taux_chargement_global * 100 : null)}
                subtitle="Poids des frais sur l'encours"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Volume Financier : Rachat vs Actif */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">Volume Financier : Rachat vs Actif</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Actif", val: F.comparaison_rachat.sans.total, color: "#19542b" },
                        { name: "Rachat", val: F.comparaison_rachat.avec.total, color: "#f43f5e" },
                      ]}
                      margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 13 }} />
                      <YAxis tickFormatter={v => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={CUSTOM_TOOLTIP_STYLE} 
                        itemStyle={{ color: "#fff" }}
                        formatter={(v: number) => [fmtMoney(v), "Montant Initial"]}
                      />
                      <Bar dataKey="val" radius={[8, 8, 0, 0]} barSize={60}>
                        { [0, 1].map((_, i) => <Cell key={i} fill={i===0 ? "#19542b" : "#f43f5e"} />) }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribution Comparée Personnalisable */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#093215]">Distribution par Tranche</h3>
                  <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                    <button 
                      onClick={() => setFinDistMode("nb")}
                      className={`px-3 py-1 text-[10px] rounded-md transition-all ${finDistMode === "nb" ? "bg-white shadow-sm text-[#19542b] font-bold" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      Nb Contrats
                    </button>
                    <button 
                      onClick={() => setFinDistMode("total")}
                      className={`px-3 py-1 text-[10px] rounded-md transition-all ${finDistMode === "total" ? "bg-white shadow-sm text-[#19542b] font-bold" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      Montant
                    </button>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={F.comparaison_rachat.sans.distribution.map((d, i) => {
                        const avec = F.comparaison_rachat.avec.distribution[i];
                        return {
                          range: d.label,
                          Actif: finDistMode === "nb" ? d.nb : (d.total || 0),
                          Rachat: finDistMode === "nb" ? (avec?.nb || 0) : (avec?.total || 0)
                        };
                      })}
                      margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={v => finDistMode === "total" ? `${(v/1000).toFixed(0)}k` : v.toString()} />
                      <Tooltip 
                        contentStyle={CUSTOM_TOOLTIP_STYLE} 
                        itemStyle={{ color: "#fff" }}
                        formatter={(v: number) => finDistMode === "total" ? [fmtMoney(v), "Montant"] : [v, "Contrats"]}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                      <Bar name="Sans Rachat (Actif)" dataKey="Actif" fill="#19542b" radius={[4, 4, 0, 0]} />
                      <Bar name="Avec Rachat" dataKey="Rachat" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ONGLET COMPORTEMENTALE ═══ */}
        {tab === "comp" && (
          <div className="space-y-6">
            <SectionHeader
              title="Dimension Comportementale"
              subtitle="Anticiper le risque de churn et comprendre les préférences des assurés."
              gradient="from-rose-900/60 to-pink-900/60"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Zap} label="Taux de churn" color="rose"
                value={fmtPct(C.taux_churn != null ? C.taux_churn * 100 : null)}
                subtitle={`${C.nb_rachats.toLocaleString("fr-FR")} rachats sur ${meta.nb_total_polices.toLocaleString("fr-FR")} polices`}
              />
              <KpiCard
                icon={ShieldAlert} label="Indice de vulnérabilité" color="rose"
                value={fmtPct(C.indice_vulnerabilite != null ? C.indice_vulnerabilite * 100 : null)}
                subtitle={`${C.nb_contrats_vulnerables} contrats (ancienneté ≤ 3 ans)`}
              />
              <KpiCard
                icon={AlertTriangle} label="Rachets précoces" color="amber"
                value={fmtPct(C.pct_rachets_precoces)}
                subtitle="des rachats survenant avant 3 ans"
              />
              <KpiCard
                icon={FileText} label="Types de versement" color="indigo"
                value={C.preference_type_versement.length.toString()}
                subtitle="catégories distinctes"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Taux de rachat par ancienneté */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Taux de Rachat par Tranche d&apos;Ancienneté
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[#19542b]">Ancienneté faible + Rachat = 1</code>
                  {" "}— Révèle un problème dès le début de la relation client.
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={C.rachat_par_anciennete}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={CUSTOM_TOOLTIP_STYLE}
                      itemStyle={{ color: "#fff" }}
                      formatter={(v: number) => [`${(v * 100).toFixed(1)} %`, "Taux de rachat"]}
                    />
                    <Bar dataKey="taux_rachat" fill="#f43f5e" name="Taux rachat" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Préférence Type Versement */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Préférence de Type de Versement
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  La fréquence mensuelle est souvent signe d&apos;une <span className="text-[#acc936]">meilleure rétention</span> sur le long terme.
                </div>
                {C.preference_type_versement.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={C.preference_type_versement}
                          dataKey="nb"
                          nameKey="type"
                          cx="50%" cy="50%"
                          outerRadius={75}
                          innerRadius={40}
                        >
                          {C.preference_type_versement.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString("fr-FR"), "Contrats"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {C.preference_type_versement.map((item, i) => (
                        <div key={item.type} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-[#093215]">{item.type}</span>
                          </div>
                          <span className="font-mono text-slate-400">{item.pct} %</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">Données non disponibles</div>
                )}
              </div>

              {/* Fréquence */}
              {C.distribution_frequence.length > 0 && (
                <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-[#093215] mb-4">Distribution Fréquence</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={C.distribution_frequence}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="frequence" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Bar dataKey="nb" fill="#ec4899" name="Contrats" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Vulnérabilité — résumé */}
              <div className="bg-white shadow-sm border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#093215] mb-4">
                  Analyse de la Vulnérabilité
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                        <AlertTriangle className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-rose-700">
                          {C.nb_contrats_vulnerables.toLocaleString("fr-FR")}
                        </div>
                        <div className="text-xs text-slate-400">contrats vulnérables (ancienneté ≤ 3 ans + rachat)</div>
                      </div>
                    </div>
                    <div className="text-xs text-rose-600 text-sm font-medium mt-2">
                      Représente {fmtPct(C.indice_vulnerabilite != null ? C.indice_vulnerabilite * 100 : null)} du portefeuille total
                      et {fmtPct(C.pct_rachets_precoces)} des rachats sont précoces.
                    </div>
                  </div>
                  <div className="p-4 bg-white text-[#093215] border-[#19542b] shadow-sm rounded-lg border-l-4 border-amber-400">
                    <p className="text-xs text-[#093215]">
                      <strong>Recommandation :</strong> Investiguer les causes des rachats précoces (mauvais conseil, 
                      besoin mal ciblé) et mettre en place un programme d&apos;onboarding renforcé pour les contrats 
                      de moins de 3 ans.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ═══ ONGLET ÉPARGNE & RACHAT ═══ */}
        {tab === "epargne" && ER && (
          <div className="space-y-6">
            <SectionHeader
              title="Épargne & Rachat — Vision Temporelle"
              subtitle="Suivre l’évolution de l’épargne collectée et du comportement de rachat dans le temps."
              gradient="from-emerald-900/70 to-teal-900/60"
            />

            {/* Chart 1 : Évolution annuelle montant initial + taux rachat */}
            {ER.epargne_par_annee.length > 0 && (
              <div className="chart-card bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-sm font-bold text-[#093215] mb-1">Montant d’épargne moyen & Taux de rachat par année</h3>
                <p className="text-xs text-slate-400 mb-4">Corrélation entre l’épargne collectée et le comportement de rachat année par année.</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={ER.epargne_par_annee} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradMontant" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#19542b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#19542b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradRachat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="annee" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE}
                      formatter={(v: number, name: string) =>
                        name === "Montant moy." ? [fmtMoney(v), name] : [`${(v*100).toFixed(1)}%`, name]
                      }
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="montant_initial_moyen" stroke="#19542b" fill="url(#gradMontant)" strokeWidth={2} name="Montant moy." dot={{ r: 3, fill: "#19542b" }} />
                    <Area yAxisId="right" type="monotone" dataKey="taux_rachat" stroke="#f43f5e" fill="url(#gradRachat)" strokeWidth={2} name="Taux rachat" dot={{ r: 3, fill: "#f43f5e" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Chart 2 : Montant vs Taux de rachat */}
              {ER.montant_vs_rachat.length > 0 && (
                <div className="chart-card bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-sm font-bold text-[#093215] mb-1">Montant Initial vs Taux de Rachat</h3>
                  <p className="text-xs text-slate-400 mb-4">Un montant plus élevé signifie-t-il moins de rachats ? Analyse par tranche.</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={ER.montant_vs_rachat} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE}
                        formatter={(v: number) => [`${(v*100).toFixed(1)}%`, "Taux de rachat"]}
                      />
                      <Bar dataKey="taux_rachat" name="Taux rachat" radius={[4,4,0,0]} cursor="pointer">
                        {ER.montant_vs_rachat.map((_, i) => (
                          <Cell key={i} fill={`hsl(${145 - i * 18}, 55%, ${40 + i * 3}%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart 3 : Épargne par type de versement */}
              {ER.epargne_par_type.length > 0 && (
                <div className="chart-card bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-sm font-bold text-[#093215] mb-1">Épargne & Rachat par Type de Contrat</h3>
                  <p className="text-xs text-slate-400 mb-4">Comparer le montant moyen et le taux de rachat selon le type de versement.</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={ER.epargne_par_type} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE}
                        formatter={(v: number, name: string) =>
                          name === "Montant moy." ? [fmtMoney(v), name] : [`${(v*100).toFixed(1)}%`, name]
                        }
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="montant_moyen" fill="#19542b" name="Montant moy." radius={[4,4,0,0]} />
                      <Bar yAxisId="right" dataKey="taux_rachat" fill="#f43f5e" name="Taux rachat" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ═══ ONGLET MACHINE LEARNING ═══ */}
        {tab === "ml" && (
          <div className="space-y-6">
            <div className={`rounded-xl bg-gradient-to-r from-violet-900/70 to-indigo-900/70 p-6 mb-6`}>
              <h2 className="text-xl font-bold text-white mb-1">Module Machine Learning</h2>
              <p className="text-sm text-white/80">Analyses prédictives et scoring intelligent du portefeuille — en cours d&apos;intégration.</p>
            </div>
            <MLSection />
          </div>
        )}

      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  )
}
