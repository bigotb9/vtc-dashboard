"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SettingsPage() {

  const [avatar, setAvatar] = useState("/avatar.png")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")

  const [newPassword, setNewPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")

  useEffect(() => {
    const loadUser = async () => {

      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) return

      const user = data.user

      setEmail(user.email || "")

      // récupérer display name depuis Auth
      const name = user.user_metadata?.display_name
      if (name) setDisplayName(name)

      // récupérer avatar dans profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single()

      if (profile?.avatar_url) {
        setAvatar(profile.avatar_url)
      }
    }

    loadUser()
  }, [])


  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {

    const file = event.target.files?.[0]
    if (!file) return

    const { data } = await supabase.auth.getUser()
    const user = data.user

    if (!user) return

    const filePath = `${user.id}.png`

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.log("UPLOAD ERROR:", error)
      return
    }

    // construire URL publique correctement
    const avatarUrl =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}`

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id)

    if (updateError) {
      console.log("DB UPDATE ERROR:", updateError)
      return
    }

    // forcer refresh image
    setAvatar(avatarUrl + "?t=" + Date.now())
  }


  async function changePassword() {

    if (newPassword !== repeatPassword) {
      alert("Passwords do not match")
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) alert(error.message)
    else alert("Password updated")
  }


  return (

    <div style={{
      maxWidth: "820px",
      margin: "auto",
      padding: "40px"
    }}>

      <h1 style={{
        fontSize: "26px",
        marginBottom: "25px"
      }}>
        Settings
      </h1>


      <div style={{
        background: "#1f2937",
        padding: "35px",
        borderRadius: "14px",
        border: "1px solid #374151"
      }}>


        {/* PROFILE */}

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "30px"
        }}>

          <img
            src={avatar}
            width={80}
            height={80}
            style={{
              borderRadius: "50%",
              objectFit: "cover"
            }}
          />

          <div>

            <label style={{
              background: "#374151",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px"
            }}>
              Upload photo
              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                style={{ display: "none" }}
              />
            </label>

            <p style={{
              marginTop: "10px",
              fontWeight: "600"
            }}>
              {displayName}
            </p>

            <p style={{
              fontSize: "14px",
              opacity: 0.7
            }}>
              {email}
            </p>

            <p style={{
              fontSize: "14px",
              opacity: 0.6
            }}>
              BOYAH GROUP
            </p>

          </div>

        </div>


        <div style={{
          height: "1px",
          background: "#374151",
          marginBottom: "30px"
        }}/>


        {/* PASSWORD */}

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          maxWidth: "400px"
        }}>

          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e)=>setNewPassword(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #374151",
              background: "#111827",
              color: "white"
            }}
          />

          <input
            type="password"
            placeholder="Repeat new password"
            value={repeatPassword}
            onChange={(e)=>setRepeatPassword(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #374151",
              background: "#111827",
              color: "white"
            }}
          />

          <button
            onClick={changePassword}
            style={{
              marginTop: "10px",
              padding: "11px",
              background: "#6366f1",
              borderRadius: "8px",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontWeight: "500"
            }}
          >
            Update password
          </button>

        </div>

      </div>

    </div>
  )
}