"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import { useState } from "react";
import type { RevenueTimePoint } from "@/types/domain";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type TimeGranularity = "hourly" | "daily" | "weekly";

export function RevenueChart({
  timeline,
  sourceFilter,
}: {
  timeline: RevenueTimePoint[];
  sourceFilter: "all" | "pos" | "online";
}) {
  const [granularity, setGranularity] = useState<TimeGranularity>("hourly");

  const labels = timeline.map((point) => point.label);

  const datasets = [];

  if (sourceFilter !== "online") {
    datasets.push({
      label: "POS Sales",
      data: timeline.map((point) => point.posRevenue),
      borderColor: "#0f766e",
      backgroundColor: "rgba(15, 118, 110, 0.12)",
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: "#0f766e",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      borderWidth: 2.5,
    });
  }

  if (sourceFilter !== "pos") {
    datasets.push({
      label: "Online Sales",
      data: timeline.map((point) => point.onlineRevenue),
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: "#f59e0b",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      borderWidth: 2.5,
    });
  }

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: sourceFilter === "all",
        position: "top" as const,
        align: "end" as const,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          font: { size: 12, family: "DM Sans" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleFont: { size: 13, family: "DM Sans" },
        bodyFont: { size: 12, family: "IBM Plex Mono" },
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          afterBody(items: TooltipItem<"line">[]) {
            if (items.length > 1) {
              const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
              return `Total: $${total.toFixed(2)}`;
            }
            return "";
          },
          label(context: TooltipItem<"line">) {
            return `${context.dataset.label}: $${(context.parsed.y ?? 0).toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11, family: "DM Sans" },
          color: "#94a3b8",
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(15, 23, 42, 0.06)" },
        ticks: {
          font: { size: 11, family: "IBM Plex Mono" },
          color: "#94a3b8",
          callback(value: string | number) {
            return `$${value}`;
          },
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  const toggleButtons: { value: TimeGranularity; label: string }[] = [
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];

  return (
    <div className="surface rounded-2xl border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-950">Revenue Over Time</h3>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {toggleButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setGranularity(btn.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                granularity === btn.value
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 300 }}>
        <Line data={{ labels, datasets }} options={options} />
      </div>
    </div>
  );
}
