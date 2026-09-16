/*
 * Loaded only when the Weather window is first opened: the sample's proof that a
 * window's code can wait until somebody asks for it.
 */
export default function Weather() {
  return (
    <div className="pad">
      <div className="stats">
        {[['Sat', '19°', 'Wind NW 22 km/h'], ['Sun', '23°', 'Calm'], ['Mon', '14°', 'Showers']].map(([d, t, w]) => (
          <div className="stat" key={d}><span>{d}</span><b>{t}</b><span className="small">{w}</span></div>
        ))}
      </div>
      <p className="lede">Sunday is the pick: warm, still, and dry roads by 8am.</p>
    </div>
  )
}
