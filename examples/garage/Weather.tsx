/*
 * Loaded only when the Weather window is first opened: the sample's proof that a
 * window's code can wait until somebody asks for it. Opening it shows the desk's
 * own `Loading` while that import is in flight.
 *
 * Then the window waits AGAIN, for a forecast, and that is the second thing this
 * sample is for: a wait long enough to need explaining. The service is slow and
 * cannot say how far it has got, so there is no fraction to draw a bar with — past
 * three seconds the same spinner says what it is waiting for instead.
 */
import { useEffect, useState } from 'react'
import { Loading } from '../../src/react/index.js'

const DAYS = [['Sat', '19°', 'Wind NW 22 km/h'], ['Sun', '23°', 'Calm'], ['Mon', '14°', 'Showers']]

export default function Weather() {
  const [forecast, setForecast] = useState<string[][] | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setForecast(DAYS), 4500)
    return () => clearTimeout(timer)
  }, [])

  if (!forecast) {
    return (
      <Loading
        label="Asking the weather service"
        slow="It answers slowly on a Friday. The garage works without it."
      />
    )
  }

  return (
    <div className="pad">
      <div className="stats">
        {forecast.map(([d, t, w]) => (
          <div className="stat" key={d}><span>{d}</span><b>{t}</b><span className="small">{w}</span></div>
        ))}
      </div>
      <p className="lede">Sunday is the pick: warm, still, and dry roads by 8am.</p>
    </div>
  )
}
