import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { MapPin } from 'lucide-react'

interface City { id: string; name: string; state?: string; country: string }
interface Area { id: string; name: string; cityId: string }

interface Props {
  cityId?: string
  areaId?: string
  onCityChange: (city: City | null) => void
  onAreaChange: (area: Area | null) => void
}

export default function LocationAutocomplete({ cityId, areaId, onCityChange, onAreaChange }: Props) {
  const [cityQuery, setCityQuery] = useState('')
  const [areaQuery, setAreaQuery] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [showCities, setShowCities] = useState(false)
  const [showAreas, setShowAreas] = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (cityQuery.length < 1) { setCities([]); return }
      const { data } = await api.get('/location/cities', { params: { q: cityQuery } })
      setCities(data)
      setShowCities(true)
    }, 300)
    return () => clearTimeout(t)
  }, [cityQuery])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!cityId || areaQuery.length < 1) { setAreas([]); return }
      const { data } = await api.get('/location/areas', { params: { cityId, q: areaQuery } })
      setAreas(data)
      setShowAreas(true)
    }, 300)
    return () => clearTimeout(t)
  }, [areaQuery, cityId])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCities(false)
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) setShowAreas(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const inputStyle = { width: '100%', padding: '8px 10px 8px 30px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }
  const dropdownStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 50, maxHeight: 180, overflowY: 'auto' }
  const itemStyle = { padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#374151' }

  async function createCity() {
    const { data } = await api.post('/location/cities', { name: cityQuery })
    onCityChange(data)
    setCityQuery(data.name)
    setShowCities(false)
  }

  async function createArea() {
    if (!cityId) return
    const { data } = await api.post('/location/areas', { name: areaQuery, cityId })
    onAreaChange(data)
    setAreaQuery(data.name)
    setShowAreas(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div ref={cityRef} style={{ position: 'relative' }}>
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>City</label>
        <div style={{ position: 'relative' }}>
          <MapPin size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={cityQuery} onChange={e => setCityQuery(e.target.value)} placeholder="Search city…" style={inputStyle} />
        </div>
        {showCities && (
          <div style={dropdownStyle}>
            {cities.map(c => (
              <div key={c.id} style={itemStyle} onMouseDown={() => { onCityChange(c); setCityQuery(c.name); setShowCities(false) }}
                onMouseEnter={e => (e.target as HTMLDivElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.target as HTMLDivElement).style.background = ''}
              >
                {c.name}{c.state ? `, ${c.state}` : ''}
              </div>
            ))}
            {cityQuery && cities.length === 0 && (
              <div style={{ ...itemStyle, color: '#3b82f6' }} onMouseDown={createCity}>+ Add "{cityQuery}"</div>
            )}
          </div>
        )}
      </div>

      <div ref={areaRef} style={{ position: 'relative' }}>
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Area</label>
        <div style={{ position: 'relative' }}>
          <MapPin size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={areaQuery} onChange={e => setAreaQuery(e.target.value)} disabled={!cityId} placeholder={cityId ? 'Search area…' : 'Select city first'} style={{ ...inputStyle, opacity: cityId ? 1 : 0.5 }} />
        </div>
        {showAreas && (
          <div style={dropdownStyle}>
            {areas.map(a => (
              <div key={a.id} style={itemStyle} onMouseDown={() => { onAreaChange(a); setAreaQuery(a.name); setShowAreas(false) }}
                onMouseEnter={e => (e.target as HTMLDivElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.target as HTMLDivElement).style.background = ''}
              >
                {a.name}
              </div>
            ))}
            {areaQuery && areas.length === 0 && cityId && (
              <div style={{ ...itemStyle, color: '#3b82f6' }} onMouseDown={createArea}>+ Add "{areaQuery}"</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
