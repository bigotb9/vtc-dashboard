"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

export default function BoyahTransportPage() {

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const res = await fetch("/api/yango/orders")
      const data = await res.json()

      const ordersData = data.orders || []

      setOrders(ordersData)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{
    fetchData()
  },[])

  if(loading) return <div className="p-6 text-white">Chargement...</div>

  // ================= KPI =================

  const today = new Date().toISOString().slice(0,10)

  const todayOrders = orders.filter(o =>
    o.created_at?.startsWith(today)
  )

  const completed = orders.filter(o => o.status === "complete")

  const todayRevenue = todayOrders
    .filter(o => o.status === "complete")
    .reduce((sum,o)=> sum + parseFloat(o.price || "0"),0)

  const totalRevenue = completed
    .reduce((sum,o)=> sum + parseFloat(o.price || "0"),0)

  const cancelled = orders.filter(o => o.status === "cancelled").length

  const cancelRate = orders.length > 0
    ? ((cancelled / orders.length) * 100).toFixed(0)
    : 0

  // ================= GRAPH =================

  const hourlyData = Object.values(
    todayOrders.reduce((acc:any,o:any)=>{
      const h = new Date(o.created_at).getHours()

      if(!acc[h]) acc[h] = { name: `${h}h`, value: 0 }

      acc[h].value += parseFloat(o.price || "0")

      return acc
    },{})
  )

  // ================= VEHICULES =================

  const vehicles = Object.entries(
    orders.reduce((acc:any,o:any)=>{
      const key = o.car?.brand_model || "N/A"
      acc[key] = (acc[key] || 0) + 1
      return acc
    },{})
  )
  .sort((a:any,b:any)=>b[1]-a[1])
  .slice(0,5)

  return (
    <div className="p-6 bg-[#020617] min-h-screen text-white space-y-6">

      {/* 🔥 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <KPI title="Aujourd’hui" value={todayRevenue} color="bg-green-600"/>
        <KPI title="Total" value={totalRevenue} color="bg-indigo-600"/>
        <KPI title="Courses" value={todayOrders.length} color="bg-blue-600"/>
        <KPI title="Annulation" value={`${cancelRate}%`} color="bg-red-600"/>

      </div>

      {/* 📊 GRAPH */}
      <div className="bg-[#020617] border border-gray-800 rounded-xl p-4">
        <h2 className="text-indigo-400 mb-4">Revenus aujourd’hui (par heure)</h2>

        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourlyData}>
            <XAxis dataKey="name" stroke="#ccc"/>
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🚗 TOP VEHICULES */}
      <div className="bg-[#020617] border border-gray-800 rounded-xl p-4">
        <h2 className="text-indigo-400 mb-4">Top véhicules</h2>

        {vehicles.map((v:any,i)=>(
          <div key={i} className="flex justify-between py-2 border-b border-gray-800 text-sm">
            <span>{v[0]}</span>
            <span className="text-indigo-400">{v[1]}</span>
          </div>
        ))}
      </div>

      {/* 📋 DERNIÈRES COURSES */}
      <div className="bg-[#020617] border border-gray-800 rounded-xl p-4">

        <h2 className="text-indigo-400 mb-4">Dernières courses</h2>

        <div className="max-h-[300px] overflow-auto">

          {orders.slice(0,10).map((o,i)=>(
            <div key={i} className="flex justify-between py-2 border-b border-gray-800 text-sm">

              <span className="text-gray-400">#{o.short_id}</span>

              <span>{o.car?.brand_model || "-"}</span>

              <span className="text-green-400">
                {parseFloat(o.price || 0).toLocaleString()} FCFA
              </span>

              <span
                className={`text-xs px-2 py-1 rounded ${
                  o.status === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {o.status}
              </span>

            </div>
          ))}

        </div>

      </div>

    </div>
  )
}

// ================= UI =================

function KPI({title,value,color}:any){
  return(
    <div className={`${color} p-4 rounded-xl`}>
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-xl font-bold">
        {typeof value === "number"
          ? value.toLocaleString() + " FCFA"
          : value}
      </div>
    </div>
  )
}