"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Driver = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  statut: string;
  vehicle: string;
  plaque: string;
  solde: string;
};

export default function PrestatairesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/yango/drivers")
      .then((res) => res.json())
      .then((data) => {
        setDrivers(data.drivers || []);
      });
  }, []);

  // 🔍 recherche
  const filtered = drivers.filter((d) =>
    `${d.prenom} ${d.nom} ${d.telephone}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // 📊 KPI
  const total = drivers.length;

  // 🔥 TOP CHAUFFEURS PAR SOLDE
  const topDrivers = drivers
    .map((d) => ({
      name: `${d.prenom} ${d.nom}`,
      value: parseFloat(d.solde || "0") || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="p-6 text-white space-y-6 bg-[#020617] min-h-screen">

      {/* KPI */}
      <div className="inline-flex items-center gap-3 bg-indigo-600 px-4 py-2 rounded-xl shadow">
        <span className="text-sm opacity-80">Chauffeurs</span>
        <span className="text-xl font-bold">{total}</span>
      </div>

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Prestataires</h1>

        <input
          type="text"
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1e293b] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* TABLE */}
      <div className="bg-[#020617] rounded-xl border border-gray-800">
        <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-[#1e293b] sticky top-0 text-gray-300">
              <tr>
                <th className="p-3 text-left">Nom</th>
                <th className="p-3 text-left">Téléphone</th>
                <th className="p-3 text-left">Véhicule</th>
                <th className="p-3 text-left">Plaque</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-left">Solde</th>
              </tr>
            </thead>

            <tbody className="text-gray-200">
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-800 hover:bg-indigo-600/10"
                >
                  <td className="p-3 font-medium">
                    {d.prenom} {d.nom}
                  </td>

                  <td className="p-3 text-gray-400">
                    {d.telephone}
                  </td>

                  <td className="p-3">{d.vehicle}</td>

                  <td className="p-3">{d.plaque}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        d.statut === "free"
                          ? "bg-green-500/20 text-green-400"
                          : d.statut === "busy"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-gray-300"
                      }`}
                    >
                      {d.statut}
                    </span>
                  </td>

                  <td className="p-3 text-indigo-400 font-semibold">
                    {d.solde}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📊 GRAPH PRO */}
      <div className="bg-[#020617] p-4 rounded-xl border border-gray-800">
        <h2 className="mb-4 font-semibold text-indigo-400">
          Top 10 chauffeurs par solde
        </h2>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={topDrivers} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis
              dataKey="name"
              type="category"
              width={180}
              stroke="#94a3b8"
            />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="#6366f1"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}