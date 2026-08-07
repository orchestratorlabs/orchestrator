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
        {/*
          No aria-label: the visible "Admin" text is the accessible name. An
          aria-label of "Profile" would override it, so assistive technology would
          announce a name the user cannot see and voice control saying "click
          Admin" would not match the control — WCAG 2.5.3 Label in Name.

          The avatar is decorative and hidden from assistive technology, since the
          button is already named by its text. It uses currentColor so it follows
          the button's colour rather than needing its own theme handling.
        */}
        <button type="button" className="top-bar-btn top-bar-btn--profile">
          <svg
            className="top-bar-avatar"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="8.5" r="3.75" />
            <path d="M4.5 20.5c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5" />
          </svg>
          Admin
        </button>
      </div>
    </header>
  );
}
