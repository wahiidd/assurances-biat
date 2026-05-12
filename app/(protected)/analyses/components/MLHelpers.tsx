"use client"
import { useState, useEffect, useCallback } from "react"
import { Brain, Zap, Play, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp, Shield, BarChart2, Activity, FileText } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== "undefined" && window.location.hostname !== "localhost" 
    ? "/api" 
    : "http://localhost:5000/api")
const TOKEN_KEY = "pfe_access_token"
const COLORS_MODEL: Record<string, string> = {
  "Régression Logistique": "#e74c3c",
  "Random Forest": "#2ecc71",
  "XGBoost": "#3498db",
}
const RISK_COLORS: Record<string, string> = { "Élevé": "#f43f5e", "Modéré": "#f59e0b", "Faible": "#10b981" }

const TIP = {
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: "10px", color: "#f8fafc", padding: "8px 12px", fontSize: "12px"
}

function getToken(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(TOKEN_KEY) || ""
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken()
  // path can be relative (/ml/run) or start with /api — normalise
  const url = path.startsWith("/api") ? `${API_BASE.replace("/api", "")}${path}` : `${API_BASE}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  return res.json()
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, color = "indigo" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-center">
      <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function ModelTable({ metrics }: { metrics: Record<string, any> }) {
  const rows = ["auc", "f1", "accuracy", "precision", "recall", "cv_auc_mean"]
  const labels: Record<string, string> = {
    auc: "AUC-ROC", f1: "F1-Score", accuracy: "Accuracy",
    precision: "Précision", recall: "Rappel", cv_auc_mean: "CV AUC (mean)"
  }
  const modelNames = Object.keys(metrics)
  const bestAuc = Math.max(...modelNames.map(n => metrics[n].auc || 0))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left py-2 px-3 text-slate-500 font-medium">Métrique</th>
            {modelNames.map(n => (
              <th key={n} className="py-2 px-3 font-bold" style={{ color: COLORS_MODEL[n] }}>
                {n.replace("Régression Logistique", "Reg. Log.")}
                {metrics[n].auc === bestAuc && <span className="ml-1 text-[#acc936]">★</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="py-2 px-3 text-slate-600">{labels[row]}</td>
              {modelNames.map(n => {
                const v = metrics[n][row]
                const isAuc = row === "auc"
                const isBest = isAuc && v === bestAuc
                return (
                  <td key={n} className={`py-2 px-3 text-center font-mono ${isBest ? "text-[#19542b] font-bold" : ""}`}>
                    {v != null ? (v * 100).toFixed(1) + (row === "auc" ? "" : "%") : "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfusionMatrix({ cm, modelName }: { cm: number[][]; modelName: string }) {
  const color = COLORS_MODEL[modelName] || "#6366f1"
  const labels = ["PM (0)", "Rachat (1)"]
  const maxVal = Math.max(...cm.flat())
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-slate-400 text-center mb-1">Prédit →</div>
      <div className="grid grid-cols-2 gap-1">
        {cm.map((row, ri) =>
          row.map((val, ci) => {
            const opacity = 0.15 + (val / maxVal) * 0.85
            return (
              <div key={`${ri}-${ci}`}
                className="rounded p-2 text-center text-xs font-bold"
                style={{ backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`, color: opacity > 0.5 ? "#fff" : "#334155" }}
              >
                <div>{val.toLocaleString("fr-FR")}</div>
                <div className="text-[9px] opacity-70">{ri === 0 ? "PM" : "Rachat"} réel → {labels[ci]} prédit</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function RocCurves({ metrics }: { metrics: Record<string, any> }) {
  const modelNames = Object.keys(metrics)
  const allData: any[] = []
  const seen = new Set<string>()
  modelNames.forEach(n => {
    (metrics[n].roc_curve || []).forEach((pt: any) => {
      const key = pt.fpr?.toFixed(3)
      if (!seen.has(key)) { seen.add(key); allData.push({ fpr: pt.fpr, [n]: pt.tpr }) }
      else { const row = allData.find(r => r.fpr?.toFixed(3) === key); if (row) row[n] = pt.tpr }
    })
  })
  allData.sort((a, b) => a.fpr - b.fpr)
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={allData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="fpr" type="number" domain={[0, 1]} tickFormatter={v => v?.toFixed(1)} label={{ value: "Taux de Faux Positifs", position: "insideBottom", offset: -5, fontSize: 10 }} tick={{ fontSize: 10 }} />
        <YAxis type="number" domain={[0, 1]} label={{ value: "Taux de Vrais Positifs", angle: -90, position: "insideLeft", fontSize: 10 }} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} formatter={(v: any) => v?.toFixed(3)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
        
        {/* Ligne aléatoire (0,0) -> (1,1) */}
        <Line dataKey="fpr" name="Aléatoire (AUC = 0.500)" stroke="#94a3b8" strokeDasharray="5 5" dot={false} isAnimationActive={false} />

        {modelNames.map(n => (
          <Line key={n} type="linear" dataKey={n} stroke={COLORS_MODEL[n]} dot={false} strokeWidth={2} name={`${n} (AUC = ${(metrics[n].auc).toFixed(4)})`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ScoreDistributionChart({ distribution }: { distribution: any[] }) {
  if (!distribution || distribution.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="interval" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={TIP} itemStyle={{ color: "#fff" }} />
        <Bar dataKey="count" name="Nb de Contrats" fill="#3498db" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MetricComparisonChart({ metrics }: { metrics: Record<string, any> }) {
  const modelNames = Object.keys(metrics)
  const metricKeys = [
    { key: "f1", label: "F1-Score" },
    { key: "accuracy", label: "Accuracy" },
    { key: "precision", label: "Précision" },
    { key: "recall", label: "Rappel" }
  ]
  
  // Transformation des données pour Recharts (une ligne = une métrique, colonnes = les modèles)
  const data = metricKeys.map(m => {
    const row: any = { name: m.label }
    modelNames.forEach(n => {
      row[n] = metrics[n][m.key] ? metrics[n][m.key] * 100 : 0
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={TIP} itemStyle={{ color: "#fff" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
        {modelNames.map(n => (
          <Bar key={n} dataKey={n} name={n} fill={COLORS_MODEL[n]} radius={[4, 4, 0, 0]} barSize={20} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export { MetricCard, ModelTable, ConfusionMatrix, RocCurves, ScoreDistributionChart, MetricComparisonChart, COLORS_MODEL, RISK_COLORS, TIP, apiFetch }
