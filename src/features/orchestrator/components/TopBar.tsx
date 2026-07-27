export function TopBar() {
  return (
    <header className="top-bar">
      <input
        type="search"
        className="top-search"
        placeholder="Search files, components or commands"
        aria-label="Search"
      />
      <div className="top-actions">
        <button type="button" className="top-bar-btn" aria-label="Profile">
          Admin
        </button>
      </div>
    </header>
  );
}
