/**
 * The Claude-backed features (A11Y DoubleCheck and the evaluation summary) call
 * the local Flask service in `app.py` on port 5001. The deterministic evaluator
 * runs entirely in the browser and does not need it.
 *
 * On a hosted deployment those calls can never succeed, for two independent
 * reasons:
 *
 *   1. `localhost` resolves to the *visitor's* machine, where nothing is
 *      listening — not to the server hosting the app.
 *   2. A hosted demo is served over HTTPS, and browsers block requests from an
 *      HTTPS page to an `http://` URL as mixed content before they are sent.
 *
 * So rather than firing doomed requests and surfacing "request failed" to
 * visitors, treat the backend as available only when the app itself is being
 * served from localhost — i.e. local development, where `app.py` may be running.
 */

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]", "::1"];

/** Origin of the local Flask service. */
export const BACKEND_ORIGIN = "http://127.0.0.1:5001";

/**
 * True only when the app is served from localhost, so the Flask service could
 * plausibly be reachable. False on any hosted deployment.
 *
 * Note this is intentionally about *reachability*, not whether `app.py` is
 * actually running: locally the request is still attempted, and a genuine
 * connection failure is reported with an actionable message.
 */
export const IS_BACKEND_REACHABLE =
  typeof window !== "undefined" && LOCAL_HOSTNAMES.includes(window.location.hostname);
