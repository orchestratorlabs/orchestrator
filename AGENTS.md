# AGENTS.md

## Project Name
Orchestrator MVP

## What Orchestrator Is
Orchestrator is an AI accessibility copilot for developers and engineers.  
It helps evaluate React UI components against accessibility rules defined in the project RAG and returns a clear health score, findings, and recommended fixes.

## MVP Purpose
The MVP is focused on a single, narrow workflow:

- Evaluate a React button component for accessibility
- Return an Accessibility Health Score out of 100
- Return findings in a right-side copilot panel
- Recommend fixes clearly for engineers and developers

This MVP supports **button components only**.

## Primary Users
- Engineers
- Developers

## Source of Truth
The project RAG and registry files are the source of truth for all accessibility evaluation logic.

The AI must:
- follow the RAG exactly
- avoid inventing rules that are not present in the RAG
- avoid marking a rule as Pass without evidence
- stay grounded in the provided evaluation criteria

If a rule cannot be verified from the available evidence, the AI must return **Unknown** instead of guessing.

## Evaluation Priorities
The AI should prioritize:

1. Following the RAG as the source of truth
2. High recall over perfect precision
3. Clear explanations for engineers and developers
4. Conservative judgment when evidence is missing

This means the system should lean toward surfacing potential issues rather than missing meaningful accessibility risks, but it must remain grounded in the RAG.

## Rule Status Definitions
Use these exact status definitions:

- **Pass** = verified and compliant
- **Fail** = verified and not compliant
- **Unknown** = not enough evidence to verify either one

Unknown must not be treated as Pass or Fail.  
Unknown should be surfaced separately when evidence is missing.

## Output Requirements
Each evaluation must return:

1. Accessibility Health Score out of 100
2. Summary
3. Pass / Fail / Unknown status per rule

When relevant, include:
- clear findings
- concise explanation of why a rule passed, failed, or is unknown
- recommended fixes for failed rules

## UI Behavior
The UI should follow a standard right-side copilot layout.

Expected interaction flow:

1. User clicks the Orchestrator icon in the top right
2. The right-side panel opens
3. The user pastes React code or loads a sample component
4. The system runs the evaluation
5. Results appear in the right-side panel

## UI Design Direction
The UI should feel:

- clean
- lightweight
- enterprise
- modern developer tool
- dark mode friendly
- minimal
- right-side copilot driven

Do not over-design the interface.  
Favor clarity, readability, and usability over visual complexity.

## Panel Content Hierarchy
In the right-side panel:

- show the Accessibility Health Score at the top
- show rule results clearly underneath
- surface **Pass** rules first
- show **Fail** rules lower in the list
- show **Unknown** where evidence is missing

## Tone and Writing Style
The AI should use a tone that is:

- enterprise and professional
- supportive
- instructional
- clear for engineers and developers

Responses should be concise, readable, and actionable.

## MVP Scope
In scope for MVP:

- button component evaluation only
- pasted React code or sample component loading
- right-side copilot results panel
- health score
- rule-based findings
- recommended fixes

## Out of Scope for MVP
Do not build these into the initial MVP:

- Figma plugin
- overdesigned or highly polished UI
- rules beyond the RAG
- support for components beyond button
- speculative features not needed for the core evaluation flow

## Future Direction Notes
Future versions may include:
- push notification to Figma
- Jira ticket creation

These are not required for the initial MVP unless explicitly requested later.

## Engineering Guidance
When building this MVP:

- keep the architecture simple
- keep the workflow narrow and testable
- prefer a working end-to-end proof of concept over broad feature coverage
- do not add unnecessary complexity
- do not assume missing evidence means Pass
- do not invent accessibility logic outside the RAG
- start with a simple, working frontend and evaluation flow before adding real LLM or external integrations

## Build Goal
The goal is to create a believable first working Orchestrator product slice:

**React button input → accessibility evaluation → health score and findings → right-side copilot output**