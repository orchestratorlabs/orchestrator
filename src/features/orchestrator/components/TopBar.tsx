export function TopBar() {
  return (
    <header className="top-bar">
      <input
        type="search"
        className="top-search"
        placeholder="Search files, symbols, or commands"
        aria-label="Search"
      />
      <div className="top-actions">
        <button type="button" className="icon-btn" aria-label="Profile">
          Admin
        </button>
      </div>
    </header>
  );
}
