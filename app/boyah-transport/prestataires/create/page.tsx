"use client"

import { useEffect, useState } from "react"

export default function CreateDriverPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  const [workRules, setWorkRules] = useState<any[]>([])

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    license_number: "",
    issue_date: "",
    expiry_date: "",
    experience_date: "",
    hire_date: "",
    car_id: "",
    work_rule_id: "",
  })

  const getCar = (item: any) => item?.car || item
  const getRule = (item: any) => item?.rule || item

  useEffect(() => {
    fetch("/api/yango/vehicles")
      .then(res => res.json())
      .then(data => {
        const list = data?.cars || data?.vehicles || data?.items || []
        setVehicles(list)
        setFilteredVehicles(list)
      })

    fetch("/api/yango/work-rules")
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data)
          ? data
          : data?.rules ||
            data?.work_rules ||
            data?.items ||
            []

        setWorkRules(list)
      })
  }, [])

  useEffect(() => {
    const filtered = vehicles.filter((item: any) => {
      const car = getCar(item)
      return (car?.number || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    })
    setFilteredVehicles(filtered)
  }, [search, vehicles])

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSelectVehicle = (item: any) => {
    const car = getCar(item)
    setForm({ ...form, car_id: car.id })
    setSearch(car.number)
    setShowDropdown(false)
  }

  return (
    <div className="page">
      <h1 className="title">Créer un prestataire</h1>

      <div className="grid">

        {/* INFOS */}
        <div className="card">
          <h2>Informations personnelles</h2>
          <input className="input" name="first_name" placeholder="Prénom" onChange={handleChange} />
          <input className="input" name="last_name" placeholder="Nom" onChange={handleChange} />
          <input className="input" name="phone" placeholder="+225..." onChange={handleChange} />
        </div>

        {/* PERMIS ALIGNÉ */}
        <div className="card">
          <h2>Permis</h2>

          <div className="grid-permis">

            <span>Numéro du permis</span>
            <input
              className="input"
              name="license_number"
              value={form.license_number}
              onChange={handleChange}
              placeholder="Numéro"
            />

            <span>Expérience de conduite depuis</span>
            <input
              className="input"
              type="date"
              name="experience_date"
              value={form.experience_date}
              onChange={handleChange}
            />

            <span>Délivré le</span>
            <input
              className="input"
              type="date"
              name="issue_date"
              value={form.issue_date}
              onChange={handleChange}
            />

            <span>Expire le</span>
            <input
              className="input"
              type="date"
              name="expiry_date"
              value={form.expiry_date}
              onChange={handleChange}
            />

            <span>Pays de délivrance</span>
            <select className="input" disabled>
              <option>Côte d’Ivoire</option>
            </select>

          </div>
        </div>

        {/* WORK RULES */}
        <div className="card">
          <h2>Conditions de travail</h2>

          <select
            className="input"
            name="work_rule_id"
            value={form.work_rule_id}
            onChange={(e) =>
              setForm({ ...form, work_rule_id: e.target.value })
            }
          >
            <option value="">Choisir une règle</option>

            {workRules.length === 0 && (
              <option disabled>Aucune règle disponible</option>
            )}

            {workRules.map((wr: any, i: number) => {
              const rule = getRule(wr)

              if (!rule?.id) return null

              return (
                <option key={i} value={rule.id}>
                  {rule.name}
                </option>
              )
            })}
          </select>

          <input
            className="input"
            type="date"
            name="hire_date"
            value={form.hire_date}
            onChange={handleChange}
          />
        </div>

        {/* VEHICULE */}
        <div className="card vehicle">
          <h2>Véhicule</h2>

          <input
            className="input"
            placeholder="Rechercher par immatriculation"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
            }}
          />

          {showDropdown && (
            <div className="dropdown">
              {filteredVehicles.map((item: any, i) => {
                const car = getCar(item)
                if (!car?.number) return null

                return (
                  <div
                    key={i}
                    onClick={() => handleSelectVehicle(item)}
                    className="item"
                  >
                    <div className="plate">{car.number}</div>
                    <div className="meta">{car.brand} {car.model}</div>
                  </div>
                )
              })}
            </div>
          )}

          <button className="btn">Créer le prestataire</button>
        </div>

      </div>

      <style jsx>{`
        .page {
          background: #0f0f0f;
          min-height: 100vh;
          padding: 30px;
          color: white;
        }

        .title {
          font-size: 24px;
          margin-bottom: 20px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .card {
          background: #1c1c1c;
          padding: 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        h2 {
          font-size: 16px;
          color: #ccc;
        }

        .input {
          background: #2a2a2a;
          border: none;
          padding: 10px;
          border-radius: 8px;
          color: white;
          width: 100%;
        }

        .grid-permis {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 20px;
          align-items: center;
        }

        .grid-permis span {
          font-size: 13px;
          color: #aaa;
        }

        .vehicle {
          position: relative;
        }

        .dropdown {
          position: absolute;
          top: 90px;
          width: 100%;
          background: #1c1c1c;
          border: 1px solid #333;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .item {
          padding: 10px;
          cursor: pointer;
        }

        .item:hover {
          background: #333;
        }

        .plate {
          font-weight: bold;
        }

        .meta {
          font-size: 12px;
          color: #aaa;
        }

        .btn {
          background: #ff6b00;
          padding: 12px;
          border-radius: 10px;
          margin-top: 10px;
          font-weight: bold;
        }
      `}</style>
    </div>
  )
}