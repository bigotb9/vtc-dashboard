"use client"

import { Search } from "lucide-react"

export default function SearchBar() {

  return (

    <div className="w-full mb-8">

      <div className="flex items-center bg-white rounded-xl px-4 py-3 border shadow-sm">

        <Search className="text-gray-400 mr-3" size={20} />

        <input
          type="text"
          placeholder="Rechercher : date, immatriculation, chauffeur, dépense..."
          className="w-full outline-none text-sm text-gray-700"
        />

      </div>

    </div>

  )
}