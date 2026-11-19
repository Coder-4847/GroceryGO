import { useRef, useState } from 'react'

const SUGGESTIONS = ['bread', 'eggs', 'milk', 'olive oil', 'detergent', 'rice', 'shampoo', 'coffee']

export default function SearchBar({ onSearch, loading, initialValue = '', suggest, chips = SUGGESTIONS }) {
  const [value, setValue] = useState(initialValue)
  const [lastSynced, setLastSynced] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const options = focused && suggest ? suggest(value) : []

  // When the query changes from outside (URL load, suggestion chip, logo reset),
  // mirror it into the field. Adjusting state during render is the documented
  // React pattern for "reset state when a prop changes".
  if (initialValue !== lastSynced) {
    setLastSynced(initialValue)
    setValue(initialValue)
  }

  const submit = (e) => {
    e.preventDefault()
    const q = value.trim()
    if (q) {
      onSearch(q)
      inputRef.current?.blur()
    }
  }

  return (
    <form className="searchbar" onSubmit={submit} role="search">
      <div className="searchbar-field">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          name="item"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Search groceries, household, electronics…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="search"
          aria-label="Search for a grocery item"
        />
        <button type="submit" className="searchbar-go" disabled={loading || !value.trim()}>
          {loading ? <Spinner /> : 'Compare'}
        </button>
        {options.length > 0 && (
          <ul className="suggest-list" role="listbox">
            {options.map((o) => (
              <li key={o} role="option">
                <button
                  type="button"
                  className="suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setValue(o)
                    setFocused(false)
                    onSearch(o)
                    inputRef.current?.blur()
                  }}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="searchbar-suggestions">
        {chips.map((s) => (
          <button
            type="button"
            key={s}
            className="chip"
            onClick={() => {
              setValue(s)
              onSearch(s)
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="searchbar-icon">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Spinner() {
  return <span className="spinner" aria-label="Searching" />
}
