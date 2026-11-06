/**
 * Demo placeholder for the person approving a component or recording
 * interaction observations. OrchestratoR has no user identity yet, so every
 * sign-off and recorded note is attributed to this fixed value. It is shown with
 * the "demo placeholder" label everywhere (the panel, the export) so it cannot be
 * mistaken for a real reviewer. This is the one place the name is defined.
 */
export const DEMO_REVIEWER = { name: "John Doe", role: "Developer" } as const;

/** "John Doe · Developer (demo placeholder)" — the form shown in the UI and export. */
export const DEMO_REVIEWER_LABEL = `${DEMO_REVIEWER.name} · ${DEMO_REVIEWER.role} (demo placeholder)`;
