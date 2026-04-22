# orchestrator_wireframe_spec.md

## File Purpose
This document defines the UI wireframe specification for the Orchestrator MVP.

It translates the sketch wireframe into a build-ready product and interface description for engineering. The MVP is focused on a right-side accessibility copilot experience for evaluating a React button component.

## Product Context
Orchestrator MVP is an AI accessibility copilot for developers and engineers.

The MVP allows a user to:
- open a right-side copilot panel
- paste or review a React button component
- run an accessibility evaluation
- view an Accessibility Health Score
- review rule results
- review recommended fixes

## Primary Layout
The application uses a code-editor-inspired layout with two main regions:

1. Main editor workspace on the left
2. Fixed right-side Orchestrator copilot panel

The overall feel should be:
- clean
- lightweight
- enterprise
- modern developer tool
- dark-mode friendly
- minimal

## Top Bar
The top bar should include:
- a search field on the left
- product/application chrome
- an Orchestrator icon on the top right
- an Admin or profile icon on the far right

The Orchestrator icon is the primary trigger for opening the right-side copilot panel.

## Main Workspace
The main workspace should resemble a developer environment.

Expected elements:
- code tabs across the top of the editor area
- examples such as:
  - ButtonCode.tsx
  - ButtonCode.css
  - index.tsx
- code editing area in the main center panel
- visible line numbers
- a left utility rail or navigation strip
- room for pasted React code or a sample button component

The main workspace should feel familiar to engineers and developers, similar to a lightweight IDE or browser-based code editor.

## Right-Side Copilot Panel
The Orchestrator panel is a fixed right rail attached to the right side of the application.

Behavior:
- closed by default
- opens when the user clicks the Orchestrator icon in the top right
- remains visually anchored to the right edge of the interface
- behaves like an inspector or analysis side panel

The panel should feel like a focused developer inspection tool, not a chat window.

## Right Panel Title
The right panel title should identify the feature clearly, such as:
- Orchestrator A11y Inspector

This title should make it obvious that the panel is evaluating accessibility.

## Right Panel Sections
The right panel should include these high-level sections near the top:

- Health Score
- Findings
- Fixes

These can be shown as tabs, segmented controls, or clearly separated content sections, as long as the hierarchy is clear.

## Health Score Area
At the top of the panel, show the Accessibility Health Score prominently.

Requirements:
- score displayed near the top
- score shown out of 100
- circular or high-visibility score treatment is acceptable
- include a brief summary next to or below the score

Example summary content:
- Strong
- 6 rules passed
- 2 issues failed

The health score area should give the user an immediate, high-level understanding of component quality.

## Findings Area
Below the score, show findings related to accessibility compliance.

This section should:
- clearly reference WCAG 2.1 compliance or equivalent RAG-defined evaluation categories
- present rule-by-rule evaluation results
- display statuses in a scannable list

## Rule Status Ordering
The findings list should be ordered as follows:

1. Pass rules first
2. Fail rules lower in the list
3. Unknown shown wherever evidence is missing

Unknown should not be treated as Pass or Fail. It should be surfaced explicitly when a rule cannot be verified from the available evidence.

## Rule Row Design
Each rule row should support:
- rule name or short label
- status indicator
- clear visual distinction by status
- optional short explanation

Status indicators may include:
- green dot or equivalent for Pass
- red dot or equivalent for Fail
- neutral or amber indicator for Unknown

The design should prioritize readability and fast scanning.

## Fixes Area
The panel should include a Fixes section that provides recommended remediation guidance.

Each failed rule should ideally include:
- a concise explanation of the issue
- a practical recommendation
- engineering-friendly wording

The fixes should feel actionable and instructional, not overly verbose.

## Interaction Flow
Expected MVP interaction flow:

1. User opens the application
2. User sees the code editor workspace
3. The Orchestrator panel is closed by default
4. User clicks the Orchestrator icon in the top right
5. The right-side copilot panel opens
6. User pastes React code or loads a sample button component
7. The system runs the accessibility evaluation
8. Results appear in the right panel
9. User reviews score, findings, and fixes

## Button and Action Area
At the bottom of the right panel, include future-facing action buttons for:

- Push to Figma
- Jira Ticket

For the MVP:
- these buttons should be visible
- these buttons should be disabled placeholder actions
- they should communicate future workflow intent, not active functionality

## Default Component Scope
The MVP supports:
- React button component evaluation only

Do not design this wireframe around broader component coverage yet.

## Content Priorities
The most important content in the right rail is:

1. Accessibility Health Score
2. Summary of overall result
3. Rule-by-rule Pass / Fail / Unknown findings
4. Recommended fixes
5. Future action buttons

## Design Constraints
The wireframe implementation should:
- avoid over-design
- avoid unnecessary animation
- favor clarity over decoration
- feel enterprise-ready
- support dark mode styling
- remain compact and scannable

## Notes for Engineering
This wireframe should be implemented as a practical MVP, not a final polished production interface.

Build priorities:
- preserve the right-rail interaction model
- preserve the code-editor context
- preserve the score-first hierarchy
- preserve the findings order: Pass first, Fail lower, Unknown when evidence is missing
- keep Push to Figma and Jira Ticket visible but disabled
