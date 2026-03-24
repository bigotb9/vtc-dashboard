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

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  status: string;
  year: number;
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/yango/vehicles")
      .then((res) => res.json())
      .then((data) => {
        const formatted = (data.cars || []).map((v: { id: string; brand: string; model: string; number: string; status: string; year: number }) => ({
          id: v.id,
          brand: v.brand,
          model: v.model,
          plate: v.number,
          status: v.status,
          year: v.year,
        }));

        setVehicles(formatted);
      });
  }, []);

  // 🔍 SEARCH
  const filtered = vehicles.filter((v) =>
    `${v.brand} ${v.model} ${v.plate}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // 📊 MODELS COUNT (TOP 10)
  const modelData = Object.values(
    vehicles.reduce((acc: Record<string, { name: string; value: number }>, v) => {
      const key = `${v.brand} ${v.model}`;
      acc[key] = acc[key] || { name: key, value: 0 };
      acc[key].value++;
      return acc;
    }, {})
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* KPI COMPACT */}
      <div className="inline-flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow border">
        <span className="text-gray-500 text-sm">🚗 Véhicules</span>
        <span className="text-xl font-bold text-blue-600">
          {vehicles.length}
        </span>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="🔍 Rechercher véhicule..."
        className="border border-gray-300 p-2 rounded-lg w-full bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow border">
        <div className="max-h-[350px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 sticky top-0">
              <tr>
                <th className="p-3 text-left">Marque</th>
                <th className="p-3 text-left">Modèle</th>
                <th className="p-3 text-left">Plaque</th>
                <th className="p-3 text-left">Année</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody className="text-gray-800">
              {filtered.map((v) => (
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{v.brand}</td>
                  <td className="p-3">{v.model}</td>
                  <td className="p-3">{v.plate}</td>
                  <td className="p-3">{v.year}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        v.status === "working"
                          ? "bg-green-100 text-green-700"
                          : v.status === "not_working"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📊 GRAPH PRO (TOP MODELS) */}
      <div className="bg-white p-4 rounded-xl shadow border">
        <h3 className="font-semibold mb-4 text-gray-700">
          Top modèles de véhicules
        </h3>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={modelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}