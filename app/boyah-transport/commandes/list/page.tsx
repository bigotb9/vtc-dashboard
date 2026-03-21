"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Order = {
  id: string;
  short_id: number;
  status: string;
  category: string;
  price: string;
  payment_method: string;
  created_at: string;
  driver_profile?: {
    name?: string;
  };
  car?: {
    brand_model?: string;
  };
};

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/yango/orders")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setFiltered(data.orders || []);
      });
  }, []);

  // 🔍 SEARCH
  useEffect(() => {
    const result = orders.filter((o) =>
      `${o.short_id} ${o.status} ${o.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, orders]);

  // 💰 KPI
  const totalRevenue = orders
    .filter((o) => o.status === "complete")
    .reduce((acc, o) => acc + parseFloat(o.price || "0"), 0);

  const totalOrders = orders.length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  const avg =
    totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : 0;

  // 📊 GRAPH (courses par catégorie)
  const categoryData = Object.entries(
    orders.reduce((acc: any, o) => {
      acc[o.category] = (acc[o.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 bg-[#020617] min-h-screen text-white space-y-6">

      {/* 🔥 KPI */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-600 p-4 rounded-xl">
          <p className="text-xs">Revenus</p>
          <p className="text-xl font-bold">{totalRevenue} FCFA</p>
        </div>

        <div className="bg-indigo-600 p-4 rounded-xl">
          <p className="text-xs">Courses</p>
          <p className="text-xl font-bold">{totalOrders}</p>
        </div>

        <div className="bg-red-600 p-4 rounded-xl">
          <p className="text-xs">Annulations</p>
          <p className="text-xl font-bold">{cancelled}</p>
        </div>

        <div className="bg-yellow-500 p-4 rounded-xl">
          <p className="text-xs">Panier moyen</p>
          <p className="text-xl font-bold">{avg} FCFA</p>
        </div>
      </div>

      {/* 🔍 SEARCH */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Commandes</h1>

        <input
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1e293b] px-4 py-2 rounded-lg"
        />
      </div>

      {/* 📋 TABLE */}
      <div className="border border-gray-800 rounded-xl">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#1e293b] sticky top-0">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Catégorie</th>
                <th className="p-3">Prix</th>
                <th className="p-3">Paiement</th>
                <th className="p-3">Chauffeur</th>
                <th className="p-3">Véhicule</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-gray-800">
                  <td className="p-3">{o.short_id}</td>
                  <td className="p-3">
                    {new Date(o.created_at).toLocaleString()}
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded ${
                        o.status === "complete"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>

                  <td className="p-3">{o.category}</td>

                  <td className="p-3 text-indigo-400 font-bold">
                    {o.price}
                  </td>

                  <td className="p-3">{o.payment_method}</td>

                  <td className="p-3">
                    {o.driver_profile?.name || "-"}
                  </td>

                  <td className="p-3">
                    {o.car?.brand_model || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📊 GRAPH */}
      <div className="bg-[#020617] p-4 rounded-xl border border-gray-800">
        <h2 className="text-indigo-400 mb-3">
          Répartition des courses
        </h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData}>
            <XAxis dataKey="name" stroke="#ccc" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}